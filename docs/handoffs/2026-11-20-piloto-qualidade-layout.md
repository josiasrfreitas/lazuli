# Piloto de qualidade de layout do Lazuli

## Missão e entrega

Implemente e avalie um piloto capaz de detectar regressões de composição em uma listagem operacional e um formulário em modal. Entregue o código dos checks, comandos reproduzíveis e um relatório com resultados observados. Trabalhe até demonstrar quais checks merecem bloquear mudanças e quais servem apenas para revisão. Mantenha o piloto fora do CI obrigatório durante a calibração.

## Preparação

1. Leia AGENTS.md, docs/frontend/README.md, docs/frontend/forms.md e docs/testing/README.md no checkout em que for executar. Inspecione a instrumentação que já existe, os componentes usados pelas telas e os comandos de teste em uso nessa revisão.
2. A EC2 tem um checkout compartilhado em ~/workspaces/lazuli com trabalho em andamento. Use uma worktree própria baseada na revisão integrada que contém os componentes a avaliar. Registre branch e SHA. Verifique dependências, fixtures sintéticas, acesso às telas e disponibilidade do navegador previsto pelo projeto. Se uma dependência do navegador faltar, conclua os testes independentes e identifique as medições pendentes.
3. Selecione uma listagem com dados e um modal com campos curtos relacionados e uma escolha única. Registre rotas, estado inicial, dados sintéticos, papel de acesso e como repetir cada cenário. Se não houver todas as condições em um único modal, use a composição real em uma história de teste para o caso faltante e identifique a cobertura obtida.

## Contratos candidatos

- **Listagem.** Meça a coordenada vertical da primeira linha de dados em relação à área útil do navegador, com rolagem inicial zero. Registre também o início do conteúdo e a altura do cabeçalho para explicar falhas. Mantenha fixtures, zoom, fontes e viewport constantes. Teste o estado vazio separadamente usando a ação ou mensagem principal como referência.
- **Escolha única.** Hipótese do piloto para formulários: até três opções curtas podem ficar em um segmentado de uma linha. Use dropdown a partir de quatro. Exercite opções calculadas em runtime e rótulos longos. Restrinja a regra ao campo de escolha única. Abas, filtros e navegação têm contratos próprios. A orientação escrita atual permite cinco opções e quebra de linha. Documente essa divergência e proponha a atualização junto com os resultados.
- **Campos.** Meça os retângulos dos controles e a largura interna do grupo. Escolha um par concreto como cidade/UF ou dois campos equivalentes da tela. Defina quando devem compartilhar uma linha, qual campo recebe o espaço restante e quando devem empilhar. Considere o rótulo e a máscara. O comprimento máximo isolado não determina a largura correta.
- **Agrupamento semântico.** Percorra uma tarefa realista com campos condicionais e erro de validação. Registre qual informação o operador precisa ver junta, onde a sequência se rompe e qual mudança resolveria o problema. Esse julgamento entra na revisão qualitativa. Só automatize relações específicas que tenham um resultado esperado verificável.

## Experimento

1. Capture a versão de referência em desktop (comece em 1280 × 800), em tela estreita (390 px) e em um modal estreito dentro de uma janela larga. Registre dimensões reais do contêiner. Use os seletores semânticos e data-slot já disponíveis. Prefira medidas do DOM para geometria e use capturas para explicar achados.
2. Calibre limites com exemplos aceitáveis e anote a margem em pixels e a razão de cada limite. Uma tela atual pode já conter o defeito. Nesse caso, construa e revise um controle válido antes de usá-lo como referência. Congele limiares, casos e expectativas antes da rodada de avaliação.
3. Introduza as regressões abaixo, **uma por execução**, em mudanças temporárias da worktree do piloto. Aplique cada falha pelo componente ou fluxo normal, execute exatamente os mesmos checks e reverta somente a mudança experimental. Verifique o diff entre rodadas. Preserve o comando ou patch necessário para repetir cada caso.

| Caso | Alteração deliberada                                                              | Sinal esperado                                                       |
| ---- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| H1   | Aumentar o padding vertical do header até empurrar os dados para metade da janela | Primeira linha excede o limite                                       |
| H2   | Inserir a mesma altura entre header e tabela                                      | Mesma falha, mesmo que a altura do header permaneça igual            |
| C1   | Trocar o dropdown de cinco opções por segmentado                                  | Violação de escolha única, com contagem e campo                      |
| C2   | Carregar seis opções depois da abertura do formulário                             | Mesma violação após estabilização dos dados                          |
| F1   | Fazer o campo curto ocupar toda a linha em modal largo                            | Largura ou posição viola o contrato do par                           |
| F2   | Forçar os dois campos na mesma linha em contêiner estreito                        | Compressão abaixo do mínimo acordado ou overflow                     |
| S1   | Separar um campo condicional do campo que o torna obrigatório                     | Avaliar em revisão qualitativa independente das métricas geométricas |

4. Rode controles válidos: dropdown com seis opções, segmentado com duas opções curtas, campo longo ocupando a linha, campos empilhados em modal estreito e mensagem de erro que ocupa mais de uma linha. Cubra uma variação válida de viewport e uma variante de defeito reservadas para avaliação após a calibração. Não ajuste o detector para esses casos sem registrar outra rodada.
5. Um defeito conta como detectado apenas quando o check correto falha pela razão prevista. Erros de build, autenticação, timeout ou fixture são falhas de execução. Corrija e repita. A saída deve identificar tela, estado, viewport, componente, valor esperado e observado.

## Medição e decisão

- Registre por caso a expectativa, o resultado, o diagnóstico, a duração e eventual instabilidade. Para a parte determinística, calcule sensibilidade (defeitos detectados / defeitos exercitados) e taxa de falso positivo (controles válidos reprovados / controles válidos exercitados). Mostre numeradores e denominadores. Informe casos bloqueados e avalie S1 à parte.
- Meça custo incremental usando o mesmo ambiente e conjunto de telas com o detector ligado e desligado. Separe inicialização a frio e execução aquecida. Faça pelo menos cinco repetições aquecidas por configuração, registre mediana, pior duração e resultados divergentes. Explique se o custo vem de abrir o navegador, preparar dados ou executar as asserções.
- Para avaliar utilidade do diagnóstico, tente corrigir uma regressão usando a saída do check. Registre tempo e informações adicionais necessárias. Na revisão qualitativa, examine capturas de controle e de defeito em ordem embaralhada antes de consultar os rótulos. Registre apontamentos concretos e falsos alarmes.
- Recomende bloqueio inicialmente só para checks com detecção dos defeitos correspondentes, controles válidos aprovados e resultados estáveis. Declare o custo medido e a limitação da amostra. Mantenha sinais ambíguos como diagnóstico. Se um mutante sobreviver, descreva o ponto cego e teste uma correção contra a matriz inteira.

## Conclusão verificável

Entregue localização da worktree e revisão, comandos de reprodução, tabela de casos, medições de custo e recomendação por check. Execute a versão íntegra após a última mutação, inspecione o diff e rode git diff --check. O diff final deve conter apenas o piloto e seus testes intencionais. Separe o que foi demonstrado em tela de produto do que foi exercitado somente em uma história ou fixture.
