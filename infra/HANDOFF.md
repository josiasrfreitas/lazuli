# Handoff — infraestrutura Lazuli

Estado em 23/10/2026. Alterações **sem commit**; preservar o trabalho existente.
Ver [operação Pulumi](pulumi/README.md), [ambientes](README.md),
[integrações](INTEGRATIONS.md) e [ADR 0025](../docs/decisions/0025-use-aws-for-managed-infrastructure.md).

## Decisões do proprietário

- Conta AWS `413781344359`, perfil `lazuli`, projeto AWS Settings “Make It Happen”.
  Região **`us-east-2` (Ohio)** confirmada; o proprietário autorizou continuar nela.
- Uma EC2 por ambiente (`staging`/`prod`) e um RDS PostgreSQL compartilhado, com
  bancos `lazuli_staging`/`lazuli_prod` e usuários separados. Não usar apenas schemas.
- Staging fica ligado só para testes, com Mailpit privado. Produção usa Resend.
- Estimativa discutida: US$ 45–50/mês com staging 100 h/mês, antes de impostos.
  Os preços consultados de EC2/RDS/disco RDS são iguais em Ohio e Virgínia.
- Provisionar e verificar **uma etapa por vez**. Checks completos de lint/typecheck
  e outros checks pesados ficam para o CI; não iniciar processos Turbo em paralelo.
- O proprietário considera remover Google OAuth da v0, mas o código ainda o exige.
  Não remover implicitamente como parte do provisionamento. Domínio ainda não informado.

## Recursos existentes

- Backend S3 `lazuli-pulumi-state-413781344359-us-east-2` criado pelo bootstrap,
  privado, criptografado e versionado. Backend fixado no `Pulumi.yaml`.
- Stack `shared`: rede criada (VPC, duas subnets privadas RDS, duas subnets de aplicação,
  rotas, Internet Gateway, grupos de segurança e parâmetros PostgreSQL). O resumo
  da aplicação inicial registrou 18 recursos criados. **O RDS foi criado na retomada
  após upgrade (9m16s), com os sete dias de backup.** Endpoint privado:
  `lazuli-shared-postgres.cjuwe86gk6cf.us-east-2.rds.amazonaws.com`.
- Erro inicial do RDS: `FreeTierRestrictionError`, retenção de sete dias excedia o máximo
  permitido no plano gratuito. O upgrade para plano pago por uso foi concluído. **Consulta posterior `aws freetier get-account-plan-state` confirmou
  PAID/ACTIVE, com US$ 139,99 de créditos na consulta mais recente.** RDS foi criado. Não pedir upgrade novamente.
- Foi discutida alternativa de dump diário para S3 com retenção menor no RDS, mas
  **essa alternativa não foi escolhida nem implementada**. Não alterar retenção sem
  resolver a escolha. A configuração atual mantém sete dias e o check exige isso.
- Stack `staging` aplicada: bucket `lazuli-staging-private-files-dc8dd46`.
- Stack `prod` aplicada: bucket `lazuli-prod-private-files-dd8942f`.
- Ambos os buckets passaram no check real de privacidade, criptografia, ownership,
  TLS e escrita/leitura/exclusão de objeto temporário. Teste usa identidade do operador;
  O teste posterior na EC2 staging também confirmou acesso próprio e negação cruzada
  de bucket e parâmetros SSM, incluindo negação aos parâmetros de migração.
- Stack `billing` aplicada e confirmada via API: US$ 20/mês para a conta inteira,
  alertas ACTUAL 50/80/100 e FORECASTED 100. Destinatário já configurado foi
  criptografado na configuração local ignorada; não imprimir nem versionar o endereço.

## Pulumi e credenciais

A sessão AWS foi renovada com autorização prévia. Confirmar conta e backend ao retomar.
A passphrase do estado está em `~/.config/lazuli/pulumi-passphrase`, permissões 0600.
Não imprimir seu conteúdo. Guardar cópia segura fora da máquina antes de produção.

```sh
export AWS_PROFILE=lazuli
export AWS_REGION=us-east-2
export PULUMI_CONFIG_PASSPHRASE_FILE="$HOME/.config/lazuli/pulumi-passphrase"
cd infra/pulumi
pulumi stack ls
pulumi preview --stack shared
```

As stacks estão no backend S3 real: não executar `stack init` novamente para as existentes.
Não destruir/recriar a rede. A senha administrativa do RDS é
gerenciada pelo próprio RDS no Secrets Manager; apenas o ARN é exportado.

## Código preparado e trabalho restante

- `shared.ts`: PostgreSQL 16, `db.t4g.micro`, Single-AZ, 20 GB gp3 criptografados,
  TLS obrigatório, sete dias de backups, proteção de exclusão e snapshot final.
  PostgreSQL 16, classe e AZs `us-east-2a/b` foram consultados com sucesso na conta.
- `compute.ts`: EC2 por ambiente com Docker/cliente PostgreSQL, SSM sem SSH público,
  IMDSv2, disco criptografado, IP fixo e IAM para objetos no bucket próprio.
  Inclui Mailpit em staging, preso ao localhost e à rede Docker.
  **Aplicado nas duas stacks.** Staging validado via SSM: bootstrap concluído, Docker,
  Mailpit saudável e portas 1025/8025 somente localhost. Ativação `enableCompute=true`,
  `amiId` e `running=true` por stack. AMI AL2023 ARM64 consultada: `ami-0f8aca463a279d950`.
- Senhas owner/runtime e BETTER_AUTH_SECRET geradas separadamente nas configs Pulumi
  criptografadas de staging/prod. O módulo compute cria parâmetros SecureString e limita
  a role de runtime aos parâmetros próprios; não usa AmazonSSMManagedInstanceCore
  porque essa política permite ler parâmetros de todos os ambientes.
- `initialize-databases.mjs` preparado para túnel SSM localhost:15432 com CA RDS e
  verificação de hostname, usuários/bancos separados e testes negativos de CONNECT.
  Executado com sucesso: ambos os runtimes conectam com TLS ao próprio banco e recebem
  negação SQL ao outro ambiente e ao banco administrativo. Roles owner/runtime separadas,
  extensões instaladas. RDS não permite ALTER de atributos reservados de superuser; o
  script verifica que esses atributos estão desativados e altera apenas atributos permitidos.
  Plugin Session Manager instalado em `~/.local/bin`, versão
  1.2.896.0. Acrescentar esse diretório ao PATH ao abrir o túnel.
- Não há aplicação implantada, portas HTTP abertas, migrações aplicadas, TLS HTTP,
  monitoramento operacional ou teste de restauração remoto. URLs de banco e auth secrets
  estão em SSM SecureString; demais integrações e injeção no deploy ainda pendentes.
- Próximo: concluir deploy, migrações e teste de restauração. Staging deve ficar parado
  fora dos testes (`running=false`); disco/IP persistem e continuam sendo cobrados.
- Preflight remoto usa Ohio, exige HTTPS, Google OAuth, namespaces Hatchet distintos,
  bancos e buckets corretos; rejeita credenciais AWS estáticas e recursos locais.

## Integrações externas

- Hatchet: uma organização com dois tenants (`staging`/`prod`). Sem cartão só há um
  tenant, 2.000 execuções/eventos por dia; com cartão pay-as-you-go há dez tenants e
  franquia de 1 milhão de execuções/eventos por mês, com excedentes cobrados.
  Tokens recebidos em `.env.hatchet` (ignorado, modo 0600): `STAGING` e `PRODUCTION`.
  Ambos autenticados com consulta somente leitura via CLI; tenants distintos confirmados.
  Perfis CLI `lazuli-staging` e `lazuli-prod` configurados. Token em config Pulumi
  `hatchetToken` criptografada e SSM `/lazuli/{ambiente}/runtime/HATCHET_CLIENT_TOKEN`.
  Aplicado e conferido nas duas stacks. Na EC2 prod, leitura do token próprio aprovada
  e leitura do token staging negada. Staging permaneceu desligado; nova leitura pela
  instância será conferida ao ligá-la para deploy. Nenhum workflow disparado; teste do worker pendente.
- Resend: chave privada em `.env.resend.local`; falta domínio verificado e remetente real.
  Desenvolvimento local continua com Mailpit. Não reutilizar chave em staging.
- Domínio e decisão final de autenticação continuam pendentes.

## Validação

- Passaram nesta retomada: typecheck de `@lazuli/infra`, cinco testes focados do preflight
  (incluindo rejeitar Virgínia), sintaxe dos scripts, formatação e `git diff --check`.
- Previews reais passaram; buckets foram aplicados e seus checks reais passaram.
  RDS criado e `check-shared.mjs` aprovado; SQL/TLS e isolamento de ambos os bancos
  aprovados. Teste de restauração ainda pendente.
- Lint/typecheck completos, build e suítes amplas não foram executados; ficam para CI
  conforme pedido. Não relatar como aprovados.

## Histórico do diagnóstico regional

As primeiras tentativas em `us-east-1` receberam negação explícita da SCP `p-kmo9bxee`
(organização `o-2c0cdgwop9`, gerenciamento `685459860280`). Descobriu-se que a experiência
AWS Settings restringe o projeto à região escolhida, Ohio. Não é necessário alterar essa
SCP para os recursos já criados em Ohio. Nenhuma política da organização foi alterada.

## EC2 desta retomada

- Staging: `i-0597e6be1566e447b`, IP `3.22.138.20`. Bootstrap e IAM aprovados;
  desligado via Pulumi (`running=false`) e confirmado pela API EC2.
- Produção: `i-0e01b9109a88a3603`, IP `18.225.229.89`. Stack aplicada; IAM aprovado (parâmetros próprios e bucket, com negação cruzada).
  Bootstrap, Docker e CA RDS aprovados via SSM. Produção permanece ligada.
- Ambas as EC2: t4g.small, IMDSv2 obrigatório, hop limit 2 e disco gp3 20 GB
  criptografado confirmados pela API. Typecheck de infra e `git diff --check` passaram.
- Túnel SSM de inicialização SQL encerrado.

## CI de infraestrutura e deploy — implementação em andamento

- Workflows locais: `infra-preview.yml` (PR interno, cinco stacks), `infra-apply.yml`
  (`workflow_dispatch`, main, plano novo seguido de up do mesmo plano), `image-check.yml`
  (build ARM sem credenciais) e `deploy.yml` (manual, staging/prod, smoke/application).
- Deploy exige SHA em main com CI aprovada. Infra apply e deploy compartilham a fila
  `aws-operations`; operações em execução não são canceladas por outra execução.
- Após o proprietário ativar “Advanced features”, `iam:ListOpenIDConnectProviders`
  passou. A stack `automation` foi inicializada e aplicada: provedor GitHub OIDC,
  quatro roles e respectivas políticas. Nenhuma access key foi criada.
- `configure-github.mjs` configurou environments limitados a `main`, variáveis de
  roles e secrets por stdin. Workflows ainda precisam ser publicados e executados.
- ECR `lazuli/staging` e `lazuli/prod`, permissões de pull e SSM runtime/CONFIG aplicados.
  Configuração runtime ainda não contém appUrl/OAuth/Resend. Deploy completo para no
  preflight antes de migrar o banco quando essas configurações faltam.
- Dockerfile único web/worker/migrações, deploy via SSM, migrações pelo túnel privado com
  usuário owner, TLS validado. Containers anteriores preservados para rollback de processo;
  nunca desfazer schema automaticamente. Caddy/portas públicas dependem de appUrl + DNS.
- Worker ganhou marcador de registro inicial no Hatchet para o deploy, sem alterar workflows
  de negócio. Isso não equivale a verificar execução de job real.
- **Teste real pequeno aprovado em staging:** imagem ARM construída usando o contexto Docker
  `colima` (já ativo), enviada ao ECR; o mesmo `run.mjs smoke` usado pela CI executou duas
  versões HTTP (`first`, `second`) via SSM, conferiu respostas e removeu o container.
  Nenhum job, migração ou envio de e-mail foi disparado por esse teste.
- Imagem de smoke preservada no ECR:
  `sha256:965f1bf7226506334cb04da8ac3e41218d1cacf8512c339c2087b5b9eed1cb6d`.
- **Plano/up real sem mudanças aprovado:** staging, 24 recursos sem alterações, com
  `preview --save-plan --expect-no-changes` seguido de `up --plan --expect-no-changes`.
  Plano temporário removido ao encerrar.
- Passaram actionlint 1.7.12, typechecks focados infra/worker, lint dos arquivos alterados
  do worker, sintaxe shell/Node, allowlist de runtime, formatação e diff --check.
  Build completo da aplicação fica na CI; não foi validado por este smoke mínimo.
- Staging foi ligado só para testar, desligado pelo Pulumi e confirmado `stopped` pela API.
  Produção permaneceu ligada; apenas recursos de suporte ao deploy foram aplicados.
- Operação e próximos passos: `infra/deploy/README.md`.
