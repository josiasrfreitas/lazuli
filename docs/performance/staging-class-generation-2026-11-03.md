# Benchmark de criação de turma e geração de aulas em staging

Medição em 3 de novembro de 2026 no contêiner `lazuli-worker` da EC2 de staging, usando o PostgreSQL RDS de staging. A aplicação hospedada já estava em execução; as otimizações deste worktree **ainda não estavam implantadas**. A amostra foi de 20 execuções sequenciais, após uma execução de aquecimento. Código de referência: `scripts/benchmark-staging-class-generation.mts`. O script agora informa explicitamente o primeiro dia do período para manter a mesma carga de 25 aulas quando a alteração local for implantada; o código atualmente em staging não aceita esse novo campo.

## Método

Cada amostra cria uma turma regular de uma hora aos domingos, registra o pedido de geração, executa o gerador duas vezes e conta as aulas. Tudo ocorre em uma transação explicitamente revertida. O teste exige que a primeira execução grave todas as aulas e que a segunda grave zero. A execução de aquecimento também compara as datas gravadas com todos os domingos do período, excluindo os dias fechados, calculados de forma independente do gerador. O benchmark mede ainda a regeneração de todas as turmas ativas do período atual em uma transação revertida. A contagem de chaves duplicadas é uma consulta de leitura.

Esse método mede o caminho de banco da criação e da geração com o volume e a latência de staging. Não inclui autenticação HTTP, renderização, envio ao Hatchet nem tempo de espera na fila. Os tempos abaixo não são uma comparação antes/depois das alterações locais.

Uma consulta preparatória falhou uma vez com `EAI_AGAIN` ao resolver o endereço do RDS; a repetição e as 20 amostras passaram. A causa dessa intermitência de DNS não foi determinada.

| Operação                       |                            Escala |  Mediana |      p95 |
| ------------------------------ | --------------------------------: | -------: | -------: |
| Criar turma e registrar pedido |                           1 turma | 858,2 ms | 914,9 ms |
| Gerar aulas da nova turma      |                          25 aulas |  18,8 ms |  25,7 ms |
| Repetir geração e contar aulas |               25 aulas existentes |  16,2 ms |  28,5 ms |
| Regenerar período atual        | 32 turmas, 1.604 aulas planejadas | 505,1 ms | 531,4 ms |

A turma de teste teve 25 aulas na primeira execução e nenhuma duplicada na segunda, em todas as 20 amostras. O banco inteiro tinha 36 turmas e 1.793 aulas antes e depois do benchmark; nenhuma turma de teste permaneceu gravada. A consulta encontrou **zero** chaves repetidas de `(turma, horário, data)` entre aulas não excluídas.

Uma auditoria posterior, somente de leitura, confirmou que as 36 turmas têm ao menos uma aula e que as 1.793 aulas não repetem a combinação de turma, data e horário. A tabela de pedidos de geração não contém registros ativos em staging. Portanto, os dados existentes não permitem comprovar o percurso operacional completo entre API, Hatchet e worker. O teste de integração local cobre o processamento do pedido, inclusive duas execuções concorrentes; o benchmark acima executa o gerador diretamente.

## Discrepância observada

O gerador encontrou 17 aulas que acrescentaria ao período atual. Todas pertencem a uma turma de demonstração criada em 30/10/2026 e sem pedido de geração registrado. São as sextas-feiras entre 03/07 e 23/10; as aulas dessa turma começam em 30/10. Esse registro de demonstração não comprova falha no fluxo de criação pela API, mas mostra que uma regeneração do período acrescentaria datas anteriores à criação dessa turma.

O comportamento vem da regra implantada na data da medição: o gerador começa no primeiro dia do período, independentemente da data de criação da turma. O proprietário escolheu uma data de início explícita para novas turmas. A alteração local ainda não está implantada; turmas antigas sem data continuam usando o início do período para preservar a interpretação histórica.

## Oportunidade de desempenho

A criação de turma é a parte lenta desse caminho em staging. A revisão local removeu duas leituras redundantes do professor e reutilizou o período já validado, eliminando três consultas no caminho de criação. Também agrupou escritas por professor ao congelar aulas já iniciadas numa troca de responsável. Essas alterações ainda precisam de medição após implantação para quantificar o ganho em staging.

Na geração das aulas não há consulta por turma nem por data: turmas, períodos e dias fechados são carregados em lote e a inserção usa `createMany`.

## Consultas e escritas dentro de loops

| Fluxo                               | Padrão encontrado                                                 | Decisão local                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Criação de turma                    | Duas leituras redundantes do professor e uma do período por turma | Eliminadas; o período validado é reutilizado.                                                             |
| Nome Portal da turma                | Uma consulta por tentativa de nome, até 50 em caso de colisão     | Uma leitura dos candidatos; preserva a primeira opção livre e o índice único do banco.                    |
| Painel do professor                 | Uma consulta de próxima aula para cada turma                      | Uma leitura para as turmas do professor; mantém o filtro de responsabilidade e a primeira aula por turma. |
| Troca de professor no mesmo dia     | Até duas escritas por aula já iniciada                            | Inserção em lote e atualização agrupada por professor responsável.                                        |
| Lista de alunos                     | Uma consulta de frequência por aluno da página                    | Pendente: cada matrícula tem janela e compensações próprias; agrupar exige preservar esse cálculo.        |
| Leitura de avaliações por professor | Consultas de permissão por percurso                               | Pendente: a checagem considera atendimento, vínculo e substituição; não agrupar sem revisão de acesso.    |
| Revisão de saúde dos alunos         | Transação e bloqueio por aluno                                    | Mantidos para serializar o estado individual.                                                             |

Os ganhos das alterações locais ainda não foram medidos em staging. A leitura única do painel pode transferir mais linhas que a consulta anterior por turma; vale medir esse fluxo após a implantação. Outras escritas por item, como ajustes financeiros e frequência, exigem medição e revisão das invariantes antes de agrupamento.
