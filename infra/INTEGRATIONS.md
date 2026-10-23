# Integrações necessárias para staging e produção

Decisão em 23/10/2026: EC2 por ambiente e RDS compartilhado com dois bancos/usuários.
A rede da stack `shared` e os buckets staging/prod foram aplicados. RDS criado com sete dias de backup; bancos e isolamento SQL validados. Deploy da aplicação pendente.

Esta lista cobre o primeiro deploy remoto. A [matriz dos ambientes](README.md) explica o
isolamento. Nada aqui indica que o serviço já esteja provisionado.

| Serviço                    | Staging                                                       | Produção                                                           | Próximo passo                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWS Organizations e Pulumi | Stack e bucket S3 próprios                                    | Stack e bucket S3 próprios; orçamento de US$ 20 para a conta       | Ohio confirmado; backend criado. Plano pago ativo; RDS com sete dias de backup criado e Budget verificado.                                              |
| Hospedagem AWS             | Web, worker e Mailpit desligáveis fora dos testes             | Web e worker contínuos                                             | Implementar EC2 por ambiente, deploy, TLS, observabilidade, IAM e controle de staging. `compute.ts` já cria EC2/IAM; staging validado.                  |
| PostgreSQL                 | Banco `lazuli_staging`, usuário próprio; backup compartilhado | Banco `lazuli_prod`, usuário próprio; backup compartilhado         | RDS, bancos, extensões e isolamento validados; migrações e restauração pendentes. Não copiar dados reais para staging sem anonimização.                 |
| Domínio e DNS              | URL HTTPS própria para o app e os links de login              | URL HTTPS própria, mais subdomínio de envio                        | Escolher o domínio; então criar DNS, TLS e os endereços definitivos. O domínio ainda não foi escolhido.                                                 |
| Autenticação da v0         | Magic link para equipe pré-cadastrada via Mailpit             | Magic link para equipe pré-cadastrada via Resend                   | Google OAuth foi adiado; testar envio e verificação de links após o deploy da aplicação.                                                                |
| Resend                     | Sem chave; e-mail capturado no Mailpit                        | Domínio de envio verificado, `RESEND_API_KEY` e `EMAIL_FROM` reais | A chave já existe em arquivo privado local `.env.resend.local`; após escolher o domínio, verificar DNS/remetente e injetar a chave somente em produção. |
| Mailpit                    | Instância privada e `SMTP_HOST`/`SMTP_PORT=1025` próprios     | Não usar                                                           | Criar Mailpit junto à hospedagem de staging e restringir a caixa aos operadores, pois mensagens podem conter links de login.                            |
| Hatchet                    | Projeto/token próprio e namespace `lazuli-staging`            | Projeto/token próprio e namespace `lazuli-prod`                    | Tenants distintos e tokens validados, armazenados no SSM via Pulumi. Falta injeção no deploy e teste do worker.                                         |
| Segredos                   | Cofre/identidade próprios                                     | Cofre/identidade próprios                                          | Gerar `BETTER_AUTH_SECRET` distinto e guardar URLs, tokens e chaves de cada ambiente fora do Git; conceder acesso apenas ao runtime correspondente.     |

O portal SGF aparece em variáveis locais, mas a integração remota não está pronta; não
tratá-lo como serviço já configurado. O uso futuro de provedores externos pode exigir
novas credenciais, conforme as funcionalidades forem implementadas.
