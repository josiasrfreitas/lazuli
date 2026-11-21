# Analytics pedagógicos · Briefing da V1

## Problema e público

Na reunião pedagógica, a coordenação quer responder “quantos alunos estamos perdendo?” e investigar as diferenças entre grupos. A página atual organiza a consulta por ano. A escola pensa em viradas entre períodos, como 2026.1 → 2026.2. Uma lista extensa de turmas ou estágios dificulta reconhecer onde uma diferença merece atenção.

## Experiência e critérios de sucesso

1. A coordenação escolhe uma virada, identifica quantos alunos da base saíram e consegue explicar o que aconteceu com quem trocou de turma ou continuou com um contrato longo.
2. Ao investigar uma diferença entre grupos, consegue alternar o indicador mantendo período, filtros e agrupamento. Vê a unidade, o tamanho da base e a cobertura dos registros junto ao resultado.
3. Ao examinar um estágio, consegue distinguir quem ainda aguarda turma regular e quem foi encaminhado ao PPT por causa da oferta. As datas deixam claro qual número descreve a fila em um dia e qual reúne decisões durante um período.

## Conteúdo acordado

### Permanência

Leitura principal da página. Mostrar alunos da base, permanências e saídas registradas para a virada selecionada. Incluir saídas por rescisão durante a vigência e por decisão de não renovar. O vencimento sem decisão registrada permanece em aberto. Uma transferência entre turmas conta como permanência na escola e aparece como informação secundária. Contar cada aluno uma vez na base.

Incorporar o histórico de renovação contratual na mesma seção. Cada ponto representa uma virada identificável e selecionável. Mostrar a quantidade de alunos que renovaram sobre a base com vencimento correspondente. Contratos longos participam da permanência e entram no indicador de renovação quando há vencimento. Incluir vencimentos durante o semestre no grupo daquele semestre. Uma renovação posterior atualiza o desfecho do grupo de origem. Explicitar a data de corte. Os recortes são escola inteira, professor e faixa etária.

Permitir explorar as saídas por tipo de desligamento e pelo motivo informado. A captura nos fluxos de rescisão e não renovação depende da [issue #318](https://github.com/josiasrfreitas/lazuli/issues/318). Preservar a contagem das saídas com motivo desconhecido.

### Indicadores pedagógicos

Score como leitura inicial. Usar o mesmo explorador para frequência, notas e ocorrências, mantendo o recorte ao trocar de indicador. Comparar grupos em barras por professor ou faixa etária. O score pertence aos alunos do grupo. Mostrar a cobertura e permitir consultar os componentes do score. Usar as regras de cálculo do domínio. Contagens, taxas de frequência e escala de notas precisam de rótulos próprios. A normalização de ocorrências por 100 alunos é uma proposta para validar com exemplos.

### Espera e encaminhamentos para PPT

Por estágio, mostrar a fila regular na data de referência e quantas pessoas foram encaminhadas ao PPT no período. Identificar escolha direta por PPT e motivo desconhecido. A alocação em PPT, sozinha, é insuficiente para concluir que faltava oferta regular. O cadastro do motivo na entrada ou na conversa de alocação depende da [issue #319](https://github.com/josiasrfreitas/lazuli/issues/319). Diferenciar ausência de registros históricos de uma contagem observada igual a zero.

## Direção visual e componentes

Proposta para validação: leitura compacta e calma de reunião. Dar destaque à pergunta, ao número e à base correspondente. Reservar o detalhe para a seleção de uma virada ou grupo. Usar cor semântica também nos números, nas legendas e nas superfícies de resumo. Os [tokens da página](DESIGN_TOKENS.css) associam cada leitura à paleta do Lazuli. Identificar períodos comparados por rótulo e traço (contínuo ou tracejado), a virada selecionada por contorno e os desfechos por rótulo e valor. Usar a tipografia, a escala de espaçamento e os tokens semânticos do Lazuli, respeitando os temas claro e escuro.

| Elemento | Ponto de partida | Trabalho previsto |
| --- | --- | --- |
| Seleção de virada, indicador e recorte | SegmentedControl e SearchSelect de @lazuli/ui | Compor controles adequados à quantidade de opções. |
| Histórico de renovação e comparação por grupos | Recharts e componentes existentes de Analytics | Criar as séries com rótulos, bases e seleção acessível. |
| Consulta de números e motivos | DataTable e estados de consulta existentes | Compor o detalhe do recorte e identificar dados indisponíveis. |

Em telas estreitas, permitir reorganização dos filtros e preservar rótulos e bases sem transbordamento. Oferecer os valores por teclado e em texto, com foco visível e distinções que independam de cor ou de passar o mouse. Rótulos em português do Brasil e datas de negócio em America/Sao_Paulo.

## Validação antes de construir

Explorar três composições com os mesmos cenários de demonstração e registrar a escolha da coordenação. Incluir uma transferência, uma saída, renovação tardia, grupo sem base, grupo com base e zero ocorrências, chamada incompleta e encaminhamento PPT sem motivo. Exercitar o fluxo no Orca em desktop e tela estreita.

Antes de fechar as consultas, validar limites das faixas etárias, atribuição a professor em caso de troca, janela da base e tratamento de múltiplos vencimentos do mesmo aluno. Confirmar quais cortes históricos podem ser sustentados pelos registros existentes. Projeções individuais, distribuição detalhada das faixas de score por turma e alterações nos formulários das issues vinculadas ficam fora da implementação desta página.
