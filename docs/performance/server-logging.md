# Logs de diagnóstico do servidor

O web e o worker escrevem uma linha JSON por evento na saída padrão, via Pino. Em staging, depois
de publicar esta mudança, consulte os contêineres com `docker logs --since 10m lazuli-web` e
`docker logs --since 10m lazuli-worker`. Os logs locais podem ser filtrados da mesma forma quando
os processos estiverem em contêineres. `LOG_LEVEL` aceita os níveis do Pino; o padrão é `info` em
produção, `debug` em desenvolvimento e `silent` em testes.

Cada linha contém `timestamp` em UTC, `level`, `service_name` e `message`. O middleware do Next
atribui um `x-request-id` novo a cada requisição dinâmica e o devolve na resposta. Os logs de
autenticação, criação do contexto e procedures tRPC dessa requisição usam esse ID. Procedures
registram `procedure`, `procedure_type`, `duration_ms`, `status` e, quando houver, `staff_user_id`.
O painel registra também o tempo e a quantidade de dados iniciais que chegaram. Jobs do worker
usam `job_id` próprio; eles não herdam o ID HTTP.

Não registre entradas tRPC, cabeçalhos, cookies, emails, nomes nem payloads de jobs. Erros internos
guardam código e frames do stack no servidor, sem a mensagem potencialmente sensível; o cliente
continua recebendo a mensagem genérica do formatador tRPC. Cada chamada HTTP da navegação tem um
ID próprio. Para o p95 do clique até a tela pronta, mantenha o benchmark no navegador e use os
logs para decompor a parcela do servidor; timestamps isolados não medem a pintura final.
