# Analytics pedagógicos · Handoff de implementação da V1

A V1 foi implementada em `/pedagogico/analytics`, com **Permanência** como assunto inicial. O controle **Ver demonstração** abre o mesmo painel com casos ilustrativos e três composições para a coordenação comparar. O [plano de tarefas](../../.design/analytics-pedagogicos/TASKS.md) registra a regra da base, os cenários testados e as dependências para os motivos de saída e de encaminhamento. A [implementação do painel](../../apps/web/src/features/pedagogical-analytics/page.tsx) reúne os três assuntos. Os critérios originais de entrega seguem abaixo.

## Primeira entrega

Preparar uma demonstração identificada com os mesmos dados nas alternativas de composição interna. Manter a navegação por assunto já escolhida. Dar destaque a saídas e base na primeira tela. Aplicar a cor semântica aos números, marcas, legendas e resumos. Validar os três percursos abaixo no navegador do Orca, em desktop e celular, nos temas claro e escuro. Registrar a composição escolhida com a coordenação e atualizar o checklist ao concluir cada entrega. Seguir o [guia de frontend](../frontend/README.md).

| Percurso no protótipo | Resultado esperado com dados de demonstração |
| --- | --- |
| Abrir Permanência e selecionar uma virada | Com 20 alunos na base, duas saídas registradas e três transferências internas, mostrar 18 que permaneceram, 90% de permanência e duas saídas. As transferências aparecem no detalhe. Se dez tinham contrato vencendo e seis renovaram até o corte, mostrar 6 de 10 no gráfico de renovação da mesma seção. |
| Abrir Indicadores pedagógicos e trocar score por frequência | Preservar período e agrupamento. Atualizar unidade, valores e cobertura juntos. Uma semana sem chamadas confirmadas aparece como lacuna. Um grupo com registros suficientes e zero ocorrências exibe zero. |
| Abrir Espera e PPT e escolher um estágio | Mostrar separadamente a fila regular na data indicada e os encaminhamentos ao PPT no período. Distinguir quem procurou turma regular, quem escolheu PPT diretamente e quem tem motivo desconhecido. Completar esse motivo depois mantém um único encaminhamento. |

## Sequência e pontos de entrada

O [agrupador #320](https://github.com/josiasrfreitas/lazuli/issues/320) reúne a entrega dentro do [épico #228](https://github.com/josiasrfreitas/lazuli/issues/228). A [página de operações](../../apps/web/src/features/finance-analytics/operations-page.tsx) atende Pedagógico e Comercial. Concentrar as mudanças na entrada pedagógica. Inspecionar também as [consultas atuais](../../packages/api/src/dashboard/operational-analytics.ts) antes de reutilizar um indicador com nome semelhante.

1. **[#321 · Protótipo](https://github.com/josiasrfreitas/lazuli/issues/321).** Partir do seletor de assuntos existente e dos componentes compartilhados. Usar controles pesquisáveis para listas extensas, rótulos acessíveis e um caminho por teclado até os valores de cada gráfico.
2. **[#322 · Permanência](https://github.com/josiasrfreitas/lazuli/issues/322).** Contar alunos distintos. A perda exige saída registrada da escola, inclusive durante a vigência de um contrato. Transferência interna preserva a permanência. Oferecer os recortes escola, professor e faixa etária. A [#318](https://github.com/josiasrfreitas/lazuli/issues/318) cuida dos parâmetros de motivo na rescisão e da decisão explícita de não renovar. Manter saídas históricas sem motivo no total. Um contrato vencido em aberto, sozinho, é insuficiente para registrar churn.
3. **[#323 · Renovação dentro de Permanência](https://github.com/josiasrfreitas/lazuli/issues/323).** A consulta atual de retenção usa matrícula de destino e virada anual. A V1 exige renovação contratual e viradas entre períodos acadêmicos. Partir do vínculo `Contract.renewedFromId` e do [fluxo de renovação](../../packages/api/src/finance/internal/renewal.ts). Contratos longos entram na base de renovação quando vencem. Incluir vencimentos durante o semestre. Uma renovação posterior atualiza o grupo do vencimento original, respeitando a data de corte consultada.
4. **[#324 · Indicadores pedagógicos](https://github.com/josiasrfreitas/lazuli/issues/324).** Usar score como seleção inicial. Oferecer frequência, notas e ocorrências no mesmo explorador, por professor ou faixa etária. Informar cobertura e usar o [cálculo de score do domínio](../../packages/domain/src/student-health.ts). Para cortes históricos, verificar quais componentes têm evidência datada suficiente.
5. **[#325 · Espera e PPT](https://github.com/josiasrfreitas/lazuli/issues/325).** A [tela atual de demanda](../../apps/web/src/features/finance-analytics/placement-demand.tsx) parte da fila e das vagas atuais. A [#319](https://github.com/josiasrfreitas/lazuli/issues/319) trata da captura do motivo estruturado no cadastro ou na alocação. Até existir essa evidência, informar a cobertura disponível. Só atribuir um encaminhamento à demanda por turma regular quando houver registro dessa procura.

## Decisões para fechar com exemplos

Antes de fixar as consultas das respectivas issues, confirmar com a escola a janela da base de cada virada, os limites das faixas etárias e a data usada para calcular a idade. Testar como atribuir um aluno com dois professores ou troca de titular, e como contar quem teve dois vencimentos no semestre. Em ocorrências, “por 100 alunos” continua como proposta de unidade. Resolver cada ponto na fatia correspondente e registrar a decisão na issue.

## Evidência de entrega

Conferir os totais da demonstração com contagem independente e cobrir as consultas reais com testes proporcionais, especialmente duplicação de alunos, transferência, renovação tardia e ausência de evidência. Verificar foco, rótulos, filtros longos e overflow na rota real. Em tema claro e escuro, zero observado precisa ser legível como valor e ausência de base como estado distinto. Antes de abrir PR ou integrar, revisar o diff e executar os gates do [guia de testes](../testing/README.md), um por vez.
