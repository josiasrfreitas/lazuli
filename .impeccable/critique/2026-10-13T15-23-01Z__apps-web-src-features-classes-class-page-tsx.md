---
target: turmas/id — operacao-pedagogica — desktop only
total_score: 26
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica/apps/web/src/features/classes/class-page.tsx"
target_fingerprint: "sha256:d3d14d9e2bb03e5218fc50a76ed9869a10d6fd719a6976de61b92a3b5c65ca28"
target_path: /Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica/apps/web/src/features/classes/class-page.tsx
timestamp: 2026-10-13T15-23-01Z
slug: apps-web-src-features-classes-class-page-tsx
---

Method: dual-agent (A: /root/design_review · B: /root/detector_review)

Crítica de turmas/[id] em operacao-pedagogica, após reiniciar o servidor.
Turma inspecionada: REG 14:00 · 5.
Modo: Operate. Escopo final: 100% desktop, 1440×900/1000. Achados móveis excluídos por instrução do usuário.

O problema central é a composição: a página empilha informações e análises antes de permitir trabalhar com os alunos. Minha recomendação é redesenhar a hierarquia, preservando os componentes que já funcionam. A preferência expressa pelo usuário é de insatisfação com o design atual.

Especificidade e impressão
A identidade azul-marinho, a tipografia e a linguagem escolar dão personalidade. Entretanto, resumo, rotina, desempenho e alunos parecem blocos independentes. O gráfico recebe o protagonismo, enquanto a tarefa administrativa fica no fim da página.

Heurísticas (0–4; maior é melhor)
| Heurística | Nota | Evidência principal |
|---|---:|---|
| Estado do sistema | 3 | Carregamento e erros claros; sucesso depende de fechar/atualizar. |
| Linguagem do usuário | 3 | Vocabulário escolar; etapa/estágio variam. |
| Controle e liberdade | 3 | Voltar, cancelar e links para perfis. |
| Consistência | 3 | Componentes coerentes; seções sem prioridade clara. |
| Prevenção de erros | 3 | Validação presente; matrícula perde o contexto da turma. |
| Reconhecimento | 2 | Contadores não identificam alunos que precisam de atenção. |
| Eficiência | 2 | Busca e lista ficam depois do painel analítico. |
| Hierarquia e economia visual | 2 | Grandes caixas com informação esparsa. |
| Recuperação de erros | 3 | Retentativas; falha das opções de matrícula sem recuperação local. |
| Ajuda contextual | 2 | Explicações presentes, mas falta caminho da pendência à ação. |
| Total | 26/40 | Aceitável; precisa de revisão estrutural. |

O que funciona

- Matricular aluno é uma ação principal clara.
- A lista usa nomes completos, links para os perfis e colunas consistentes.
- A lotação diz “25 de referência”; o gráfico oferece valores textuais e quantidade de alunos.

Prioridades

1. P1 — Alunos ficam depois de uma longa introdução.
   No desktop a lista não aparece na primeira tela. Resumo, faixa de rotina e análise disputam espaço antes da busca.
   Impacto: toda consulta a um aluno exige atravessar informação que pode não ser relevante naquele momento.
   Proposta: resumo compacto e uma área principal de trabalho; lista e busca acessíveis cedo; desempenho em uma visão própria ou expansão. Integrar Planejamento/Aulas à navegação local. Comando: $impeccable shape.
   Fonte: apps/web/src/features/classes/class-page.tsx:43; class-overview.tsx:69.

2. P1 — O painel mostra problemas, mas não leva às pessoas.
   A turma exibe 1 aluno abaixo do corte e 4 com notas incompletas. Os números são estáticos; não abrem os alunos correspondentes. O seletor de comparação exige procurar individualmente.
   Impacto: a página cria uma preocupação sem oferecer um caminho direto para resolvê-la.
   Proposta: contadores que abram os grupos de alunos, com pendência específica e próxima ação; gráfico agregado como informação secundária. Comando: $impeccable shape.
   Fonte: apps/web/src/features/assessments/class-performance.tsx:66 e :96.

3. P2 — A composição dá peso parecido a informações muito diferentes.
   O cartão de professor/horários/lotação tem muito espaço vazio; dois links recebem outra faixa inteira; o desempenho ocupa um terceiro grande painel.
   Impacto: a leitura recomeça a cada caixa, sem um centro claro de trabalho.
   Proposta: retirar molduras que não representam tarefas distintas, compactar metadados e estabelecer uma região dominante. Comando: $impeccable layout.
   Fonte: apps/web/src/features/classes/class-overview.tsx:69; class-page.tsx:46.

4. P2 — A matrícula não informa a turma de destino.
   O diálogo mostra aluno e data; o nome da turma desaparece atrás do fundo desfocado.
   Impacto: a confirmação depende da memória, especialmente após interrupções.
   Proposta: mostrar turma e estágio no próprio diálogo e preservar aluno/destino/data na confirmação. Comando: $impeccable clarify.
   Fonte: apps/web/src/features/classes/membership-dialog.tsx:191.

Carga cognitiva e perfis
Carga moderada: foco dividido, hierarquia fraca e contexto da matrícula dependente de memória.

- Alex, usuário frequente: busca distante e contadores de pendências sem acesso direto.
- Jordan, iniciante: não sabe quais alunos têm notas incompletas; destino ausente na matrícula.
- Sam, acessibilidade: tabela e valores textuais ajudam, mas valores do aluno comparado precisam de equivalente textual; não houve auditoria com leitor de tela.
  A entrada é calma, mas a descoberta de pendências não termina numa ação clara.

Observações menores
Uniformizar professor/docente e etapa/estágio. Explicar a linha de corte do gráfico. Turmas personalizadas agregam estágios por padrão no código; esse caso não foi inspecionado ao vivo.

Detector
CLI e detector injetado no navegador: 0 achados. Nenhuma marcação de problema foi gerada. Isso não certifica usabilidade nem acessibilidade.

Perguntas para orientar o redesenho

- O centro da página deve ser alunos e vínculos, pendências pedagógicas ou rotina de aulas?
- O próximo passo deve explorar três composições diferentes ou corrigir apenas a hierarquia atual?
