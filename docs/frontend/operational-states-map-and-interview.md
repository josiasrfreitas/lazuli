# Mapa de estados operacionais e entrevista de refatoração

## Low score queue — accepted on 2026-10-29

**Score baixo** replaces the proposed low-attendance queue. Use the existing overall
student health score without changing its formula or its descriptive bands.

- Active students enter below 70. A score of 70 already meets the minimum.
- After an existing low score recovers to at least 70, keep it **Em observação**
  for seven full days. A new low evaluation clears the recovery timestamp.
- Healthy students with no prior low episode do not enter observation.
- Missing score data does not create a low score or prove a recovery.
- The worker recalculates and persists observations every minute, including on startup.
  Recovery begins when the worker first observes it, not when someone visits the home page.
- Expired observation rows are excluded at read time. Active low scores never expire by age.
- The destination is the student's **Visão geral**, with return to **Início**.

## Unrecorded appointments — accepted on 2026-10-29

Administrative pending appointments use the same timing as unrecorded lessons:
include after three full days from the scheduled end; highlight as **Muito atrasado**
after seven full days. Cancelled or completed appointments are excluded. Old pending
appointments remain visible until their result is recorded.

## Occurrence lifecycle — accepted on 2026-10-29

This decision supersedes the earlier novelty-only scope recorded below.

- New occurrences start **Aberta** and appear in **Ocorrências pendentes** on the administrative home.
- **Aberta** and **Em acompanhamento** remain pending regardless of category, content, age, or current enrollment.
- **Encerrada** leaves the queue but remains in the student's history.
- Administrators change status; teachers can consult status and history within their existing access scope.
- Each transition records its authenticated author, timestamp, previous status, and next status.
- Closing requires a short conclusion. Either open state can be closed; reopening returns to **Em acompanhamento**.
- Existing records start open because no historical closure was recorded.

Data do levantamento: 24/10/2026.

Status: entrevista encerrada por solicitação expressa do usuário após a sexta rodada (“ja chegam de perguntas”). Depois, o usuário autorizou começar pelo estado padrão do Início, adicionando os módulos aos poucos para validação individual. A primeira composição está implementada; sua aceitação visual continua pendente. Nenhuma nova rodada de perguntas prevista.

### Síntese das decisões vigentes

- Foco administrativo. Início organiza trabalho antes de métricas, agrupa por tipo e direciona ao local de resolução; sem ações operacionais embutidas inicialmente.
- Destaque: pesos 9–10 em aviso compacto; 7–8 na área principal; 1–6 em seção secundária compacta/expansível; 0 fora das pendências. Aplicar a mesma hierarquia às pendências correspondentes nas outras páginas.
- Na ficha, cada assunto permanece na sua aba, com alerta piscando junto ao item correspondente do menu; sem resumo global de pendências.
- Criar aluno exige nivelamento desnecessário ou já acertado. A implementação atual, que permite criação com nivelamento pendente, deverá ser alinhada.
- Ocorrência nova tem peso 7, sem avaliar conteúdo nem criar ciclo de aberta/resolvida. Registros pendentes recebem destaque maior a partir de sete dias e não desaparecem apenas por ficarem antigos.
- Dívida com prazo renegociado futuro sai da atenção de atraso; volta se o novo prazo vencer sem pagamento. Redução de encargos sem retirar o saldo vencido mantém a atenção.
- O modal de negociação deve oferecer perdão, permitindo informar o valor integral do saldo devido, não apenas reduzir encargos. Requisito aceito para implementação posterior.
- Material deixa de estar pendente com aquisição registrada; pagamento pendente pertence ao financeiro. Não exigir confirmação de entrega física para esse sinal.
- Reposição apenas agendada não elimina alerta de frequência; média geral não esconde competência abaixo do corte; notas ainda não exigíveis não geram atraso.
- Continuidade considera matrícula e material separadamente. Vínculo de semestre encerrado aparece como histórico, preservando os registros e o percurso.
- Múltiplas turmas: direção futura de um resumo com seletor, expressamente fora da implementação agora. Visualizações secundárias serão desenvolvidas gradualmente.
- As variantes de pendências anteriores após encerramento do vínculo foram consideradas irrelevantes agora; não expandir o escopo por elas. Não criar novos tipos de pendência ou atribuir pesos extras a partir de sugestões que o usuário não confirmou.

Sequência solicitada pelo usuário após a primeira rodada: seguir com o batch de situações e critérios; o usuário definirá o fluxo de trabalho depois. Não antecipar a definição desse fluxo durante a classificação de prioridades.

### Composição atual — revisão após referências visuais

O usuário rejeitou a base vazia e depois a composição com um painel preto de pendências e quatro métricas iguais. A instrução mais recente muda a ordem espacial: métricas na parte superior, pendências na parte inferior com mais espaço vertical e margens laterais menores. Na instrução seguinte, o usuário removeu a agenda e o calendário do Início; métricas e pendências passam a ocupar toda a largura disponível. Essa direção substitui a posição de pendências no topo, preservando a ordenação dos tipos pelos pesos aceitos.

- Métricas com representações próprias: barras finas de volume de contratos em oito meses, linhas de recebido/previsto, rosca por faixa etária dos alunos ativos, proporção de leads vinculados a alunos e comparação de experimentais com os mesmos dias do mês anterior. Séries e contagens vêm dos registros; não são dados ilustrativos. O usuário pediu mais densidade, com três cards compactos na segunda linha e menos espaço em margens, títulos e linhas.
- Volume de contratos substitui entradas em turma: conta contratos não excluídos pela data de contratação (`agreedOn`), incluindo novos e renovações. Rescisão posterior não apaga a contratação histórica; contratos sem essa data não entram. Card direciona para `/contratos` e respeita o acesso financeiro.
- Faixa etária usa apenas crianças, adolescentes e adultos, conforme simplificação solicitada pelo usuário. A idade atual é calculada na data de São Paulo; os cortes de visualização são até 11, 12–17 e 18+ anos. Nascimento ausente ou futuro fica em “Não informada”, sem excluir o aluno do total. Esses cortes não são regras pedagógicas.
- Conversão usa uma única coorte: leads cadastrados no mês até a data de corte. O numerador é quantos desses leads já têm vínculo com um aluno não excluído. A interface explicita “com aluno vinculado”; não divide novos cadastros gerais por leads, não exige matrícula e não afirma que são alunos inéditos para a escola. Sem leads, a taxa aparece sem valor, não como 0%.
- Pendências agora ocupam toda a largura, com rolagem vertical própria, tipos e casos contextuais visíveis; sem “Outras pendências” e sem painel lateral. Cada grupo tem páginas compactas para não deixar volume de registros dominar toda a fila. Cobrança aparece uma vez; saldo atual por mês de vencimento foi para o hover de Receita.
- Qualquer turma sem professor gera alerta, mesmo fora dos próximos sete dias: inclui turmas atuais/futuras sem responsabilidade válida e planos abertos sem professor. Uma linha por turma preserva o encontro sem cobertura mais próximo quando conhecido. Turma publicada abre atribuição de professor; plano abre selecionado na organização. As ações continuam nos destinos.
- Registros com sete dias ou mais permanecem no total e recebem peso 7. Atrasos financeiros acima de trinta dias recebem 8. As demais situações da entrevista que ainda não têm sinal agregado continuam pendentes; esta composição não conclui o mapa inteiro.
- Loading dos indicadores ocupa a grade final de cinco cards desde o início, aguardando os dados gerais e financeiros antes da revelação. Entrada breve dos cards, barras crescendo, linhas de receita desenhadas, rosca e proporções animadas apenas na primeira apresentação; atualizações automáticas preservam o conteúdo. Movimento reduzido respeitado. Pendências não recebem animações nesta etapa.
- Validação desta revisão exclusivamente visual no desktop, sem checks, testes ou lint, conforme instrução expressa. A aceitação estética continua com o usuário.

### Aulas sem registro — agrupamento aceito em 26/10/2026

- Aulas encerradas, não canceladas, aguardando chamada, conteúdo obrigatório e conclusão.
- O prazo começa no instante de término, em America/Sao_Paulo: menos de 3 dias fica fora da fila; de 3 a menos de 7 dias tem prioridade baixa; 7 dias ou mais tem prioridade alta. Esta regra substitui o destaque anterior para aulas, sem alterar atendimentos.
- Uma linha expansível por professor, inicialmente recolhida, com contagens de alta e baixa. Professores com alta prioridade primeiro; desempate pela aula mais antiga. Aulas em ordem da mais antiga à mais recente.
- Cada aula mostra turma, data, tempo decorrido, itens faltantes e “Ver aula”, que abre o modal existente. Sem professor atribuído permanece em grupo explícito.
- A gravação do registro existente confirma atomicamente chamada, conteúdo exigível e conclusão. Chamada confirmada antes da baixa deixa de constar entre os itens faltantes. As exceções existentes de conteúdo (como aula sem presentes, que exige observação) permanecem no fluxo de registro.

### Primeira composição do Início — histórico, rejeitada

Recorte solicitado após a entrevista: uma base inicial enxuta, sem repetir legendas e subtítulos, seguida de adições pequenas. O usuário também solicitou `impeccable bolder`, `craft` e `animate`, com uma passagem graciosa do login para o Início.
O usuário reforçou o foco no desktop durante a implementação. As verificações em telas estreitas são apenas cobertura de regressão, sem ampliar este recorte para um redesenho móvel.

- Saudação e total discreto de alunos ativos.
- Agenda do restante do dia, em linhas alinhadas por horário. Cada compromisso abre sua página de aula, atendimento, turma ou interessado; a ação geral abre a agenda do dia.
- Três números do mês em uma faixa compacta: novos alunos, matrículas iniciadas e experimentais realizadas. Sem cartões de tendência ou gráfico.
- As filas de pendências, os destaques grandes e o resumo financeiro saem desta primeira composição. Os critérios aceitos neste documento continuam pendentes de implementação e serão adicionados individualmente. Agenda vazia não significa ausência de pendências.
- Login por link de email: a identidade visual da entrada se dissolve e a marca se acomoda na navegação. Funciona ao abrir o link em outra aba; não se repete ao recarregar a página ou navegar normalmente. Com movimento reduzido, usa apenas uma dissolução curta. Interação ou redimensionamento encerra a animação.

Implementação: `apps/web/src/features/admin-home/home.tsx`, `home-default.tsx` e `home-arrival.tsx`. A composição reaproveita o sistema visual existente. O pedido explícito de uma base única substitui o workshop de três alternativas neste recorte. A validação técnica não representa aprovação estética pelo usuário.

[Capturas e validação técnica da primeira composição](admin-home-default/README.md).

O levantamento abaixo descreve a implementação anterior a este recorte, preservada como referência para a reorganização dos estados.

## 1. Objetivo e escopo

Reorganizar a hierarquia de atenção e ação do Início e das páginas relacionadas, especialmente aluno e turma. O trabalho deve definir o que requer atenção, o que permite agir hoje, o que deveria permitir e como cada módulo participa da resolução.

O problema inicial é o espaço desproporcional dado a aulas sem registro. A investigação mostrou que o problema também envolve critérios de prioridade, estados contraditórios entre páginas, ações sem contexto e estados importantes sem sinalização no Início.

Escopo confirmado pelo usuário:

- Mapear a implementação antes de propor a refatoração.
- Incluir Início, diferentes estados das páginas de aluno, turma e fluxos relacionados.
- Conduzir uma entrevista `batch-grill-me` contextualizada, com perguntas explicadas e recomendações.
- Fechar entendimento compartilhado antes de implementar.

Este documento registra fatos e perguntas. Recomendações não são decisões aceitas; comportamento existente não é automaticamente requisito desejado.

## 2. Método, evidência e limites

O levantamento inspecionou rotas e componentes ativos, consultas, comandos e regras de domínio. Componentes alternativos e workshops não foram tratados como funcionalidade entregue.

- O levantamento original foi realizado sem alterações de produto; o recorte implementado depois está descrito acima.
- A investigação de estados não consultou a distribuição na base real. A validação visual da primeira composição usa o ambiente local e cenários ilustrativos, sem representar a frequência real das pendências.
- O mapa cobre os estados identificados nos fluxos relacionados; não constitui prova de todas as combinações possíveis em execução.
- Datas operacionais usam `America/Sao_Paulo`.
- Os limiares descritos no levantamento são fatos da implementação. O usuário aceitou atraso financeiro superior a 30 dias como atenção forte e aumento de destaque de registros pendentes a partir de sete dias. O corte de espera para nivelamento/alocação e a janela de renovação não foram validados por essas respostas.

Restrições duráveis relevantes:

- [ADR 0005](../decisions/0005-separate-academic-and-commercial-calendars.md): calendários acadêmico e comercial são independentes.
- [ADR 0009](../decisions/0009-separate-enrollment-from-pedagogical-placement.md): vínculo operacional e percurso pedagógico são conceitos distintos.
- [ADR 0018](../decisions/0018-expose-finance-through-one-module-api.md): fronteira do módulo financeiro.
- [Guia frontend](README.md): explorar três alternativas estruturais, validar a direção com o usuário e testar os fluxos no navegador quando houver propostas visuais.

A hierarquia descrita em [admin-home-pedagogical-flow.md](admin-home-pedagogical-flow.md) está registrada como direção pendente de aceitação visual. Não é uma decisão durável que impeça rever prioridades. [admin-home-scenarios.md](admin-home-scenarios.md) fornece cenários anteriores; seus dados históricos não foram tratados como estado atual da base.

## 3. Diagnóstico transversal

1. **Pendência não implica urgência.** O Início promove o primeiro grupo pedagógico não vazio a destaque grande, mesmo quando rotineiro.
2. **Existem critérios incompatíveis entre páginas.** Um vínculo pode ser vigente na ficha e insuficiente para eliminar a pendência de turma.
3. **Sinalização e poder de ação estão desalinhados.** O administrador recebe destaque de registro de aula, mas o registro é feito pelo professor.
4. **Espera legítima e trabalho bloqueado precisam ser separados.** Entrada futura pode estar corretamente preparada sem liberar acompanhamento antes do início.
5. **Há sinais calculados fora do Início.** Reagendamento necessário, atraso financeiro grave e avaliação pendente não recebem filas próprias ali.
6. **Algumas necessidades ainda não estão modeladas.** Intervenção não tem prazo operacional; não existe base para chamá-la de vencida.
7. **Sair de uma fila não comprova resolução.** Registro antigo vai para histórico; contrato já vencido sai da janela de renovação.

## 4. Início

### 4.1 Público e composição

ADMIN e SYSTEM_ADMIN usam a home administrativa. Professor tem experiência separada. SECRETARY e FINANCE existem no enum, mas estão desabilitados na autorização atual; uma home administrativa sem financeiro é cenário defensivo/testado, não uma persona habilitada hoje.

Composição observada:

1. Saudação e total de alunos ativos.
2. Destaque pedagógico e demais grupos de trabalho.
3. Agenda, cuja posição muda conforme a existência de pendências.
4. Links discretos para registros históricos.
5. Indicadores mensais de matrículas, novos alunos e experimentais.
6. Gráfico de seis meses, alternável por tabela.
7. Gestão e financeiro: recebido, contratos, atraso, pagadores, primeiro contrato e renovação.
8. Atalhos de navegação.

### 4.2 Filas implementadas

| Fila                          | Inclusão atual                                                                             | Ação/destino                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Aulas sem professor           | Encontro não cancelado, sem responsável, ainda não encerrado; hoje até seis datas à frente | Abrir turma                                             |
| Aulas por registrar           | Sessão persistida agendada, encerrada, sem registro                                        | Abrir consulta do registro; execução docente            |
| Atendimentos por registrar    | Atendimento agendado cujo horário terminou                                                 | Abrir atendimento e tratar resultado conforme permissão |
| Nivelamentos por corrigir     | Visita agendada ou realizada, prova existente sem estágio, interessado aberto              | Abrir interessado                                       |
| Interessados aguardando turma | Interessado aberto com espera explicitamente marcada                                       | Abrir interessado                                       |
| Alunos aguardando turma       | Aluno ativo sem vínculo atual/futuro qualificado                                           | Abrir ficha                                             |
| Primeiro contrato             | Aluno ativo sem contrato não excluído                                                      | Abrir ficha                                             |
| Renovações                    | Contrato elegível terminando entre hoje e 30 dias, sem renovação não rescindida            | Abrir financeiro do aluno                               |
| Entradas por confirmar        | Proposta semestral não publicada nem recusada, aluno ativo, semestre não encerrado         | Abrir Organização                                       |

### 4.3 Prioridade implementada

| Ordem | Situação                                                                                           |
| ----- | -------------------------------------------------------------------------------------------------- |
| 1     | Aula sem professor em andamento                                                                    |
| 2     | Aula sem professor hoje; entrada prevista para hoje ou atrasada                                    |
| 3     | Aula sem professor ou entrada nos próximos dois dias                                               |
| 4     | Nivelamento/alocação esperando pelo menos sete dias; registro de aula/atendimento de data anterior |
| 5     | Cobertura a partir de três dias; entrada entre três e seis dias                                    |
| 6     | Registro encerrado hoje; nivelamento recente                                                       |
| 7     | Aluno sem turma; espera recente por alocação; tempo desconhecido                                   |
| 8     | Entrada a partir de sete dias                                                                      |

Desempate: cobertura, semestre, aulas, atendimentos, nivelamento, alunos, interessados aguardando alocação. A prioridade do grupo usa o primeiro item de sua prévia. Quantidade não eleva urgência. Financeiro não participa dessa ordenação.

Consequência: uma aula sem registro desde ontem pode superar um nivelamento antigo. O destaque não exige um patamar mínimo de urgência e mostra número/data grande, descrição, ação e até três casos.

Registros recentes cobrem hoje e as seis datas anteriores, não sete dias úteis. Os anteriores viram histórico. O detalhe pagina de 12 em 12.

### 4.4 Agenda, navegação e estados técnicos

- Agenda mostra até oito compromissos restantes do dia: aulas, atendimentos e visitas. Compromissos encerrados desaparecem dela.
- Abrir grupo substitui a visão geral por uma tabela; esconde saudação e indicadores. Seleção fica em estado local, não na URL.
- Há carregamento e erro independentes para dados escolares e financeiros, incluindo falha de atualização com preservação dos últimos dados.
- Há vazio sem pendências, somente histórico e escola sem atividade, com orientação inicial.
- Atualização automática ocorre a cada 60 segundos.
- O mês selecionado altera indicadores; filas e agenda continuam atuais.
- Em tela estreita os blocos empilham.

Fontes: [home.tsx](../../apps/web/src/features/admin-home/home.tsx), [home-queue.tsx](../../apps/web/src/features/admin-home/home-queue.tsx), [home-work-model.ts](../../apps/web/src/features/admin-home/home-work-model.ts), [home-pending.ts](../../packages/api/src/dashboard/home-pending.ts), [home-schedule.ts](../../packages/api/src/dashboard/home-schedule.ts), [home-semester.ts](../../packages/api/src/dashboard/home-semester.ts).

## 5. Aluno

### 5.1 Dimensões independentes

| Dimensão                   | Estados implementados                                                           | Efeito atual                                                             |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cadastro                   | Ativo, trancado, desistente, inativo                                            | Badge e filtros; os três últimos são agrupados como inativos na listagem |
| Vínculo                    | Nenhum, futuro, vigente, encerrado; múltiplos vigentes possíveis                | Define conteúdo e possibilidade de novos registros pedagógicos           |
| Saída                      | Conclusão, transferência, desistência, suspensão, correção                      | Histórico do vínculo                                                     |
| Entrada incompleta         | Nivelamento, turma ou contrato pendentes                                        | Caixa no cabeçalho, independente da aba                                  |
| Organização semestral      | Aguardando acomodação, preparação, confirmação, não continuidade                | Bloco de intenção e organização                                          |
| Formato                    | Regular/PPT e presencial/online                                                 | Plano regular na turma; plano PPT no aluno                               |
| Frequência                 | Sem chamadas, normal, abaixo de 75%, faltas parcialmente/totalmente compensadas | Indicador e histórico                                                    |
| Avaliação                  | Sem estágio, sem notas, notas parciais/completas                                | Média das notas lançadas; ausência de nota fica fora do cálculo          |
| Financeiro                 | Sem cobranças, em dia, atraso, atraso grave, saldo após rescisão                | Aba financeira e sinal grave no cabeçalho                                |
| Comportamento de pagamento | Histórico insuficiente, pontual, atraso ocasional, recorrente                   | Indicador independente da dívida atual                                   |

### 5.2 Dependências de cadastro

**Leitura da implementação atual, não requisito desejado:** a árvore abaixo descreve o código inspecionado. Na rodada 5, o usuário corrigiu a premissa: criar aluno pressupõe que nivelamento não seja necessário ou já esteja acertado. Nivelamento ainda por resolver pertence à etapa de interessado, antes da criação. Não usar a existência atual dessa combinação como justificativa para mantê-la.

```text
Aluno não ativo
└── Não recebe pendências de cadastro dessa regra

Aluno ativo
├── Sem vínculo qualificado
│   ├── Nivelamento necessário e incompleto → concluir nivelamento
│   │   └── Escolha da turma permanece bloqueada
│   └── Sem bloqueio de nivelamento → definir turma
└── Sem contrato → criar contrato, independentemente da turma
```

Matrícula futura pode satisfazer a necessidade de turma. A conclusão do nivelamento verifica visita realizada, resultado com estágio e coerência com o estágio do interessado. As pendências não têm responsável, prazo ou severidade próprios.

“Escolher turma” e “Criar contrato” abrem o fluxo de continuar cadastro; “Abrir nivelamento” leva ao interessado. Não há nessa caixa pendência por contato, documento, frequência, avaliação, intervenção ou cobrança.

### 5.3 Com matrícula vigente

Ordem atual na aba pedagógica:

1. Aviso de rescisão, quando houver.
2. Intenção/organização semestral.
3. Cartão por matrícula vigente, com turma, professor, estágio, horários, frequência e média.
4. Acompanhamento: atendimentos, ocorrências e intervenções.
5. Histórico e entradas futuras.

O contato é repetido em contextos de matrícula e financeiro. Plano regular leva à turma; PPT leva ao percurso individual.

### 5.4 Sem matrícula vigente

| Estado            | Apresentação atual                        | Limitação                                              |
| ----------------- | ----------------------------------------- | ------------------------------------------------------ |
| Nunca matriculado | “O acompanhamento começa com a matrícula” | Vazio grande sem ação contextual interna               |
| Entrada futura    | “O próximo período já tem data”           | Acompanhamento somente leitura até início              |
| Somente histórico | “Nenhuma matrícula em andamento”          | Pouca orientação contextual para retorno ou realocação |

Nos três casos há contato, histórico e acompanhamento somente leitura quando existente. O bloco de Organização de matrícula não é montado. Pendências do cabeçalho podem continuar presentes.

### 5.5 Planejamento e listagem

- Aba de planejamento aparece se houver matrícula PPT, inclusive histórica; múltiplos percursos têm seletor.
- Percurso inválido/inacessível tem estado próprio e pode oferecer retorno ao atual.
- Sem percurso PPT, há explicação sem ação de resolução.
- Listagem permite busca, filtros de situação, turma, professor e cadastro; novo aluno e continuação de cadastro.
- Diferencia carregamento, erro, escola sem alunos e filtro sem resultados.
- Não foi identificado filtro específico para gravidade pedagógica, atraso financeiro ou tipo de pendência.

### 5.6 Divergências a resolver

1. “Vigente” no perfil considera datas; a pendência exige também turma ativa e semestre não encerrado. Um vínculo antigo sem saída pode produzir mensagens contraditórias.
2. Ativo sem turma/contrato é um caminho suportado, não necessariamente erro.
3. Entrada futura elimina pendência de turma, mas não libera novos registros pedagógicos.
4. Organização desaparece no ramo sem matrícula atual.
5. Existência de contrato não garante vigência nem ausência de rescisão.
6. Reativação do cadastro não restaura matrícula. Suspensão/desistência encerra vínculos abertos já iniciados e progresso associado; não foi identificada ação de status no perfil inspecionado, embora exista endpoint.

Fontes: [student-page.tsx](../../apps/web/src/features/students/profile/student-page.tsx), [student-pedagogy.tsx](../../apps/web/src/features/students/profile/student-pedagogy.tsx), [student-pending-actions.tsx](../../apps/web/src/features/students/profile/student-pending-actions.tsx), [regra de pendências](../../packages/domain/src/pending-actions.ts), [consulta de pendências](../../packages/api/src/students/pending-actions.ts), [pedagogy.ts](../../packages/api/src/students/pedagogy.ts), [status.ts](../../packages/api/src/students/status.ts).

## 6. Turmas e aulas

| Parte                   | Estados                                                                                               | Ações/limites                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Turma                   | Ativa/arquivada, estágio ausente, professor ausente, ocupação normal/alta/acima da referência         | Matricular, definir professor, consultar alunos e desempenho |
| Preparação de encontros | Não preparados, preparando, demorando, falha, concluído com encontros, concluído sem dias compatíveis | Preparar, tentar novamente, atualizar conforme permissão     |
| Aula                    | Futura, encerrada sem registro, registrada, corrigida, cancelada                                      | Registro docente e consulta administrativa                   |
| Planejamento            | Ausente, previsto, realizado, diferença entre previsto e registrado                                   | Planejar e consultar histórico                               |

A turma tem abas Alunos, Desempenho, Aulas e Planejamento; planejamento coletivo é regular, enquanto PPT usa percurso individual. A API também possui arquivamento, clonagem e preparação de encontros; isso não significa que todas essas ações estejam expostas no detalhe observado.

Falha/demora na preparação, ocupação alta, ausência de planejamento e diferença de progresso não têm filas próprias no Início. A cobertura de professor não substitui o diagnóstico de uma agenda não preparada.

O link “Definir professor” do Início abre a turma genérica, sem levar diretamente à operação contextual do encontro.

Fontes: [class-page.tsx](../../apps/web/src/features/classes/class-page.tsx), [class-overview.tsx](../../apps/web/src/features/classes/class-overview.tsx), [generation-notice.tsx](../../apps/web/src/features/class-records/generation-notice.tsx), [classes/router.ts](../../packages/api/src/classes/router.ts).

## 7. Atendimentos, frequência e reposição

- Finalidades: reposição, complemento PPT, reforço e avaliação.
- Estados: agendado, realizado, não compareceu, cancelado. Reagendado corresponde a cancelamento com sucessor.
- “A registrar” deriva de atendimento agendado cujo horário terminou.
- Administração agenda, reagenda e cancela; resultado/correção dependem da regra de acesso.
- Aula de destino cancelada bloqueia registro e pede reagendamento.
- Reposição distingue minutos disponíveis, reservados por agendamento e compensados por realização.
- Agenda do aluno prioriza agendados; histórico aparece em ordem inversa.

O Início mostra compromissos restantes do dia e registros pendentes. Não há fila própria para saldo de reposição, novo contato após falta ou atendimento com destino cancelado. Registrar o resultado não equivale a resolver a necessidade pedagógica.

Fontes: [student-appointment-dialog.tsx](../../apps/web/src/features/appointments/student-appointment-dialog.tsx), [appointments/data.ts](../../packages/api/src/appointments/data.ts), [appointments/absences.ts](../../packages/api/src/appointments/absences.ts).

## 8. Ocorrências, intervenções, avaliações e progresso

### 8.1 Acompanhamento

Ocorrências registram categoria, relato, resposta inicial e relações com outros registros. Categorias incluem material, tarefa, participação, convivência e aprendizagem.

Intervenções registram tratamento realizado, data, responsável, ocorrências relacionadas e acompanhamentos textuais. **Não possuem estado operacional persistido de aberta/em andamento/concluída, prazo ou próxima ação.** Um enum não utilizado no schema não deve ser interpretado como fluxo implementado.

**Correção de escopo aceita na rodada 2:** o usuário quer sinalizar ocorrência nova, não introduzir um fluxo de ocorrência aberta/resolvida. Não avaliar ou classificar o conteúdo do relato para priorizar. A comparação de gravidade entre relatos proposta na entrevista foi rejeitada como critério; manter o tratamento simples.

Administração cria intervenções; permissões docentes são limitadas por autoria/responsabilidade. Na ficha, novos registros dependem da existência de matrícula corrente. A seleção inicial da mesa prioriza ocorrência e depois intervenção, sem critério de gravidade ou prazo.

`/acompanhamento` redireciona para alunos ou para o acompanhamento de um aluno específico. Não há sinal próprio na home. Recorrência preocupante, ocorrência sem tratamento e retorno devido exigem definição de produto antes de gerar filas.

### 8.2 Avaliações

- Competências: oral, listening, written e participação; unidades 1, 2 e recuperação.
- Estados derivados: notas incompletas, suficientes ou abaixo do corte.
- Decisão administrativa de aprovação/repetição é separada das notas; aprovação exige pelo menos 60 em todas as competências.
- Avaliação incompleta não pode ser concluída.
- Correção de nota confirmada exige justificativa e desfaz a confirmação anterior.
- Notas faltantes, decisão pendente ou confirmação desfeita não têm fila própria no Início.

Nota incompleta não implica atraso sem uma regra sobre quando deveria existir.

### 8.3 Planejamento

Compara conteúdo previsto e registrado, permite ajustar itens e consultar histórico. Pode faltar plano, referência prevista ou registro realizado. Histórico, turma inativa e acesso de substituto podem tornar o plano somente leitura.

Diferença de página não comprova atraso crítico. Avaliação planejada próxima e plano inexistente também precisam de política antes de ganhar prioridade.

Fontes: [student-follow-up.tsx](../../apps/web/src/features/pedagogical-follow-up/student-follow-up.tsx), [schema.prisma](../../packages/db/prisma/schema.prisma), [occurrences/router.ts](../../packages/api/src/occurrences/router.ts), [assessments/rules.ts](../../packages/api/src/assessments/rules.ts), [assessments/write.ts](../../packages/api/src/assessments/write.ts), [stage-planning/data.ts](../../packages/api/src/stage-planning/data.ts).

## 9. Interessados e nivelamento

| Parte            | Estados                                                                                           | Ações/restrições                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Interessado      | Aberto, arquivado, matriculado                                                                    | Editar/agendar; reabrir; abrir aluno                        |
| Visita           | Agendada, realizada, falta, cancelada                                                             | Resultado após início; reagendamento substitui visita       |
| Experimental     | Agendada ou precisando reagendar por mudança/cancelamento/ausência de professor                   | Remarcar                                                    |
| Nivelamento      | Não agendado quando necessário, agendado, aguardando prova, aguardando correção, estágio definido | Atribuir professor, enviar prova, corrigir, definir estágio |
| Espera por turma | Marcada explicitamente com data e motivo                                                          | Resolver alocação ou remover marcação                       |

Cadastro de aluno e matrícula são distintos: interessado pode estar aberto e já vinculado a aluno. Arquivamento é bloqueado se houver visita agendada. Interessado matriculado perde menu de ações e tem restrições de mudança de status.

Nivelamento admite uma visita agendada por interessado. Envio exige início da visita e estado compatível; versão corrigida exige original; resultado exige prova e estágio ativo. Para aluno com experiência prévia, conclusão precisa estar coerente com o estágio de destino.

O Início cobre prova enviada sem estágio. Não cobre toda a cadeia: nivelamento necessário não agendado, prova faltante, professor não atribuído e experimental precisando reagendar são situações distintas.

Fontes: [candidate-page.tsx](../../apps/web/src/features/admissions/candidate-page.tsx), [placement-state.ts](../../apps/web/src/features/admissions/placement-state.ts), [visit-read.ts](../../packages/api/src/admissions/visit-read.ts), [placement.ts](../../packages/api/src/admissions/placement.ts), [enroll.ts](../../packages/api/src/admissions/enroll.ts).

## 10. Organização e continuidade

| Dimensão            | Estados                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Proposta            | Pendente, pronta para publicar, publicada, efetivada, publicação precisando revisão |
| Movimento acadêmico | Nova entrada, manter estágio, avançar, repetir                                      |
| Intenção            | A conversar, permanecer, mudar, possível saída                                      |
| Disponibilidade     | Ausente, confirmada, vencendo antes da entrada, incompatível com horário/formato    |

Bloqueios incluem cadastro inativo, falta de turma/estágio/professor, turma indisponível, incompatibilidade, disponibilidade não confirmada, percurso de origem alterado e decisão pedagógica pendente.

Publicação pode ser parcial e programa entrada/saída sem encerrar antecipadamente o vínculo atual. Elegibilidade é revalidada antes de efetivar entrada. Retirada de publicação depende de cancelar ações ainda programadas.

**Desencontro de navegação:** o Início destaca entradas hoje/atrasadas, mas a página Organização fica somente leitura quando o semestre começa e orienta continuar pela turma. O destino de resolução precisa ser revisto.

Fontes: [semester-organization.ts](../../packages/domain/src/semester-organization.ts), [publish.ts](../../packages/api/src/semester-organization/publish.ts), [lifecycle.ts](../../packages/api/src/semester-organization/lifecycle.ts), [page-model.ts](../../apps/web/src/features/semester-organization/page-model.ts), [page-view.tsx](../../apps/web/src/features/semester-organization/page-view.tsx).

## 11. Financeiro, contrato e material

### 11.1 Cobranças e comportamento

Estados de parcela, em precedência: dispensada, paga, atrasada, vencendo no mês e futura. Pagamento parcial é informação de saldo, não um estado exclusivo.

- Sem saldo vencido: sem atraso.
- Saldo vencido até 30 dias: atraso.
- Atraso mais antigo superior a 30 dias: atraso grave, já descrito como ação prioritária na ficha.
- Histórico de pagamentos distingue dados insuficientes, pontualidade, atraso em um mês e atraso recorrente em mais de um mês de vencimento.

A ficha permite receber, negociar parcelas, consultar histórico, acessar Recebíveis, tratar material e rescindir contrato. Abre filtro de pendências quando há atraso. Sem cobranças, o vazio não orienta diretamente criação naquele bloco.

### 11.2 Contratos e material

- Condições destacam contratos vigentes; se não houver, podem mostrar o primeiro disponível como fallback.
- Renovação exige contrato elegível, termos comerciais completos e ausência de renovação não rescindida.
- Contrato vencido sem renovação sai da janela da home e não aparece como primeiro contrato.
- Rescisão pode preservar saldo a cobrar; aviso aparece também no pedagógico.
- Material tem lembrete informativo na janela de 30 dias do fim previsto do estágio: conferir destino ou negociar próximo material.
- Venda de material já conta como cobertura da necessidade mesmo antes do recebimento; pagamento pendente não implica comprar de novo.

Fontes: [student-finance.tsx](../../apps/web/src/features/students/profile/student-finance.tsx), [finance-contract-terms.tsx](../../apps/web/src/features/students/profile/finance-contract-terms.tsx), [student-finance.ts](../../packages/domain/src/student-finance.ts), [finance-ledger.ts](../../packages/domain/src/finance-ledger.ts), [material-reminder.ts](../../packages/domain/src/material-reminder.ts).

## 12. Inventário de candidatos a atenção

| Categoria                            | Exemplos                                                                                                       | Decisão necessária                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Trabalho já definido                 | Cobertura de professor, registro pendente, alocação, entrada não confirmada                                    | Prioridade, responsável, lugar e ação adequada     |
| Sinal já calculado, sem fila própria | Experimental precisando remarcar, atraso grave, decisão pedagógica pendente, geração falha, saldo de reposição | Quando promover a trabalho e com qual consequência |
| Informação contextual                | Histórico de pontualidade, ocupação, comparação previsto/realizado, lembrete de material                       | Quando basta informar e quando muda de categoria   |
| Necessidade ainda não modelada       | Prazo de retorno de intervenção, responsável por cobrar registro, recorrência preocupante                      | Se deve existir; dados, regras e fluxo necessários |

Essa classificação é uma ferramenta para a entrevista, não uma hierarquia aprovada.

## 13. Estados transversais de interface

A refatoração precisa distinguir:

- Carregamento inicial e atualização em andamento.
- Falha sem dados e falha com dados anteriores preservados.
- Escola sem atividade, seção sem registros e filtro sem resultados.
- Nenhum trabalho necessário e impossibilidade de consultar o trabalho.
- Ação bloqueada por pré-requisito, acesso somente leitura e falta de permissão.
- Histórico, espera legítima por data futura e pendência realmente vencida.
- Item resolvido, item retirado de uma janela temporal e item ainda dependente de outra pessoa.

O comportamento docente deve ser considerado nas passagens de responsabilidade: possui outra experiência e escopo de acesso; planejamento/notas dependem de vínculo corrente. O usuário definiu foco administrativo; a reorganização completa da experiência docente não integra o recorte confirmado.

## 14. Árvore de decisões da entrevista

```text
Propósito e operador
├── O que merece atenção
│   ├── Impacto, prazo e responsabilidade
│   ├── Trabalho executável versus bloqueado
│   └── Espera legítima versus abandono
├── Tratamento por estado
│   ├── Aluno e admissão
│   ├── Turma, aula e acompanhamento
│   ├── Organização e continuidade
│   └── Financeiro e material
├── Distribuição entre páginas
│   └── Sinalizar → entender → agir → verificar resolução
└── Hierarquia visual
    └── Comparar três composições após fechar as regras
```

Método acordado para a sessão: perguntar toda a fronteira de decisões cujos pré-requisitos estejam resolvidos, numerar e recomendar uma resposta, aguardar respostas e recomputar a próxima rodada. Perguntas dependentes não devem ser antecipadas como se já houvesse decisão. Fatos adicionais devem ser investigados na codebase. A implementação aguarda confirmação de entendimento compartilhado.

## 15. Rodada 1 — respondida

### 1. Quem estamos ajudando a decidir e agir?

**Contexto:** administração e professor têm experiências distintas. O administrador vê aulas sem registro, mas não faz o registro por aquela tela.

**Pergunta:** o recorte é a operação administrativa e suas passagens de responsabilidade, ou inclui também reorganizar toda a experiência docente?

**Recomendação:** centrar na administração, distinguindo “eu resolvo” de “preciso acompanhar outra pessoa”. Incluir as passagens para o professor; decidir separadamente uma reorganização completa da experiência docente.

**Resposta aceita:** “foco no admin”. O trabalho se concentra na administração; as passagens de responsabilidade continuam relevantes.

### 2. O que faz algo merecer atenção?

**Contexto:** aula sem professor hoje, vinte registros de ontem, aluno sem turma e dívida de 40 dias podem coexistir.

**Pergunta:** quais consequências pesam mais — impedir aula/entrada, deixar alguém sem resposta, prejuízo pedagógico ou financeiro? Alguma tem precedência absoluta?

**Recomendação:** avaliar consequência de não agir, prazo real e possibilidade de ação. Quantidade dimensiona trabalho, sem gerar prioridade sozinha.

**Resposta aceita:** concordância com consequência/prazo como critérios, sem volume determinar urgência sozinho. O usuário destacou aulas sem professor, alunos sem pagar por muito tempo e ocorrências, e pediu situações concretas para ordenar melhor. A expressão inicial “ocorrências abertas” foi corrigida pelo usuário na rodada 2 para “ocorrência nova”. As notas dos cenários estão registradas abaixo.

### 3. Qual deve ser o papel de cada página?

**Contexto:** o Início abre tabelas e modais; a ficha pode esconder o contexto da pendência.

**Pergunta:** distribuir execução pelas páginas de contexto ou concentrar mais trabalho no Início?

**Recomendação:** Início seleciona o trabalho relevante da escola; aluno reúne situação e próximos passos pessoais; turma reúne execução coletiva; Organização prepara o semestre. Ações rápidas podem ocorrer no Início quando houver contexto suficiente.

**Resposta aceita:** o Início deve direcionar para o lugar apropriado de resolução. Não oferecer ações operacionais embutidas inicialmente; incorporá-las conforme o uso justificar. Se a página de destino não tratar bem o estado, levar a melhoria para aquela página. Essa decisão substitui a sugestão inicial de já incluir ações rápidas no Início.

### 4. Até onde podemos mudar o comportamento do sistema?

**Contexto:** alguns problemas são de composição; outros exigem critérios consistentes ou recursos novos, como prazo de retorno de acompanhamento.

**Pergunta:** abrir espaço para corrigir regras e criar capacidades necessárias ou limitar a primeira entrega às capacidades atuais?

**Recomendação:** incluir critérios contraditórios e caminhos de resolução; avaliar novos prazos, responsáveis e acompanhamentos caso a caso.

**Resposta aceita:** sim, há espaço para alterar regras e capacidades quando necessário. Isso autoriza discutir e definir essas mudanças; ainda não confirma implementação de funcionalidades específicas nem encerra a entrevista.

### 5. Qual lugar os indicadores de gestão devem ocupar?

**Contexto:** novos alunos, matrículas, experimentais, gráficos e financeiro dividem a página com trabalho operacional.

**Pergunta:** o Início serve principalmente para organizar o dia, acompanhar a saúde da escola ou ambos com o mesmo peso?

**Recomendação:** resumo compacto com aprofundamento acessível; primeiro plano para decisão e ação.

**Resposta aceita:** organizar trabalho primeiro; informações e métricas depois.

## 16. Rodada 2 — respondida

O usuário escolheu a escala de 0 a 10, substituindo as categorias de prazo sugeridas. São notas para cenários hipotéticos; generalizações, faixas e desempates não estão automaticamente definidos.

### 1. Notas dos cenários

| Caso | Situação apresentada                                                                 | Nota do usuário                                                          |
| ---- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| A    | Turma com dez alunos, aula em duas horas, sem professor                              | 10                                                                       |
| B    | Turma sem professor, próxima aula em quatro dias                                     | 7                                                                        |
| C    | Aluno frequentando, mensalidade vencida há 45 dias sem pagamento                     | 8                                                                        |
| D    | Mensalidade vencida há oito dias, histórico anterior pontual                         | 6                                                                        |
| E    | Professor relata conflito repetido nas últimas três aulas, sem conseguir resolver    | 9                                                                        |
| F    | Professor registrou material esquecido, emprestou exemplar e aula seguiu normalmente | 1, com rejeição explícita de usar o conteúdo da ocorrência como critério |
| G    | Início combinado para amanhã, nivelamento pronto, turma não definida                 | 7                                                                        |
| H    | Nivelamento há dez dias, prova enviada sem correção/estágio                          | 5                                                                        |
| I    | Vinte aulas de ontem sem registro                                                    | 4                                                                        |
| J    | Notas completas sem confirmação administrativa, próxima etapa em dez dias            | 3                                                                        |
| K    | Contrato terminou há cinco dias, aluno segue frequentando, sem renovação             | 7                                                                        |
| L    | Entrada em vinte dias, turma e contrato definidos                                    | 0                                                                        |
| M    | Três aulas de dez dias atrás sem registro                                            | 7                                                                        |
| N    | Aluno cadastrado sem turma, sem data combinada de início                             | 4                                                                        |

Não usar E/F para inferir classificação semântica, análise de gravidade ou leitura automatizada de relatos. Na rodada 3, o usuário definiu peso 7 para ocorrência nova, substituindo a extrapolação das notas desses dois relatos.

### 2. Significado de ocorrência

Resposta: “ocorrencia nova, nao necessariamente aberta. Nao precisa overcomplicar temos outras prioridades”.

Decisão: usar a novidade da ocorrência como sinal. Não abrir nesta etapa um desenho de ciclo de resolução, classificação por conteúdo ou acompanhamento futuro de intervenções. Como o sinal deixa de ser novo pertence à discussão posterior de fluxo, se necessário.

### 3. Atraso financeiro prolongado

Resposta: “ok” à proposta de atraso superior a 30 dias como atenção forte. Atrasos menores continuam visíveis, com menor destaque; o exemplo de oito dias recebeu nota 6. Quantidade de parcelas e valor foram mencionados como possíveis agravantes, sem pesos ou valores de corte definidos.

### 4. Consequências para as próximas decisões

- Vinte registros recentes receberam menos prioridade que três antigos: quantidade não substitui idade.
- Registro com dez dias recebeu nota 7; a janela atual de sete datas não pode ser tomada como política aceita de deixar esse caso apenas no histórico.
- Entrada futura preparada recebeu zero; espera legítima não deve virar pendência por ausência de atividade atual.
- O caso sem turma passou de 4 sem data combinada para 7 com início amanhã.
- As notas de ocorrência por conteúdo não são uma regra a implementar.

## 17. Rodada 3 — respondida

Esta rodada classificou os estados restantes, definiu o peso de ocorrência nova e o corte de idade para destacar registros. Não definiu fluxo de trabalho.

### 1. Classificar os estados ainda não comparados

Novos cenários hipotéticos, na escala de 0 a 10:

| Caso | Situação                                                                                                           | Recomendação inicial | Nota aceita |
| ---- | ------------------------------------------------------------------------------------------------------------------ | -------------------- | ----------- |
| O    | Aluno frequenta há duas semanas e nunca teve contrato criado                                                       | 7                    | 7           |
| P    | Contrato vence em quinze dias, ainda sem renovação                                                                 | 5                    | 5           |
| Q    | Aluno cadastrado há três dias precisa de nivelamento; ainda não foi agendado e não há início combinado             | 4                    | 4           |
| R    | Turma começa amanhã e a preparação dos encontros falhou                                                            | 8                    | 9           |
| S    | Experimental marcada para amanhã perdeu a aula de destino por cancelamento e precisa ser remarcada                 | 7                    | 7           |
| T    | Reposição marcada para amanhã perdeu a aula de destino por cancelamento                                            | 7                    | 7           |
| U    | Aluno está com frequência confirmada de 65% nas últimas seis semanas, sem reposições compensando as faltas         | 6                    | 7           |
| V    | Atendimento pedagógico terminou há dez dias e continua sem resultado registrado                                    | 7                    | 7           |
| W    | Próximo estágio começa em quinze dias; novo livro definido, sem aquisição registrada                               | 3                    | 7           |
| X    | Próximo semestre começa em dez dias; aluno quer continuar, mas sua disponibilidade ainda não foi confirmada        | 5                    | 5           |
| Y    | Ao fim da primeira unidade, aluno tem nota abaixo de 60 em uma competência; ainda não é a decisão final do estágio | 3                    | 6           |

**Resposta aceita:** todos os casos classificados. O usuário confirmou as recomendações de O, P, Q, S, T, V e X; alterou R para 9, U e W para 7 e Y para 6.

### 2. Peso de ocorrência nova

**Pergunta:** retirando a interpretação do relato, qual nota representa uma ocorrência nova?

**Recomendação:** 9, usando a nota dada ao caso E como proposta de destaque geral, sujeita à confirmação. Nenhuma classificação de conteúdo.

**Resposta aceita:** “vamos por 7”. Peso de ocorrência nova é 7, independentemente do conteúdo.

### 3. Quando o registro pendente deixa de ser recente

**Contexto:** registros de ontem receberam 4; registros com dez dias receberam 7. A regra atual move os mais antigos que a janela de sete datas para histórico.

**Pergunta:** a partir de quantos dias a ausência de registro deve receber o destaque maior?

**Recomendação:** a partir de sete dias, mantendo os antigos visíveis como trabalho pendente, sem redução automática de atenção pela idade. Definição de resolução e cobrança fica para o fluxo posterior.

**Resposta aceita:** “ok”. A partir de sete dias, registros pendentes recebem o destaque maior; antigos continuam visíveis como trabalho pendente. O exemplo recente ficou em 4 e o antigo em 7. Não extrapolar esse corte para nivelamento, alocação ou outros tipos sem decisão específica.

### 4. Consolidação das prioridades aceitas

| Peso | Cenários e sinais                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10   | Aula em duas horas sem professor (A)                                                                                                                                                                                                                                                                   |
| 9    | Preparação das aulas falhou, turma começa amanhã (R)                                                                                                                                                                                                                                                   |
| 8    | Mensalidade vencida há 45 dias (C)                                                                                                                                                                                                                                                                     |
| 7    | Ocorrência nova; cobertura em quatro dias (B); entrada amanhã sem turma (G); contrato vencido (K); registros antigos (M, V); aluno frequentando sem primeiro contrato (O); experimental/reposição a remarcar para amanhã (S, T); frequência de 65% (U); material do próximo estágio em quinze dias (W) |
| 6    | Mensalidade vencida há oito dias (D); competência abaixo de 60 ao fim da primeira unidade (Y)                                                                                                                                                                                                          |
| 5    | Nivelamento sem correção há dez dias (H); renovação em quinze dias (P); disponibilidade do próximo semestre em dez dias (X)                                                                                                                                                                            |
| 4    | Registros de ontem (I); aluno sem turma sem início combinado (N). Q foi superado pela condição de criação definida na rodada 5; não é estado normal desejado de aluno.                                                                                                                                 |
| 3    | Confirmação pedagógica pendente, próxima etapa em dez dias (J)                                                                                                                                                                                                                                         |
| 0    | Entrada futura já preparada (L)                                                                                                                                                                                                                                                                        |

E e F permanecem como histórico da entrevista; não geram regras diferentes por conteúdo de ocorrência. Os pesos exprimem a importância dos cenários aceitos, sem definir automaticamente fórmula, desempates, corte de exibição ou interpolação para outras datas.

## 18. Rodada 4 — respondida

Esta rodada definiu a hierarquia de informação e resolveu a apresentação de um vínculo de semestre encerrado. O fluxo de trabalho continua reservado para definição posterior pelo usuário. As respostas abaixo prevalecem sobre recomendações rejeitadas.

### 1. Quanto trabalho aparece no Início

**Pergunta:** mostrar todas as pendências com o mesmo nível de abertura ou reservar a área principal às de peso 7 ou mais?

**Recomendação:** 9–10 em aviso compacto no topo; 7–8 na área principal; 1–6 em uma seção secundária compacta que possa ser expandida; 0 fora da área de pendências. Nenhum grupo deve ganhar um bloco gigante apenas por ser o primeiro não vazio.

**Resposta aceita:** “ok”. Faixas de destaque aceitas conforme a recomendação. Os pesos orientam a hierarquia; não foi decidido exibir notas numéricas ao usuário do produto.

### 2. Unidade de apresentação no Início

**Contexto:** três alunos com dívida, dois com material a tratar e doze registros antigos podem ocupar muitas linhas.

**Alternativas:** uma linha por caso; uma linha por tipo de trabalho com quantidade e contexto temporal; agrupamento por aluno/turma reunindo seus assuntos.

**Recomendação:** uma linha compacta por tipo de trabalho, com quantidade e evidência do caso mais prioritário. Isso reduz repetição no Início; o detalhamento fica no destino apropriado. Não equivale a escolher ainda uma composição visual final.

**Resposta aceita:** “agrupar por tipo de trabalho. Vamos construir visualizacoes secundarias pra expandir isso, mas vamos com calma”. Agrupamento por tipo confirmado; desenvolver detalhamentos progressivamente, sem projetar agora todas as visualizações secundárias.

### 3. Pendências de áreas diferentes na ficha do aluno

**Contexto:** o mesmo aluno pode ter dívida, ocorrência nova e necessidade de material. Hoje os sinais ficam distribuídos, e o bloco de pendências do cabeçalho cobre principalmente cadastro.

**Pergunta:** reunir esses sinais num resumo compacto visível em qualquer aba, criar uma aba de visão geral ou manter cada sinal somente na sua seção?

**Recomendação:** resumo compacto no topo, visível em qualquer aba e ordenado pela prioridade aceita, com detalhes preservados nas seções correspondentes. Isso mantém contexto quando o admin chega por um link específico.

**Resposta aceita:** “cada um em sua aba. Menu fica com alerta psicando do lado do lugar q tiver problema”. A recomendação de resumo global foi rejeitada. Conteúdo e pendências permanecem na aba correspondente; o menu sinaliza o local do problema com alerta piscando. Na interpretação contextual desta resposta, o menu é a navegação das abas da ficha; extensão ao menu global não foi solicitada. Não criar uma visão geral agregada por inferência.

### 4. Vínculo de semestre encerrado

**Contexto:** o perfil pode chamar de vigente um vínculo sem data de saída mesmo após o fim do semestre, enquanto a regra de pendências pede definir turma.

**Pergunta:** se o semestre acabou e não existe outra matrícula atual nem futura, o vínculo antigo ainda deve aparecer como turma atual?

**Recomendação:** não. Mostrar o vínculo como referência histórica e explicitar a ausência de turma atual. Preservar registros e percurso pedagógico; essa decisão de apresentação não exige alterar retroativamente a matrícula nem encerrar o percurso.

**Resposta aceita:** “ok”. Vínculo do semestre encerrado aparece como histórico; sem outra matrícula atual ou futura, explicitar a ausência de turma atual. Preservar registros e percurso pedagógico, sem alteração retroativa de matrícula decorrente apenas dessa apresentação.

## 19. Rodada 5 — respondida; variantes adicionais solicitadas

Esta rodada corrigiu uma premissa de criação, definiu uma exceção financeira, ampliou a continuidade para material e escolheu uma direção futura para múltiplas matrículas. O usuário apontou que a matriz ainda omite outras situações de atenção. As respostas prevalecem sobre as recomendações anteriores.

### 1. Pendência bloqueada por outra

**Contexto:** aluno precisa de nivelamento antes de escolher turma. O sistema já conhece essa dependência; contrato pode ser tratado independentemente.

**Pergunta:** contar o aluno nas duas filas do Início ou destacar somente a pendência que permite destravar a outra?

**Recomendação:** no Início, destacar nivelamento; na aba pedagógica, mostrar que a turma aguarda esse resultado. Contrato continua independente, na sua fila e na aba Financeiro quando aplicável.

**Resposta aceita:** “a criacao de aluno pressupoe a nao necessidade de nivelamento, ou nivelamento acertado. Reforcar isso”. A premissa do exemplo foi rejeitada: não tratar nivelamento ainda por resolver como estado normal de um aluno recém-criado. A criação deve exigir nivelamento desnecessário ou já acertado. Não inferir daqui novas exigências de contrato ou turma para criar aluno.

**Divergência verificada no código:** o fluxo atual permite salvar aluno sem turma e com nivelamento pendente. A UI bloqueia pendência apenas quando há turma selecionada; a API `students.enrollNew` permite criar aluno sem esse destino; o teste de integração cobre explicitamente aluno criado com prova agendada e estágio nulo. O endpoint direto `students.create` também não recebe esse contexto. A matrícula via interessado já exige prontidão de nivelamento quando aplicável. Não foi encontrada ADR aceita exigindo criação anterior ao nivelamento.

Fontes: [new-student-save.ts](../../apps/web/src/features/students/new-student/new-student-save.ts), [students/intake.ts](../../packages/api/src/students/intake.ts), [students/router.ts](../../packages/api/src/students/router.ts), [intake.integration.test.ts](../../packages/api/test/students/intake.integration.test.ts), [admissions/enroll.ts](../../packages/api/src/admissions/enroll.ts).

**Impacto na entrevista:** o cenário Q da rodada 3 deixa de ser um estado legítimo de aluno sob a regra desejada; sua nota permanece como histórico, sem ser transferida automaticamente para uma fila de interessados. Registros existentes inconsistentes e o critério exato de prontidão serão tratados na definição posterior do fluxo; não assumir que desapareceram.

### 2. Dívida de aluno que deixou de frequentar

**Contexto:** aluno trancado, desistente ou inativo ainda pode ter saldo vencido ou saldo após rescisão.

**Pergunta:** se deixou de frequentar e tem parcela vencida há 45 dias, deve continuar aparecendo na atenção financeira?

**Recomendação:** sim, com o mesmo critério da dívida de aluno que frequenta. Situação cadastral não deve esconder saldo pendente.

**Resposta aceita:** “ok, a nao ser q seja negociada”. Manter atenção financeira apesar da saída, ressalvada dívida negociada. A abrangência da exceção precisa distinguir negociação com prazo futuro, simples redução de encargos e novo vencimento descumprido; não interpretar qualquer negociação histórica como exclusão permanente.

### 3. Contexto pedagógico sem matrícula atual

**Pergunta:** o que deve ocupar o espaço principal da aba Pedagógico em cada um destes estados?

| Estado                                                                                             | Recomendação                                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Nunca começou e ainda não tem turma                                                                | Preparação da entrada e situação da turma; nivelamento já desnecessário/acertado conforme correção do usuário; contrato permanece no Financeiro |
| Tem entrada futura já preparada                                                                    | Turma e data de início, sem alerta de pendência                                                                                                 |
| Semestre terminou, cadastro continua ativo, sem outra matrícula ou material para o próximo estágio | Mostrar separadamente o que falta em matrícula e material, com última turma como contexto histórico                                             |
| Trancado, desistente ou inativo, sem retorno combinado                                             | Situação atual e histórico, sem pedir nova turma automaticamente                                                                                |

**Recomendação geral:** adaptar o conteúdo ao estado, mantendo cada assunto em sua aba e evitando o vazio grande genérico de ausência de matrícula. Não altera automaticamente situação cadastral, contrato ou percurso.

**Resposta aceita:** aprovação dos contextos de preparação, entrada futura e situação/histórico para quem está trancado, desistente ou inativo. O usuário ampliou o terceiro caso para “sem outra matricula ou sem material pro proximo estagio” e apontou variantes ainda ausentes. Matrícula futura não elimina por si só necessidade de material; são dimensões separadas. O estado pronto não deve esconder uma pendência real de material. Não é uma aprovação de uma matriz exaustiva.

### 4. Mais de uma matrícula atual

**Contexto:** a ficha suporta mais de um vínculo atual e hoje renderiza um cartão grande por vínculo.

**Pergunta:** mostrar os dois resumos juntos, selecionar uma turma de cada vez ou destacar uma e recolher as demais?

**Recomendação:** mostrar resumos compactos de todas as turmas atuais, com detalhes no contexto de cada vínculo. Evita esconder um vínculo ativo e evita repetir cartões grandes.

**Resposta aceita:** “um resumo so, alterando no seletor qual turma se trata. Nao vamos fazer isso agora”. Rejeitada a exibição simultânea de vários resumos. Direção futura: um resumo, com seletor de turma. Implementação dessa mudança expressamente adiada, sem tratá-la como requisito imediato desta entrega.

### 5. Distinções adicionais verificadas para o próximo batch

- Negociação é uma tratativa por parcela, não um booleano global. Pode reduzir encargos, adiar vencimento para data futura ou ambos.
- Adiamento altera vencimento e suspensão, retirando temporariamente o atraso. Após a nova data, saldo não pago volta a vencer segundo essa data.
- Reduzir apenas encargos não retira automaticamente o saldo principal restante do atraso.
- Pagamento parcial reduz o saldo e mantém em atraso o que ainda venceu; não é sinônimo de negociação.
- Material com venda registrada conta como adquirido mesmo sem pagamento, evitando duplicar compra. Pendência de recebimento pertence ao financeiro.

Fontes: [treatment-preview.ts](../../packages/api/src/finance/internal/treatment-preview.ts), [treatment-confirm.ts](../../packages/api/src/finance/internal/treatment-confirm.ts), [student-treatments.tsx](../../apps/web/src/features/financial-treatments/student-treatments.tsx), [material-reminder.ts](../../packages/domain/src/material-reminder.ts).

## 20. Variantes adicionais verificadas após a rodada 5

A situação de matrícula, sozinha, não determina se existe atenção pendente. Combinar vínculo, continuidade, registros, desempenho, material e financeiro; não transformar essa matriz numa nova visão geral agregada na ficha, que foi rejeitada.

| Combinação                                                           | Evidência atual / lacuna                                                                                                      | Tratamento a confirmar ou já aceito                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Entrada futura pronta, mas material do próximo estágio ausente       | Lembrete atual busca vínculos já iniciados e não encerrados com progresso/plano atual; pode não cobrir entrada futura isolada | Pendência de material é independente da matrícula, conforme correção do usuário                                                  |
| Semestre encerrado, sem matrícula seguinte e/ou material             | Organização some sem vínculo considerado atual; lembrete pode desaparecer ao encerrar vínculo/progresso                       | Mostrar separadamente preparação da matrícula e do material; não exigir mudança de turma para reconhecer necessidade de material |
| Aluno sem vínculo atual, atendimento anterior ainda sem resultado    | Carrossel mostra “a registrar”, mas fica somente leitura                                                                      | Decidir permanência da atenção; caminho de execução será definido depois                                                         |
| Vínculo encerrado, decisão acadêmica anterior pendente               | Acesso às avaliações está no cartão atual; histórico não fornece acesso equivalente                                           | Não confundir encerramento do vínculo com conclusão acadêmica                                                                    |
| Entrada futura ou saída, ocorrência ainda nova                       | Registros são consultáveis, mas não existe sinal de novidade implementado                                                     | Decidir alcance do sinal sem interpretar conteúdo nem definir ciclo de resolução                                                 |
| Frequência baixa com reposição apenas agendada                       | Cálculo considera compensação realizada, não reserva                                                                          | Agendamento não equivale a recomposição da frequência                                                                            |
| Frequência baixa apenas no vínculo encerrado; vínculo atual normal   | Histórico guarda o percentual antigo                                                                                          | Distinguir contexto histórico de problema atual                                                                                  |
| Competência abaixo do corte, média geral alta                        | Cartão usa média de notas lançadas; não sinaliza cada competência                                                             | Não deixar a média ocultar a situação específica já classificada com peso 6                                                      |
| Notas incompletas durante estágio, sem momento exigível identificado | Ausência de nota/média parcial existe; não há prazo suficiente para afirmar atraso                                            | Não inventar vencimento só porque faltam notas                                                                                   |
| PPT atual sem plano                                                  | Workspace admite criação; não há sinal agregado administrativo                                                                | Calibrar atenção do estado                                                                                                       |
| PPT atual com fim previsto ultrapassado                              | Workspace tem sinal de revisão da previsão vencida                                                                            | Calibrar atenção da revisão; não confundir previsão com conclusão real                                                           |
| Próximo estágio indefinido, próximo material ainda desconhecido      | Regra pode indicar “Conferir próximo estágio”                                                                                 | Distinguir definição acadêmica de aquisição de livro; não chamar ambos de falta de material                                      |
| Aluno atual sem estágio/progresso vigente                            | Cartão mostra estágio não informado e ausência de notas                                                                       | Estado de inconsistência/preparação a corrigir, não nivelamento pendente normal após criação                                     |
| Turma do aluno sem professor                                         | Cartão omite professor quando ausente                                                                                         | Sinalizar contexto da turma sem multiplicar a fila de cobertura por cada aluno                                                   |
| Material vendido, ainda sem pagamento                                | Venda já cobre aquisição na regra atual                                                                                       | Distinguir material de recebimento; definição de “resolvido” ainda a confirmar                                                   |
| Negociação com prazo futuro versus somente redução de encargos       | Apenas adiamento muda vencimento e retira atraso temporariamente                                                              | Confirmar alcance da exceção solicitada pelo usuário                                                                             |

Fontes adicionais: [student-pedagogy.tsx](../../apps/web/src/features/students/profile/student-pedagogy.tsx), [student-follow-up.tsx](../../apps/web/src/features/pedagogical-follow-up/student-follow-up.tsx), [current-enrollment.tsx](../../apps/web/src/features/students/profile/current-enrollment.tsx), [student-history.tsx](../../apps/web/src/features/students/profile/student-history.tsx), [enrollment-attendance.tsx](../../apps/web/src/features/students/profile/enrollment-attendance.tsx), [enrollment-grade-average.tsx](../../apps/web/src/features/students/profile/enrollment-grade-average.tsx), [material-needs.ts](../../packages/api/src/finance/internal/material-needs.ts), [workspace.tsx](../../apps/web/src/features/stage-planning/workspace.tsx).

## 21. Rodada 6 — respondida; perguntas encerradas pelo usuário

Esta rodada fechou critérios de negociação, desempenho e material. O usuário limitou o foco às pendências discutidas no Início, com a mesma hierarquia nas demais páginas, e encerrou expressamente as perguntas. As respostas abaixo prevalecem sobre as recomendações anteriores.

### 1. Quando a dívida negociada sai da atenção

| Situação                                                   | Recomendação                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Dívida de 45 dias negociada para a semana seguinte         | Sair da atenção de atraso enquanto o novo prazo estiver vigente |
| Novo prazo negociado passou sem pagamento                  | Voltar à atenção conforme o novo atraso                         |
| Negociação apenas reduziu encargos, mantendo saldo vencido | Continuar sinalizando saldo vencido                             |

**Pergunta:** esses três tratamentos representam a exceção pretendida para dívida negociada?

**Resposta aceita:** “ok. Precisa ter a opcao de perdoar dentro do modal de negociacao. Permitir colocar o valor inteiro no perdao”. Confirmados os três tratamentos. Adicionado requisito explícito: o modal deve permitir perdão do valor integral do saldo devido, incluindo principal, sem ficar limitado à redução dos encargos que a tratativa atual oferece. Não confundir perdão com pagamento recebido. A implementação fica para o trabalho posterior, não foi iniciada durante a entrevista.

### 2. O vínculo acabou, mas o trabalho anterior não

| Situação                                                       | Recomendação                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Atendimento anterior ainda sem resultado                       | Continuar sinalizando na aba correspondente                              |
| Avaliação anterior sem decisão final                           | Continuar sinalizando na aba correspondente                              |
| Ocorrência ainda nova, mesmo sem matrícula atual               | Manter sinal de novidade, sem avaliar conteúdo                           |
| Frequência baixa só no vínculo antigo, frequência atual normal | Manter como histórico; não gerar alerta atual por esse percentual antigo |

**Pergunta:** concorda com essas distinções? O fluxo de execução permanece para depois.

**Resposta:** “irrelevante agora”. Assunto retirado da discussão e da expansão de escopo atual. As recomendações desta subseção não foram aprovadas nem rejeitadas como política futura. A decisão anterior sobre dívida após saída, com a exceção negociada, permanece válida.

### 3. Desempenho atual com sinais aparentemente contraditórios

| Situação                                                      | Recomendação                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Frequência de 65%, reposição agendada mas ainda não realizada | Manter atenção; reserva não compensa falta                        |
| Competência abaixo de 60, apesar da média geral alta          | Manter sinal da competência, conforme peso 6 aceito               |
| Estágio em andamento e notas ainda não exigíveis              | Informação; não tratar como atraso apenas por estarem incompletas |

**Pergunta:** esses tratamentos estão corretos?

**Resposta aceita:** “ok”. Manter atenção enquanto a reposição está apenas agendada; sinalizar competência abaixo do corte mesmo com média alta; não tratar notas ainda não exigíveis como atraso.

### 4. Quando o material deixa de estar pendente

**Contexto:** ter turma futura não elimina a necessidade do livro. A regra atual considera venda registrada como aquisição, mesmo sem recebimento, e não comprova entrega física por esse critério.

**Pergunta:** para esse sinal, basta aquisição registrada ou é necessário confirmar que o aluno recebeu o material?

**Recomendação:** inicialmente usar aquisição registrada; pagamento pendente fica exclusivamente no financeiro. Se entrega física for indispensável, registrá-la como requisito específico, sem fingir que a regra atual de venda já a comprova.

**Resposta aceita:** “aquisicao reigstrada”. Aquisição registrada resolve a pendência de material. Não adicionar confirmação de entrega física como pré-requisito. Pagamento pendente continua sendo assunto financeiro.

### 5. Estados de planejamento ainda sem peso

| Situação                                                                       | Nota recomendada |
| ------------------------------------------------------------------------------ | ---------------- |
| Aluno PPT já estuda, mas não tem plano de estágio                              | 5                |
| Fim previsto do plano passou e o estágio continua em andamento                 | 6                |
| Aluno já estuda, mas o cadastro não tem estágio/progresso vigente identificado | 7                |

**Pergunta:** quais notas de 0 a 10 você atribui? O último caso é uma inconsistência a corrigir, não uma autorização para criar aluno com nivelamento pendente.

**Resposta de escopo:** “estou falando das pendencias discutidas na pagina de inicio, mas aplica mesma hierarquia”. Aplicar às pendências já discutidas a hierarquia aceita, inclusive nas páginas relacionadas. Não interpretar essa resposta como aprovação individual das três notas sugeridas ou autorização para expandir o inventário de pendências de planejamento. Não abrir nova rodada para esses casos.

**Encerramento:** “ja chegam de perguntas”. Entrevista encerrada por instrução do usuário, sem alegar que todas as sugestões ou detalhes foram aprovados. Não solicitar nova confirmação nesta etapa nem iniciar implementação a partir do encerramento das perguntas.

## 22. Ramos reservados para depois

- Fluxo de trabalho: definido posteriormente pelo usuário; entrevista encerrada, sem novas perguntas planejadas.
- Visualizações secundárias: aprofundar gradualmente após a base agrupada por tipo de trabalho; não abrir agora uma expansão de escopo.
- Múltiplas turmas na ficha: direção escolhida de um resumo com seletor, mas implementação explicitamente adiada pelo usuário.
- Desenho visual: comparar alternativas estruturais compatíveis com as decisões aceitas e validar no navegador quando houver protótipos.
- Implementação: usar as decisões consolidadas quando o usuário definir o trabalho seguinte. O encerramento das perguntas não inicia automaticamente alterações de produto.

## 23. Registro de decisões

| Item                                                         | Situação                                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Escopo além do Início, incluindo aluno e partes relacionadas | Confirmado pelo usuário                                                                                             |
| Mapear a codebase antes da entrevista contextualizada        | Confirmado pelo usuário; levantamento registrado aqui                                                               |
| Estruturar mapa e entrevista em arquivo                      | Confirmado pelo usuário                                                                                             |
| Foco de operação                                             | Administração                                                                                                       |
| Papel do Início                                              | Sinalizar e direcionar ao lugar de resolução; ações embutidas só conforme uso justificar                            |
| Qualidade das páginas de destino                             | Melhorar o destino quando não tratar adequadamente o estado                                                         |
| Trabalho versus indicadores                                  | Trabalho primeiro; informações e métricas depois                                                                    |
| Critério geral de atenção                                    | Consequência e prazo; volume sozinho não define urgência                                                            |
| Exemplos destacados pelo usuário                             | Aulas sem professor, inadimplência prolongada e ocorrências novas                                                   |
| Respostas das rodadas 1 a 6                                  | Registradas; entrevista encerrada pelo usuário, sem nova rodada                                                     |
| Condição de criação de aluno                                 | Nivelamento desnecessário ou já acertado; corrigir a implementação que hoje permite pendência                       |
| Dívida após saída do aluno                                   | Continua na atenção; prazo renegociado futuro suspende atraso, novo vencimento descumprido restaura atenção         |
| Negociação somente de encargos                               | Mantém atenção se restar saldo vencido                                                                              |
| Perdão no modal de negociação                                | Deve permitir informar o valor integral do saldo devido; não limitar perdão aos encargos                            |
| Material                                                     | Aquisição registrada resolve a pendência; recebimento pendente fica no financeiro                                   |
| Desempenho                                                   | Reposição agendada não compensa; competência baixa não se oculta na média; nota não exigível não é atraso           |
| Pendências anteriores após encerramento                      | Variantes da rodada 6 consideradas irrelevantes agora; não expandir o escopo por elas                               |
| Continuidade                                                 | Considerar ausência de matrícula e ausência de material do próximo estágio como dimensões separadas                 |
| Múltiplas turmas                                             | Futuramente um resumo com seletor; não implementar agora                                                            |
| Ocorrências                                                  | Novidade com peso 7; sem avaliar conteúdo ou criar ciclo aberta/resolvida                                           |
| Atraso financeiro prolongado                                 | Acima de 30 dias como atenção forte                                                                                 |
| Idade de registro pendente                                   | A partir de sete dias ganha destaque maior; antigos continuam pendentes visíveis                                    |
| Faixas de apresentação                                       | 9–10 aviso compacto; 7–8 área principal; 1–6 seção secundária compacta/expansível; 0 fora de pendências             |
| Agrupamento do Início                                        | Por tipo de trabalho; visualizações secundárias evoluem gradualmente                                                |
| Pendências na ficha do aluno                                 | Cada assunto na sua aba; alerta piscando junto à aba no menu; sem resumo global                                     |
| Vínculo de semestre encerrado                                | Referência histórica; explicitar ausência de turma atual quando não houver outra matrícula atual/futura             |
| Prioridade entre módulos e estados                           | Notas e faixas aceitas; desempates e extrapolações para cenários não apresentados ainda não definidos               |
| Novas regras/capacidades                                     | Condição de criação e perdão integral explicitamente definidos; demais sugestões não viram requisito por inferência |
| Direção visual                                               | Não escolhida                                                                                                       |
| Próxima etapa                                                | Usuário definirá fluxo de trabalho; sem implementação de produto nesta entrevista                                   |
