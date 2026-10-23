# Infraestrutura AWS do Lazuli

Este projeto Pulumi (`lazuli`) começa pelo recurso já decidido na [ADR 0025](../../docs/decisions/0025-use-aws-for-managed-infrastructure.md): buckets S3 para arquivos privados. A região padrão é `us-east-2`, confirmada no projeto AWS Settings “Make It Happen”. As stacks `staging` e `prod` criam buckets distintos; `billing` cria um orçamento mensal para a conta toda. O [mapa dos ambientes](../README.md) registra as demais dependências e o que falta implementar.

Este workspace usa TypeScript 6 porque o runtime TypeScript integrado do Pulumi ainda não executa programas com o compilador TypeScript 7 usado pelo restante do monorepo.

Cada bucket bloqueia as quatro formas de acesso público, desativa ACLs, usa criptografia SSE-S3 e recusa HTTP. Todos os seus recursos têm proteção contra exclusão pelo Pulumi. O nome físico é gerado pelo Pulumi e sai no output `bucketName` da stack correspondente; configure esse valor em `S3_BUCKET` no web e no worker daquele ambiente. Em AWS, deixe `S3_ENDPOINT` ausente e configure `AWS_REGION=us-east-2`. O código da aplicação usa a cadeia de credenciais do SDK: a identidade de execução tem de `s3:GetObject`, `s3:PutObject` e `s3:DeleteObject` nos objetos autorizados do próprio bucket.

Não há política de retenção ou versionamento nesta primeira stack: essas regras precisam acompanhar o plano de recuperação e exclusão de documentos de alunos. O bucket não é um backup. A stack `shared` agora define rede e RDS; identidade de execução e EC2 estão implementadas em `compute.ts`. Deploy da aplicação continua pendente.

## Operação

Na raiz do repositório:

```sh
pnpm install --frozen-lockfile
pnpm --filter @lazuli/infra typecheck
```

O backend Pulumi está fixado em `Pulumi.yaml` ao bucket
`s3://lazuli-pulumi-state-413781344359-us-east-2`, para impedir o uso acidental do
backend GCS de outro projeto configurado nesta máquina. Esse bucket de estado precisa
existir antes do primeiro `pulumi stack init`. O script de bootstrap é a única exceção
ao Pulumi, por causa dessa dependência circular: valida a conta e cria um bucket privado,
criptografado e versionado. Execute na raiz:

```sh
AWS_PROFILE=lazuli bash infra/pulumi/bootstrap-state.sh
```

As tentativas iniciais em Virgínia (`us-east-1`) foram negadas pela SCP do projeto.
Em 23/10/2026, a região Ohio foi confirmada no AWS Settings, e o bootstrap concluiu
a criação do backend em `us-east-2`. Os buckets staging/prod também foram aplicados
e verificados. Nenhuma SCP foi alterada.

Depois disso, para criar as stacks com uma sessão AWS válida:

```sh
cd infra/pulumi
export AWS_PROFILE=lazuli
pulumi whoami --verbose
pulumi stack init billing
pulumi config set --stack billing budgetAlertEmail <email-destinatario>
pulumi config set --stack billing aws:allowedAccountIds '["413781344359"]'
pulumi preview --stack billing
pulumi stack init staging
pulumi preview --stack staging
pulumi stack init prod
pulumi preview --stack prod
```

As configurações versionadas de `staging` e `prod` limitam a conta AWS ao ID `413781344359`; altere-as somente ao migrar deliberadamente para outras contas. `Pulumi.billing.yaml` contém o e-mail do destinatário e é ignorado pelo Git porque este repositório é público. Confira `pulumi whoami --verbose` antes de aplicar qualquer stack. O Pulumi [permite fixar o backend no projeto](https://www.pulumi.com/docs/iac/concepts/state-and-backends/).

O orçamento `lazuli-monthly-account` é de **US$ 20/mês para todos os serviços da conta**. Envia alertas de gasto real ao passar de 50%, 80% e 100%, mais um alerta de previsão de 100%. Não interrompe gastos. [Monitoramento e notificações são gratuitos](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/), mas os valores não são em tempo real: a [AWS atualiza o Budgets com atraso](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html). A previsão pode não disparar até existir histórico suficiente. Após aplicar a stack, o destinatário deve [confirmar o e-mail na AWS](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-email-recipients.html).

`pulumi up --stack billing`, `pulumi up --stack staging` e `pulumi up --stack prod` aplicam os previews respectivos. Confira conta, backend e stack antes de cada aplicação. Mantenha o estado Pulumi em um backend compartilhado e protegido antes de operar produção; não versione arquivos de estado nem credenciais. A proteção dos buckets e do orçamento exige uma decisão explícita para qualquer exclusão posterior.

## RDS compartilhado — decisão de 23/10/2026

O proprietário escolheu uma EC2 por ambiente e um RDS PostgreSQL compartilhado.
A stack `shared` possui a VPC e o RDS; desligar staging não interrompe o banco.
As stacks `staging`/`prod` incluem buckets e EC2/IAM quando `enableCompute=true`.
Os bancos lógicos e usuários separados já foram criados e o isolamento SQL foi validado.

O RDS usa PostgreSQL 16 (mesma versão principal do Compose), `db.t4g.micro`, Single-AZ,
20 GB gp3 criptografados, duas subnets privadas e acesso TCP 5432 somente pelos grupos
clientes de staging/produção. As EC2 anexam o grupo cliente do próprio
ambiente e seu grupo de saída. Não há porta do banco aberta à internet nem NAT Gateway.
As zonas `us-east-2a`/`us-east-2b` e PostgreSQL 16 em `db.t4g.micro` foram confirmados na conta.

O administrador `lazuli_admin` tem senha gerenciada pelo RDS no Secrets Manager;
a stack exporta somente o ARN. Nunca usar esse administrador no web ou worker.
Os bancos `lazuli_staging`/`lazuli_prod` e seus usuários foram criados por `initialize-databases.mjs`.
A etapa SQL deve revogar `CONNECT` de `PUBLIC`, limitar cada usuário ao próprio banco
(inclusive impedir conexão a bancos administrativos) e verificar a negação cruzada.
Os usuários não podem receber `rds_superuser`, `CREATEDB`, `CREATEROLE` ou associação
à role do outro ambiente. Migrações e runtime precisam ter privilégios definidos
antes da criação dessas credenciais; não distribuir a senha administrativa às EC2.

### Aplicar e verificar, uma etapa por vez

As negativas de SCP ocorreram em Virgínia (`us-east-1`); as consultas e a criação da
rede funcionaram em Ohio (`us-east-2`). O bloqueio inicial de retenção foi resolvido com o plano pago por uso.
O RDS está criado com sete dias de backup e passou em `check-shared.mjs`.
A partir de `infra/pulumi`:

```sh
export AWS_PROFILE=lazuli
aws sts get-caller-identity
aws rds describe-db-engine-versions --region us-east-2 --engine postgres --engine-version 16
aws rds describe-orderable-db-instance-options --region us-east-2 --engine postgres --db-instance-class db.t4g.micro
aws ec2 describe-availability-zones --region us-east-2
pulumi whoami --verbose
pulumi stack select shared
pulumi preview --stack shared
pulumi up --stack shared
node check-shared.mjs
```

O backend precisa ser o S3 dedicado descrito acima. Inicializar a stack apenas uma vez;
`pulumi stack select shared` retoma uma stack existente. Configurar o provedor de segredos
do backend e guardar sua passphrase fora do repositório; nunca usar uma senha de teste
para o estado remoto.

O check é somente leitura e falha se RDS não estiver disponível ou se configurações
críticas divergirem. Ele **não comprova conexão SQL**: essa verificação precisa partir
da rede privada, via EC2/Session Manager. Não abrir 5432 ao público para testar.
Antes de avançar para produção:

1. Criar bancos e usuários separados por conexão administrativa privada.
2. Conectar com TLS e validação do certificado usando cada usuário; executar `SELECT 1`.
3. Confirmar que o usuário de staging não conecta ao banco de produção e vice-versa.
4. Aplicar migrações primeiro em staging e verificar `pg_trgm`, `btree_gist` e triggers.
5. Restaurar um backup em uma instância isolada, verificar os dados e removê-la após o teste.
6. Somente então configurar web/worker com credenciais próprias e testar seus fluxos.

### Backup e operação

Retenção inicial: sete dias de backups automáticos. Janela diária 06:00–07:00 UTC
(03:00–04:00 em São Paulo); manutenção domingo 07:00–08:00 UTC (04:00–05:00).
TLS obrigatório via `rds.force_ssl=1`. Atualizações menores automáticas; atualizações
maiores exigem mudança explícita. Extended Support pago está desativado.

Há proteção contra exclusão no Pulumi e no RDS, snapshot final obrigatório e retenção
dos backups automáticos ao excluir. Antes de uma exclusão deliberada, escolher um nome
inédito para o snapshot final se `lazuli-shared-postgres-final` já existir.
Não há autoscaling de armazenamento: acompanhar espaço livre antes de atingir 20 GB.

Single-AZ não fornece failover entre zonas. CPU, memória, reinicializações, manutenção
e recuperação são compartilhados entre os dois bancos. Restore de RDS recupera a instância
inteira; para recuperar só um banco, restaurar em outra instância e extrair o banco desejado.
O teste de restauração e os alarmes operacionais ainda estão pendentes.

### Estimativa de custo

Preços consultados em 23/10/2026 para `us-east-2`, sob demanda, sem créditos/impostos:

| Item                                      | USD/mês |
| ----------------------------------------- | ------: |
| EC2 `t4g.small` produção, 730 h           |   12,26 |
| EC2 `t4g.small` staging, 100 h            |    1,68 |
| Dois discos EC2 gp3 de 20 GB              |    3,20 |
| Dois IPv4 fixos mantidos o mês inteiro    |    7,30 |
| RDS `db.t4g.micro`, 730 h                 |   11,68 |
| RDS gp3, 20 GB                            |    2,30 |
| Uma zona DNS                              |    0,50 |
| Subtotal sem segredo e consumos variáveis |   38,92 |

Orçamento de planejamento: US$ 45–50/mês, incluindo uma provisão pequena para segredo
administrativo, S3/estado Pulumi, logs, snapshots e domínio. Não é limite de cobrança:
CPU excedente, transferência, mais armazenamento e backups podem elevar a fatura.
Com staging contínuo, planejar US$ 55–60/mês. Tamanhos ainda precisam ser medidos.
O orçamento `billing` continua em US$ 20 até o proprietário escolher um novo limiar;
não confundir essa configuração com a estimativa aceita para a topologia.

Fontes: [RDS](https://aws.amazon.com/rds/postgresql/pricing/),
[EBS](https://aws.amazon.com/ebs/pricing/), [IPv4](https://aws.amazon.com/vpc/pricing/),
[DNS](https://aws.amazon.com/route53/pricing/),
[Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/).
Tokens Hatchet validados e armazenados no SSM; domínio, OAuth e configuração final do Resend continuam pendentes.

## Estado operacional da implantação

O backend S3 e o RDS em Ohio foram criados e verificados. A conta está PAID/ACTIVE.
Staging tem EC2 validada, Mailpit saudável e IAM testado com a identidade da instância.
Os bancos separados passaram em login TLS e negação de acesso cruzado/administrativo.
Migrações, deploy e teste de restauração continuam pendentes. Ver `../HANDOFF.md`.

A chave de criptografia Pulumi foi gerada em arquivo privado local:
`~/.config/lazuli/pulumi-passphrase` (permissões 0600). Guardar uma cópia segura fora
da máquina antes de operar produção; ela é necessária para recuperar segredos do estado.
Para executar o Pulumi neste computador:

```sh
export AWS_PROFILE=lazuli
export AWS_REGION=us-east-2
export PULUMI_CONFIG_PASSPHRASE_FILE="$HOME/.config/lazuli/pulumi-passphrase"
```

O módulo `compute.ts` prepara EC2 ARM com AMI explícita, Docker, cliente PostgreSQL,
SSM sem porta SSH, IMDSv2, disco criptografado, IPv4 fixo e IAM para o bucket próprio.
Ativar somente após `shared` estar aplicado e validado:

```sh
pulumi config set --stack staging amiId ami-0f8aca463a279d950
pulumi config set --stack staging enableCompute true
pulumi config set --stack staging running true
pulumi preview --stack staging
pulumi up --stack staging
```

`ami-0f8aca463a279d950` foi resolvida do parâmetro público Amazon Linux 2023 ARM64 em Ohio
em 23/10/2026; verificar a imagem antes de uma implantação futura. `prod` usa o mesmo
procedimento com sua própria stack. Verificar `cloud-init`, Docker e SSM antes do primeiro
desligamento. Depois, `running=false` e `pulumi up` param a EC2 sem excluir o disco.
O estado de energia é gerenciado pelo recurso `ec2transitgateway.InstanceState`, nome
exposto pelo provider para a API de energia EC2. IP e disco continuam sendo cobrados.

Não há aplicação ou porta HTTP pública nessa etapa. URLs de banco e auth secrets estão no SSM; o marcador
`/opt/lazuli/host-ready` indica apenas instalação dos pacotes. Deploy e TLS ainda pendentes.
Para verificar cada bucket, executar `node check-storage.mjs staging` (ou `prod`): cria
um objeto de teste com nome único, lê, compara e exclui, além de conferir configuração
privada, criptografia e TLS. Esse teste usa o operador, não comprova o IAM da EC2.

Hatchet: uma organização com dois tenants exige cartão no plano pay-as-you-go. Sem
cartão, o limite é um tenant e 2.000 execuções/eventos por dia. Com cartão, há dez tenants
e franquia mensal de 1 milhão de execuções e eventos, com cobrança de excedentes e outros
consumos conforme [a tabela](https://hatchet.run/pricing). Tokens devem ficar em arquivos
privados ignorados pelo Git; informar seus caminhos ao agente, sem colar valores no chat.
A v0 usa somente magic link; Google OAuth foi adiado. Não configurar credenciais Google
nas stacks para o primeiro deploy.
