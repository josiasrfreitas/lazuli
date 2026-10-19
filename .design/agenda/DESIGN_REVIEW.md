# Review da agenda — 18/10/2026

Direção: última captura indicada pelo usuário (08:43:10). Horário e situação no topo; ícone de formato e estágio/aluno em destaque; professor; turma/finalidade. Manter essa sequência na visão diária, semanal e expandida. Legenda com texto menor, cores sempre presentes e borda clara apenas quando ativa (ajuste posterior solicitado).

## Achados e mudanças

- A visão diária e a semanal usavam componentes e regras de hierarquia diferentes. Células largas mudavam para colunas, enquanto a semanal destacava primeiro o professor. Ambas agora usam `LessonCardContent`.
- O formato alternava entre ícone e texto conforme a largura. Agora o ícone tem significado estável na legenda e descrição acessível.
- Etiquetas de tipo repetiam a legenda dentro das células e podiam ser ocultadas pela densidade. Foram removidas do conteúdo da célula; cores e filtros de tipo permanecem.
- O espaço dos indicadores de presença ocupava toda a lateral da célula. Agora é reservado apenas na linha do horário; o restante do texto usa a largura disponível.
- Horário, título, professor e contexto mantêm tipografia e ordem. Só horários muito curtos compartilham a última linha entre professor e contexto. Textos extensos truncam sem mudar de posição.
- A expansão existente mede conteúdo cortado. Com a composição única, conferimos pelo Orca: célula legível permaneceu `expanded=false`, sem texto cortado; célula truncada passou a `expanded=true` e deixou de cortar o texto. Não houve necessidade de alterar a regra compartilhada de expansão.

## Evidência visual

Capturas realizadas com o navegador do Orca, em tema escuro. Inspeção nas visões diária e semanal em 1280×800, 768×1024 e 375×812. Nenhuma rescisão ou outra operação de negócio foi executada nesta revisão.

| Captura                                         | Observação                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `screenshots/before-week-desktop.png`           | Hierarquia anterior, com professor primeiro e etiquetas repetidas  |
| `screenshots/after-day-desktop-1280.png`        | Referência aplicada a aulas e atendimentos na visão diária         |
| `screenshots/after-day-tablet-768.png`          | Mesma hierarquia; grade mantém rolagem horizontal                  |
| `screenshots/after-day-mobile-375.png`          | Legenda quebra em linhas e não ultrapassa a página                 |
| `screenshots/after-week-desktop-1280.png`       | Mesmo conteúdo na visão semanal; truncamento nas colunas estreitas |
| `screenshots/after-week-tablet-768.png`         | Mesma sequência e indicadores nas células                          |
| `screenshots/after-week-mobile-375.png`         | Grade navegável horizontalmente; conteúdo preservado               |
| `screenshots/after-week-fits-desktop-1280.png`  | Hover em célula legível não expande                                |
| `screenshots/after-week-hover-desktop-1280.png` | Hover em célula truncada expande e revela os textos                |

## Limites e próximos pontos possíveis

- Ajuste de movimento: a altura `max-content` imediata fazia o texto quebrar repetidamente enquanto a largura animava. A agenda agora mede o conteúdo na largura de destino e anima a altura com os mesmos 350ms e a mesma curva do eixo horizontal. A largura do texto fica estável durante a transição. Captura de quadros pelo Orca mostrou o cartão passando de 63×56px para 249×85px, com os dois eixos em movimento e conteúdo estável; foco por teclado continua imediato. “+Mais” mantém as faixas originais. A medição inicial também aguarda a montagem da grade quando necessário.

- Correção após as capturas de 08:54: eventos de 45 minutos ainda cortavam a última linha depois de expandir a largura. O cartão semanal individual agora pode crescer verticalmente como sobreposição, mantendo a geometria temporal. No Orca, o exemplo de Lara preservou o bloco de 58px e revelou todas as linhas em um cartão de aproximadamente 85px (`screenshots/expanded-short-event.png`). Célula legível permaneceu sem expansão; `+Mais` preservou as seis faixas iguais e as alturas originais.

- A densidade de muitas aulas simultâneas ainda exige truncamento e expansão. A quantidade de colunas e a geometria temporal não foram alteradas.
- A largura mínima da grade mantém rolagem horizontal no tablet/celular; uma experiência semanal específica para toque seria um trabalho separado.
- Tema claro e gestos de toque reais não foram exercitados. Os tamanhos menores foram inspecionados por redimensionamento no Orca.
- Sem suíte de testes, lint ou typecheck, conforme orientação do usuário.
