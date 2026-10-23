# CI de infraestrutura e deploy

## Fluxo

- `Infrastructure preview`: PR interno para `main` com alterações em infra, workflow ou
  dependências executa `pulumi preview` nas stacks `shared`, `staging`, `prod`, `billing`
  e `automation`. Resultado no resumo de cada job. Forks e Dependabot não recebem segredos.
- `Infrastructure apply`: acionamento manual em `main`, escolha de stack. Gera um plano
  novo e aplica esse mesmo plano/revisão. Não aplica automaticamente ao fazer merge.
- `Deployment image`: PR compila a imagem ARM completa sem credenciais AWS.
- `Deploy application`: manual em `main`, escolhe `staging`/`prod`, `smoke`/`application`
  e opcionalmente um SHA completo. O SHA precisa pertencer a `main` e ter a CI aprovada.
  Nenhuma branch arbitrária pode acessar os environments de aplicação.

As operações de escrita compartilham `concurrency: aws-operations`, sem cancelamento
automático. Não iniciar uma operação local enquanto houver uma aplicação pela CI.
O plano de um PR é informativo: não é reaproveitado após merge porque código e estado
podem mudar. Planos podem conter informações sensíveis e não são publicados como artifact.

## Bootstrap do acesso GitHub → AWS

Autenticação OIDC, sem access keys permanentes. `automation.ts` define:

- `lazuli-github-preview`: leitura de recursos/estado e escrita somente dos locks do backend.
- `lazuli-github-infra-apply`: provisionamento dos serviços utilizados, limitado a Ohio para
  EC2/RDS e aos nomes de recursos Lazuli nos serviços que permitem esse escopo. Esta role
  tem poderes amplos de EC2/RDS na conta dedicada; não é a role de deploy da aplicação.
- `lazuli-github-deploy-staging`/`prod`: ECR do ambiente, SSM nas EC2 com tags correspondentes,
  leitura da URL de migração daquele ambiente e túnel privado para o RDS.

`automation` é aplicada pelo operador local. As roles da CI não podem editar o próprio
trust, outras roles da organização ou o checkpoint da stack `automation`.
PRs internos são código confiável: o programa Pulumi precisa da passphrase para avaliar
configuração criptografada. Não trazer código externo para uma branch interna sem revisão.

O proprietário ativou “Advanced features” em 23/10/2026. A leitura de provedores
OIDC passou, e a stack `automation` criou o provedor GitHub e as quatro roles.
Os environments `infra-apply`, `app-staging` e `app-prod` foram configurados no GitHub
com acesso restrito à branch `main`. Os previews do PR, o apply sem mudanças e o
smoke em staging passaram no GitHub. A [AWS descreve os efeitos da ativação](https://docs.aws.amazon.com/accounts/latest/reference/activate-advanced-features.html),
inclusive a remoção de spend limits; o budget de alertas continua ativo.

Para retomar ou atualizar o bootstrap OIDC:

```sh
export AWS_PROFILE=lazuli AWS_REGION=us-east-2
export PULUMI_CONFIG_PASSPHRASE_FILE="$HOME/.config/lazuli/pulumi-passphrase"
cd infra/pulumi
# Apenas na primeira vez; use stack select se ela já existir.
pulumi stack init automation
pulumi preview --stack automation
pulumi up --stack automation
cd ../..
node infra/deploy/configure-github.mjs
```

Se já houver um provedor GitHub na conta, informar seu ARN com
`pulumi config set githubOidcProviderArn ... --stack automation`, sem duplicá-lo.
O bootstrap GitHub cria environments `infra-apply`, `app-staging`, `app-prod`, restritos
à branch `main`; preserva regras preexistentes e exige que elas restrinjam as execuções à branch main. Ele grava
as variáveis de roles, `PULUMI_CONFIG_PASSPHRASE` e `PULUMI_BILLING_CONFIG` usando stdin,
sem imprimir seus valores. Pode ser repetido quando os ambientes existentes mantêm essa restrição.

## Validar em etapas pequenas

1. Aplicar o suporte ECR/SSM em staging. Confirmar `pulumi preview --expect-no-changes`.
2. Executar `Infrastructure apply` em staging sem mudanças e conferir o resumo.
3. Configurar `running=true` em staging e aplicar sua stack.
4. Executar `Deploy application`, ambiente staging, modo **smoke** (padrão). A imagem
   mínima responde `first` e depois `second`, acessível apenas em `127.0.0.1:18080`.
   O script confere ambas as respostas e remove o container mesmo em caso de falha.
   Não lê segredos da aplicação, não migra o banco e não altera web/worker.
5. Somente após esses checks, configurar runtime/domínio e executar **application**.

O smoke também pode ser executado com credenciais locais:
construir `Smoke.Dockerfile`, publicar em `lazuli/staging`, obter seu digest e executar
`AWS_PROFILE=lazuli node infra/deploy/run.mjs smoke staging <imagem@sha256:...>`.
Essa execução local valida ECR, SSM, Docker e HTTP. O
[smoke executado pelo GitHub](https://github.com/josiasrfreitas/lazuli/actions/runs/39997327526)
também comprovou a autenticação OIDC.

## Deploy da aplicação

A imagem ARM contém web, worker, Prisma e dependências de execução TypeScript; o worker
ainda executa com `tsx`. A imagem mantém as dependências de desenvolvimento necessárias
a esse formato inicial. Segredos e arquivos `.env*` ficam fora do contexto Docker.
ECR usa tags imutáveis; o deploy seleciona sempre o digest, nunca `latest`.

Antes do primeiro deploy, configurar por stack:

```sh
pulumi config set appUrl https://SEU-DOMINIO --stack staging
pulumi config set emailFrom 'Lazuli <noreply@SEU-DOMINIO>' --stack staging
# Em prod, também configurar emailFrom verificado e a chave Resend.
pulumi config set --secret resendApiKey --stack prod
```

Aplicar a stack após configurar. `appUrl` habilita entrada 80/443, e o DNS deve apontar
para o Elastic IP correto. Caddy obtém/renova TLS; banco e SSH continuam privados.
Staging usa exclusivamente Mailpit. Tokens Hatchet já estão no SSM por ambiente.

Ordem do deploy:

1. EC2 ligada e acessível via SSM; baixar imagem e gerar arquivo de ambiente privado.
2. Preflight remoto: recusa URL HTTPS e segredos necessários ausentes antes de qualquer migração.
3. Runner abre túnel SSM para RDS e executa Prisma usando a role SQL **owner**. O hostname
   do certificado é preservado; a resolução para localhost ocorre só no container de migração.
   Credencial temporária fica em arquivo 0600 no runner, removido ao encerrar. A EC2 não
   recebe acesso ao parâmetro de migração. Nenhum seed é executado.
4. Revogar acesso do runtime a `_prisma_migrations`, conferir TLS e conexão do runtime.
5. Parar web/worker antigos, guardar containers anteriores e iniciar os novos.
6. Conferir `/login`, registro inicial do worker no Hatchet e HTTPS público.

Há breve indisponibilidade durante a troca. Em falha de startup/healthcheck, o script
restaura os containers anteriores. **Não desfaz migrações:** elas precisam ser compatíveis
com a versão anterior. Falhas de migração param o deploy antes da troca de containers.
O marcador do worker comprova registro inicial; não substitui um job real nem monitoramento
contínuo de conexão. Smoke funcional de negócio e teste de restauração continuam separados.

Staging não é iniciado automaticamente pelo deploy: ligar pela stack e, ao terminar os
testes, voltar `running=false` e aplicar. Esse estado deve ser versionado para evitar drift.
Disco e Elastic IP continuam cobrados enquanto a EC2 estiver desligada. Imagens ECR também
ocupam armazenamento; não há expiração automática que possa apagar uma imagem de rollback.

## Evidência desta implementação

Ver `../HANDOFF.md` para resultados reais e pendências. O apply sem mudanças e o smoke
em staging passaram no GitHub. O deploy completo ainda depende de domínio,
OAuth/decisão de autenticação e Resend, além de validar migração e execução real de web/worker.
