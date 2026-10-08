# Design Tokens: V2 — Reutilização do sistema Lazuli

Base: [DESIGN_BRIEF.md](DESIGN_BRIEF.md) e [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md).
A direção é operacional, compacta e sóbria, seguindo o sistema existente. Esta etapa documenta
seu uso na lista de professores, grade semanal e formulários; não gera CSS, paleta ou tema novos.

## Fontes canônicas

Caminhos relativos à raiz do repositório:

| Fonte                                               | Aplicação                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/ui/src/styles/globals.css`                | Entrada dos estilos e tokens compartilhados.                     |
| `packages/ui/src/styles/tokens/color.css`           | Superfícies, bordas, texto, foco e estados em light/dark.        |
| `packages/ui/src/styles/tokens/typography.css`      | Cambria em corpo/títulos e fonte numérica em horários e totais.  |
| `packages/ui/src/styles/tokens/scale.css`           | Espaçamento, controles, raios e dimensões da tabela.             |
| `packages/ui/src/styles/tokens/effects.css`         | Sombras, foco, duração e easing, incluindo efeitos de dark mode. |
| `packages/ui/src/styles/tokens/tailwind-bridge.css` | Classes semânticas disponíveis aos componentes.                  |

O app consome esses estilos via `apps/web/src/app/globals.css`. Preservar o mecanismo atual de
tema, incluindo `.dark`; não criar outro seletor ou estratégia de tema para a V2. Não foi
demonstrada uma lacuna de tokens que justifique estender o sistema nesta etapa.

## Aplicação na experiência

| Contexto                       | Uso dos tokens e componentes                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Página e cadastro              | `background`, `foreground`, `muted-foreground` e superfícies existentes.                        |
| Grade semanal                  | `border` para divisões internas; `border-strong` e agrupamento para delimitar encontros/turmas. |
| Identificação de turma         | Texto explícito e agrupamento; não criar uma paleta aleatória por turma.                        |
| Horários e carga               | Fonte numérica e escala tipográfica existentes; unidade e período sempre legíveis.              |
| Substituição                   | Semântica informativa (`info`/`info-muted`) e texto com responsável e substituído.              |
| Compromisso sem docente        | `warning`/`warning-muted`, acompanhado de Sem professor e acesso à resolução.                   |
| Saída programada               | Data efetiva e aviso legível; distinguir do estado de atuação encerrada.                        |
| Login não habilitado           | Estado informativo com texto, sem aparência de cadastro inválido ou atribuição bloqueada.       |
| Conflito que impede atribuição | `destructive`/`destructive-muted` e identificação dos compromissos conflitantes.                |
| Sucesso e foco                 | `success` quando pertinente; `ring` e variantes de foco existentes.                             |

Usar APIs dos primitives, sem alterar sua aparência interna por classes de consumo. Uma
substituição válida não é erro; um encontro cedido a substituto também não está cancelado.
Preservar essas diferenças em texto e agrupamento, sem depender somente da cor.

## Densidade, dimensões e ação

A grade é uma composição da feature. Uma hora-aula de 60 minutos é uma unidade de domínio,
não um novo token global de altura. A escala visual deve manter alinhamento temporal entre os
dias e acomodar rótulos, sem criar uma altura arbitrária global para todas as agendas futuras.
Seu contrato concreto será validado na construção, dentro das regras de estilos do frontend.

Um encontro de duas horas usa um contorno de grupo e divisor interno; abrir o encontro é uma
única interação. Em tela estreita, dias em sequência preservam identificação, intervalos e
subdivisões. Não transformar o divisor em botão nem forçar todos os detalhes em células mínimas.

Na listagem, Novo professor é a ação dominante. Na consulta individual, a grade pode ser o
conteúdo principal sem um botão primário artificial. No formulário de substituição, Salvar
substituição domina; Cancelar tem menor ênfase. Encerrar atuação fica no contexto próprio.

Formulários seguem DenseForm e os componentes existentes: nome e e-mail recebem mais espaço;
CPF, datas e horários usam larguras adequadas ao conteúdo. As variantes controlam densidade,
raio e tipografia dos controles. Espaçamento externo agrupa dados relacionados.

## Limites e validação

Não adicionar novos tokens, fontes, breakpoints ou bibliotecas de agenda apenas para preencher
esta etapa. Uma necessidade concreta encontrada na construção pode justificar extensão pequena
e compartilhada, documentada no work item.

Validar a composição em desktop e largura estreita, verificando divisores de horas-aula,
agrupamento de turma, substituições, pendências, contraste, foco, campos e overflow. Os tokens
incluem light/dark, mas sua reutilização não comprova contraste ou legibilidade automaticamente.
Seguir `docs/frontend/README.md`, `docs/frontend/forms.md` e `docs/frontend/data-tables.md`.

Esta etapa entrega a referência documental; não há código de interface ou validação visual
produzidos. [TASKS.md](TASKS.md) decompõe a execução em três entregas verticais para uma única issue.
