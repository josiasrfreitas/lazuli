---
target_identity: "file:/Users/josiasribeiro/orca/lazuli/apps/web/src/features/stage-catalog"
timestamp: 2026-11-19T22-41-01Z
slug: apps-web-src-features-stage-catalog
closed: true
---
# Catálogo e editor de estágios

Avaliação inicial independente de interface e inspeção mecânica, antes do refactor. Referências: capturas 390 px e desktop do handoff, implementação atual e composição em f0f0bfe2.

| Heurística | Nota / 4 | Evidência |
| --- | --- | --- |
| Estado | 3 | O total de minutos e a gravação têm feedback. |
| Vocabulário | 3 | Lição e hora-aula acompanham o livro. |
| Controle | 1 | Recolher a hora ou trocar de unidade desmonta os campos. |
| Consistência | 2 | O gradiente termina abruptamente na hora expandida. |
| Prevenção | 2 | A distribuição é validada ao salvar. |
| Reconhecimento | 2 | O lápis isolado e os destinos de inserção idênticos exigem interpretação. |
| Eficiência | 2 | Os campos numéricos ocupam meia coluna. |
| Hierarquia visual | 1 | Metadados, campos e grupos têm pesos semelhantes. |
| Recuperação | 3 | Há foco no campo inválido, mas a soma dos minutos gera erro global. |
| Orientação | 2 | Páginas e total precisam de agrupamento mais claro. |

Total inicial: 21/40. Os detectores geral, de tipografia e de layout retornaram zero ocorrências.

## Priority Issues

1. Unificar a superfície de leitura e compactar as tracks.
2. Aproximar identificação, referências e páginas. Alinhar durações em coluna curta e tornar o total legível.
3. Distinguir destinos de inserção e expor a ação Editar.
4. Recuperar espaço no celular e proteger o texto durante a navegação entre horas e unidades.

Preservar os códigos do livro, o filtro com contagem de provas, os controles de gravação e a posição de inserção.
