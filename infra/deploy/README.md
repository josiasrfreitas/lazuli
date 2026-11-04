# CI de infraestrutura e deploy

## Fluxo

- `Infrastructure preview`: PR interno para `main` com alterações em infra, workflow ou
  dependências executa `pulumi preview` nas stacks `shared`, `staging`, `prod`, `billing`
  e `automation`. Resultado no resumo de cada job. Forks e Dependabot não recebem segredos.
- `Infrastructure apply`: acionamento manual em `main`, escolha de stack. Gera um plano
  novo e aplica esse mesmo plano/revisão. Não aplica automaticamente ao fazer merge.
- `Deployment image`: PR compila a imagem ARM completa sem credenciais AWS.
- `Deploy application`: automático após a CI aprovar um push em `main`, somente quando
  `CD_TARGET_ENVIRONMENT` no repositório for `prod` (ou `staging` durante o teste do CD).
  Sem essa variável, não há deploy automático. O modo automático implanta a aplicação
  completa da revisão aprovada pela CI. O acionamento manual em `main` continua disponível:
  escolhe `staging`/`prod`, `smoke`/`application` e opcionalmente um SHA completo. O SHA
  precisa pertencer a `main` e ter a CI aprovada. Para experimentos, o workflow manual
  também pode rodar numa branch `staging/*` e publicar somente em staging, sem exigir CI.
  O build ARM acontece no GitHub; o environment e a role AWS continuam limitados a staging.
  Produção mantém a regra de revisão de `main` aprovada pela CI. Uma revisão automática já
  substituída em `main` é ignorada antes de assumir a role AWS.

Para publicar um experimento após enviar uma branch `staging/*` ao GitHub:

```sh
gh workflow run deploy.yml --ref staging/perf-227 -f environment=staging -f mode=application
```

O resumo do job registra o SHA exato selecionado. Esse caminho não usa Colima nem faz
build na máquina local; ainda aplica as migrações da imagem selecionada e verifica web/worker.

Para validar o CD sem afetar produção, definir temporariamente
`gh variable set CD_TARGET_ENVIRONMENT --body staging`, integrar uma mudança pequena em
`main` e conferir o deploy completo. Remover a variável após o teste com
`gh variable delete CD_TARGET_ENVIRONMENT`. Quando domínio/remetente Resend, stack e
primeiro deploy manual de produção estiverem validados, definir a variável como `prod`.
O deploy automático não executa `pulumi up`; alterações de infraestrutura devem ser
aplicadas antes de reativar o CD para produção.

Os jobs elegíveis de escrita compartilham `concurrency: aws-operations`, sem interromper o
job em execução. O GitHub mantém só um job pendente por grupo; um novo pendente pode
substituir o anterior. Conferir o histórico e reexecutar uma operação manual substituída.
Não iniciar uma operação local enquanto houver uma aplicação pela CI.
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
# Para entregar mensagens reais em staging, verificar o domínio do remetente
# e configurar uma chave Resend própria, limitada a esse domínio.
pulumi config set --secret resendApiKey --stack staging
# Em prod, verificar send.fisklagarto.com.br e usar outro remetente/chave Resend.
# O remetente previsto é Lazuli <noreply@send.fisklagarto.com.br>.
pulumi config set --secret resendApiKey --stack prod
```

Aplicar a stack após configurar. `appUrl` habilita entrada 80/443, e o DNS deve apontar
para o Elastic IP correto. Caddy obtém/renova TLS; banco e SSH continuam privados.
Staging usa Resend quando sua chave está configurada; sem ela, usa o Mailpit privado.
Produção exige Resend. Tokens Hatchet já estão no SSM por ambiente.

Ordem do deploy:

1. EC2 ligada e acessível via SSM; baixar imagem e gerar arquivo de ambiente privado.
2. Preflight remoto: recusa URL HTTPS e segredos necessários ausentes antes de qualquer migração.
3. Runner abre túnel SSM para RDS e executa Prisma usando a role SQL **owner**. No Linux da CI,
   o hostname do certificado é preservado; a resolução para localhost ocorre só no container de
   migração. A credencial temporária fica em arquivo 0600 no runner, removido ao encerrar. No Mac,
   a migração usa o Node local pelo mesmo túnel, com CA verificada e destino fixado pelo SSM;
   a credencial fica apenas no ambiente do processo filho. A EC2 não recebe acesso ao parâmetro
   de migração. Nenhum seed é executado.
4. Revogar acesso do runtime a `_prisma_migrations`, conferir TLS e conexão do runtime.
5. Parar web/worker antigos, guardar containers anteriores e iniciar os novos.
6. Conferir `/login`, registro inicial do worker no Hatchet e HTTPS público.

Há breve indisponibilidade durante a troca. Em falha de startup/healthcheck, o script
restaura os containers anteriores. **Não desfaz migrações:** elas precisam ser compatíveis
com a versão anterior. Falhas de migração param o deploy antes da troca de containers.
Antes de baixar uma imagem nova, o host remove imagens Docker sem contêineres associados;
as imagens da versão ativa e do contêiner anterior reservado para rollback permanecem.
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
