# Ambientes e dependências de execução

Para retomar o trabalho em outra sessão, comece pelo [handoff](HANDOFF.md).

Decisão do proprietário em 23/10/2026: uma EC2 por ambiente e um RDS PostgreSQL
compartilhado, com bancos e usuários distintos. Rede e RDS estão definidos na stack
`shared`: rede e RDS aplicados. Bancos/usuários separados criados com isolamento SQL validado. EC2 de ambos os ambientes aplicadas e validadas; deploy da aplicação pendente.

O Lazuli terá dois ambientes remotos: `staging` e `prod`. Ambos executam o build com
`NODE_ENV=production`; `NODE_ENV` não distingue ambientes. O desenvolvimento local continua
usando Docker Compose e buckets separados por worktree. A [stack Pulumi](pulumi/README.md)
já define buckets S3 privados separados e um orçamento de conta; **não há aplicação, banco
ou worker remoto provisionado ainda**.

Os processos remotos recebem `LAZULI_ENV=staging` ou `LAZULI_ENV=prod` e são iniciados
por `pnpm start:remote` (web) e `pnpm start:worker:remote` (worker). Esses comandos validam
as variáveis antes de iniciar. O banco deve chamar `lazuli_staging` ou `lazuli_prod`, o
bucket deve ser o output da stack correspondente e o namespace Hatchet deve ser
`lazuli-staging` ou `lazuli-prod`. O aplicativo também recusa Resend no staging, exige
Resend em produção e rejeita endpoint S3 local em ambos. Essas verificações evitam erros
de configuração conhecidos; o isolamento efetivo de rede e IAM ainda depende dos recursos
de hospedagem e papéis de execução não criados.

A [lista de integrações](INTEGRATIONS.md) separa o que depende de contas e cadastros externos
do que ainda será implementado na AWS.

| Componente         | Staging                                                      | Produção                                                  | Situação                                                                                |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Conta e região AWS | Conta atual, `us-east-2`                                     | Mesma conta atual, `us-east-2`                            | Isolamento por recursos; contas separadas dão limite de permissão e cobrança mais forte |
| Arquivos           | Bucket S3 próprio; nunca compartilhar `S3_BUCKET`            | Bucket S3 próprio                                         | Aplicado e verificado em Ohio                                                           |
| PostgreSQL         | Banco `lazuli_staging` no RDS compartilhado, usuário próprio | Banco `lazuli_prod` no RDS compartilhado, usuário próprio | RDS e isolamento SQL validados; migrações e restore pendentes                           |
| Web e worker       | Capacidade sob demanda, desligada fora dos testes            | Disponível continuamente                                  | EC2/IAM validados; deploy pendente; staging desligado                                   |
| E-mail             | Mailpit próprio, interno, sem `RESEND_API_KEY`               | Resend com domínio verificado, `RESEND_API_KEY` própria   | Mailpit staging saudável; Resend/DNS pendentes                                          |
| Autenticação       | URL e cliente Google OAuth de teste próprios                 | URL e cliente Google OAuth de produção próprios           | Credenciais e domínios pendentes                                                        |
| Hatchet            | Projeto/token e namespace próprios                           | Projeto/token e namespace próprios                        | Tokens validados e no SSM; teste do worker pendente                                     |
| Segredos           | `BETTER_AUTH_SECRET`, URL do banco e tokens próprios         | Outros segredos, sem reutilização                         | SSM SecureString criado; injeção no deploy pendente                                     |

Usar a mesma conta AWS mantém uma fatura simples e evita trabalho administrativo agora, mas
não isola cobrança nem permissões no nível da conta. Os buckets são separados por stack e
os perfis IAM limitam cada runtime ao seu próprio bucket, com negação cruzada testada. Staging e produção têm credenciais separadas. O RDS escolhido compartilha capacidade, manutenção e backups;
a restauração de uma instância recupera os dois bancos. O orçamento de US$ 20 acompanha **toda a conta** e avisa,
sem desligar recursos nem impor teto. Caso haja outros projetos nessa conta, o orçamento
não mede apenas Lazuli; contas AWS separadas seriam o limite mais claro.

## Serviços necessários antes de colocar usuários reais

1. **AWS:** uma EC2 por ambiente e um RDS PostgreSQL compartilhado. A stack `shared`
   define rede privada, RDS criptografado e sete dias de backups. Stack compartilhada e bancos/usuários verificados. Falta concluir
   deploy e validações da aplicação. Testar migrações,
   isolamento e restauração antes de liberar usuários. O worker exige processo contínuo;
   web, worker e Mailpit de staging ocuparão sua EC2. Ver o [roteiro](pulumi/README.md).
2. **Resend:** uma chave foi guardada em `.env.resend.local`, ignorado pelo Git; o `.env`
   voltou a usar Mailpit. `EMAIL_FROM` ainda usa um domínio de exemplo, então o envio real
   não está configurado. Quando houver domínio, verificar o subdomínio de envio e seus
   registros DNS, definir `EMAIL_FROM` e guardar a chave em um cofre para **produção**.
   O código atual envia
   e-mails de login por magic link; outros handlers de e-mail permanecem incompletos. O plano
   [Free](https://resend.com/pricing) informa 3.000 e-mails/mês e 100/dia; esse limite precisa
   cobrir os logins reais. [Resend exige domínio verificado](https://resend.com/docs/dashboard/domains/introduction).
3. **Google OAuth:** configurar clientes separados e URLs de callback HTTPS exatas para cada
   ambiente. O código exige `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` quando
   `NODE_ENV=production`, inclusive em staging. O Google [recomenda projetos separados para
   teste e produção](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
4. **Hatchet Cloud:** tenants/tokens distintos já validados; web e worker do mesmo ambiente usam
   o mesmo token e `HATCHET_CLIENT_NAMESPACE`, nunca o do outro ambiente. O plano
   [pay-as-you-go](https://hatchet.run/pricing) começa grátis, sujeito aos limites atuais.
   Hatchet Lite do Compose é apenas local.
5. **Domínio e DNS:** dois endereços HTTPS distintos, por exemplo `staging.<domínio>` e
   `app.<domínio>`, necessários para cookies, links de login, OAuth e envio Resend. O dono
   confirmou que ainda não escolheu um domínio; nenhum DNS foi criado.

Mailpit captura e-mails em staging, mas deve ficar acessível só a operadores; uma caixa de
teste pode conter nomes e links de login. `SMTP_HOST` aponta ao Mailpit desse ambiente,
`SMTP_PORT=1025`, e `RESEND_API_KEY` fica ausente. Em produção, uma chave Resend seleciona
o provedor; sem ela, o preflight remoto e a criação do transportador falham.
`S3_ENDPOINT` também deve estar ausente nos dois ambientes
AWS, e ambos precisam de `S3_BUCKET` explícito. As variáveis locais em `.env.example` não
são uma configuração pronta para hospedagem.

Não copiar o banco de produção para staging sem plano de anonimização e autorização. Os
metadados no PostgreSQL guardam o nome do bucket/objeto; copiar só o banco também deixaria
referências inválidas, e dar acesso ao bucket de produção quebraria o isolamento.
