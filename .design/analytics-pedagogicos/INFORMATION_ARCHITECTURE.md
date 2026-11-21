# Analytics pedagógicos · Arquitetura da informação

A coordenação escolheu a composição A, com navegação por assunto. A rota `/pedagogico/analytics` abre em **Permanência**. O seletor também dá acesso a **Indicadores pedagógicos** e **Espera e PPT**. Cada seção apresenta os controles de tempo e de agrupamento descritos no [briefing](DESIGN_BRIEF.md).

## Alternativas consideradas

| Composição | Primeira leitura | Como investigar | Custo |
| --- | --- | --- | --- |
| A · Por assunto | A página abre em Permanência, com as saídas e a base da virada. Um seletor dá acesso aos outros dois assuntos. | Selecionar uma virada no histórico, abrir os motivos e comparar grupos na própria seção. Ao trocar de assunto, aparecem os controles daquele assunto. | É preciso mudar de seção para consultar indicadores ou espera. |
| B · Resumo da reunião | Na mesma tela, a permanência ocupa o primeiro bloco. Abaixo vêm uma comparação pedagógica e o resumo da fila regular e do PPT. | Expandir o bloco escolhido para consultar as bases e os motivos, mantendo os demais recolhidos. | Exige mais rolagem no celular e mais cuidado para identificar a data de cada resumo. |
| C · Histórico primeiro | A página abre com as viradas em ordem temporal e a permanência em cada uma. | Escolher uma virada abre o relatório do período com saídas, renovação, indicadores e demanda. A fila informa a data da fotografia disponível. | Há uma seleção inicial para quem veio apenas consultar a fila atual. Cortes históricos dependem dos dados disponíveis. |

## Mapa do conteúdo

- Permanência → saídas e base → perfil das saídas por tipo e motivo. Na mesma seção, histórico de renovação por virada, com renovados sobre alunos com vencimento. Escola, professor e faixa etária são recortes. Transferências aparecem no detalhe da base.
- Indicadores pedagógicos → score, frequência, notas ou ocorrências → comparação entre grupos e cobertura. Alterar o indicador preserva período e recorte, e atualiza a unidade. A composição do score fica disponível no detalhe.
- Espera e PPT → fila regular na data indicada e encaminhamentos no período → estágio e motivo da escolha. Identificar escolha direta, motivo desconhecido e ausência de histórico.

## Cenários para comparar as propostas

Em cada composição, usar a mesma demonstração. Primeiro, localizar as perdas de uma virada, explicar o denominador da renovação e consultar um motivo. Depois, comparar score e frequência para o mesmo grupo sem reconstruir os filtros. Por fim, identificar quantos aguardam turma regular em um estágio e quantos foram encaminhados ao PPT por falta de oferta. Conferir se a pessoa distingue as duas referências de tempo.

## Navegação, componentes e crescimento

Manter a entrada atual no menu Pedagógico. Propor o parâmetro secao para permitir voltar ao assunto por link, seguindo a convenção do aplicativo. No celular, manter visíveis a seleção e a data antes do resultado. Trazer o detalhe logo depois da seleção e devolver o foco ao controle ao recolher.

Reaproveitar AnalyticsSections quando houver seletor de assunto, SegmentedControl para opções curtas e SearchSelect para períodos ou professores quando a lista crescer. Manter os gráficos com alternativa textual e o detalhe tabular nos componentes do sistema. Usar rótulos de virada como “2026.1 → 2026.2” e indicar a data consultada da fila. Cada área expõe somente dimensões para as quais há dados.

## Estado da decisão

A estrutura por assunto está aprovada. A validação visual e de navegação no Orca ocorrerá na etapa de protótipo.
