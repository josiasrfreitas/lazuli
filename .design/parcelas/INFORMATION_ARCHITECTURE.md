# Information Architecture: Lazuli — Display de Parcelas

> Complementa `DESIGN_BRIEF.md`. Este slice cobre somente a consulta operacional de parcelas; ações
> financeiras e navegação para contratos permanecem fora do escopo.

## Recorte #52

Somente Todas e Pagas estão habilitadas nesta entrega; Vencidas mostra o contador da API, mas sua
ativação e agrupamento pertencem à #57. Os fluxos agrupados abaixo descrevem essa entrega futura.
Na #52, `status=vencidas` é removido junto de `pagina`, preservando `busca`. Valores inválidos
usam defaults seguros. Busca (máximo de 80 caracteres, debounce de 300 ms) e troca de tab removem
`pagina`. Sem `status`, a API recebe `view=all`; `status=pagas` recebe `view=paid`.
A paginação fixa de 25 itens não oferece seletor. Ao exceder o total, a URL volta à última página
válida (ou à primeira se vazia). Navegação externa cancela qualquer busca pendente.

O header e os controles dividem a faixa de `DataTablePage` e quebram em linhas quando necessário.
`TableContainer` ocupa o restante do viewport, com cabeçalho fixo, scroll interno e rodapé.
A rota exige ADMIN no servidor; o AppShell continua encaminhando visitantes sem sessão ao login.
Início mantém Alunos como destino de ADMIN.

## Site Map

- Início `/` — redireciona para a primeira vertical disponível ao papel autenticado
- Alunos `/alunos` — vertical existente
- Financeiro — seção não clicável da navegação
  - Parcelas `/parcelas` — consulta do ledger, disponível somente para `ADMIN`

`/parcelas` é a única rota deste slice. Tabs, busca e paginação são estados da mesma view; não há
rota de detalhe, painel lateral, modal ou destino associado às linhas.

## Navigation Model

- **Navegação primária:** a sidebar do `AppShell` mantém Início e Alunos no primeiro nível e
  acrescenta a seção não clicável **Financeiro**, com Parcelas como seu primeiro item. A seção
  prepara o crescimento futuro para destinos relacionados sem prometer links ainda inexistentes.
- **Controle de acesso:** a seção Financeiro só é renderizada quando possui ao menos um destino
  permitido. Neste slice, Parcelas e, portanto, a seção aparecem somente para `ADMIN`, espelhando a
  autorização do backend.
- **Navegação secundária:** tabs **Todas**, **Vencidas** e **Pagas** dentro de `/parcelas` filtram a
  mesma view e atualizam a URL; não são sub-rotas.
- **Navegação utilitária:** identidade e papel permanecem no rodapé da sidebar; data de trabalho
  permanece na topbar. A vertical não acrescenta busca global nem ações utilitárias.
- **Navegação mobile:** fora do escopo. A composição preserva integridade básica abaixo de 1280 px,
  mas não introduz um novo modelo de navegação móvel.

## Content Hierarchy

### `/parcelas`

1. **Orientação da página:** título “Parcelas” e subtítulo “Mensalidades e vencimentos” deixam claro
   que a consulta representa o ledger completo, sem mês implícito.
2. **Controles de consulta:** busca por pagador ou beneficiário à esquerda e tabs Todas, Vencidas e
   Pagas à direita, seguindo a composição existente de Alunos.
3. **Resultado principal:** tabela de parcelas com as colunas Parcela, Pagador, Beneficiário(s),
   Vencimento, Valor e Status. Todas é a tab padrão e oferece a visão geral do ledger.
4. **View operacional dominante — Vencidas:** preserva a mesma estrutura tabular, mas intercala um
   resumo por pagador antes de suas parcelas. É onde se concentra o trabalho de priorizar cobranças
   por atraso e saldo, embora não seja o estado inicial da página.
5. **Continuidade da consulta:** paginação abaixo da tabela mantém busca e tab na URL. Loading,
   vazio, ausência de resultados e erro ocupam o mesmo frame estrutural dos dados.

## User Flows

### Consultar o ledger completo

1. O administrador abre `/parcelas`.
2. A tab Todas aparece selecionada porque `status` está ausente da URL.
3. O administrador lê as parcelas na ordem operacional definida no brief.
4. Se necessário, pagina; a URL registra `pagina` e preserva os demais filtros.

### Localizar parcelas de um pagador ou beneficiário

1. O administrador digita um nome na busca.
2. Após o debounce, `busca` é atualizado na URL e `pagina` volta ao padrão.
3. O servidor busca tanto pelo pagador quanto pelos beneficiários.
4. Em Todas e Pagas, aparecem somente parcelas correspondentes. Em Vencidas, a correspondência
   qualifica o pagador e a tabela mostra seu grupo vencido completo, preservando contagem e saldo.
5. A tabela apresenta os resultados ou orienta a ajustar o termo quando não houver correspondência.

### Priorizar cobranças vencidas

1. O administrador seleciona Vencidas; a URL passa a conter `status=vencidas` e limpa `pagina`.
2. A camada web traduz a tab para `view=overdue` no input da procedure.
3. A tabela apresenta grupos de pagadores, ordenados pelo maior atraso e por `payerId` em empate.
4. O administrador lê primeiro o resumo do pagador: quantidade vencida, beneficiários, atraso mais
   antigo e saldo coletável.
5. Em seguida, confere as parcelas do grupo, da mais antiga para a mais recente, com desempate por
   `installmentId`.
6. Se houver mais de dez pagadores, pagina sem dividir um grupo entre páginas.

### Consultar parcelas pagas

1. O administrador seleciona Pagas; a URL passa a conter `status=pagas` e limpa `pagina`.
2. A camada web traduz a tab para `view=paid` no input da procedure.
3. A tabela plana apresenta as parcelas integralmente pagas, das mais recentes para as mais antigas,
   com desempate por `installmentId`.
4. A paginação mantém tab e busca na URL.

## Naming Conventions

| Conceito                        | Label na UI     | Notas                                                                        |
| ------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Área financeira                 | Financeiro      | Seção não clicável da sidebar; só aparece quando contém um destino permitido |
| Installment                     | Parcela         | Rota plural `/parcelas`; sequência exibida como `06/12`                      |
| Visão completa                  | Todas           | Tab padrão; ausência de `status` na URL                                      |
| Installment vencida e coletável | Vencidas        | Tab agrupada por `payerId`; `status=vencidas`                                |
| Installment integralmente paga  | Pagas           | Tab plana; `status=pagas`                                                    |
| Payer                           | Pagador         | Pessoa responsável pela cobrança                                             |
| Aluno vinculado ao pedido       | Beneficiário    | Pode haver mais de um por parcela                                            |
| Valor ainda coletável           | Saldo em aberto | Derivado do ledger; nunca persistido                                         |
| Installment dispensada          | Dispensada      | Aparece somente em Todas                                                     |

## Component Reuse Map

| Componente                               | Usado em                                   | Diferenças de comportamento                                               |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `AppShell`                               | `/alunos`, `/parcelas` e futuras verticais | Sem diferença estrutural; sidebar recebe a seção Financeiro               |
| `SidebarNav` / configuração de navegação | Todas as rotas autenticadas                | Renderiza agrupamento não clicável e omite seções sem destinos permitidos |
| Header e container de página             | `/alunos`, `/parcelas`                     | Parcelas não possui ação primária                                         |
| `Input` + `Tabs`                         | Controles de Alunos e Parcelas             | Busca e valores de tabs específicos da vertical                           |
| Primitivos de tabela                     | Todas as tabs de Parcelas                  | Vencidas acrescenta resumo por pagador dentro da tabela                   |
| `Pagination`                             | Todas, Vencidas e Pagas                    | 25 parcelas nas views planas; 10 grupos em Vencidas                       |
| `TableSkeleton` / `EmptyState`           | Loading, vazio, sem resultados e erro      | Conteúdo textual específico de Parcelas; erro oferece retry               |

## Content Growth Plan

- O ledger cresce continuamente, portanto busca, filtros e paginação são server-side desde a primeira
  entrega; a página nunca depende de materializar todo o conjunto no cliente.
- Todas e Pagas paginam 25 parcelas por vez.
- Vencidas pagina 10 grupos de pagadores por vez. O grupo é a unidade de paginação e nunca é dividido
  entre páginas.
- A seção Financeiro pode receber Contratos, Analytics ou outros destinos quando essas verticais
  existirem. Até lá, contém somente Parcelas e não exibe placeholders.
- Uma futura rota de contrato ou detalhe poderá introduzir navegação nas linhas, mas nenhuma reserva
  visual ou URL é criada neste slice.

## URL Strategy

- **Pattern:** rota em pt-BR, substantivo plural: `/parcelas`.
- **Dynamic segments:** nenhum neste slice.
- **Query parameters:** gerenciados com `nuqs`, em pt-BR, opcionais e com defaults removidos da URL:
  - `status=vencidas|pagas`; ausente significa Todas;
  - `busca=<texto>`; ausente significa busca vazia;
  - `pagina=<inteiro>`; ausente significa página 1.
- Alterar `status` ou `busca` remove `pagina`, reiniciando a consulta na primeira página.
- Alterar `pagina` preserva `status` e `busca`.
- URLs inválidas ou valores não reconhecidos retornam aos defaults seguros da listagem.
- **Contrato da procedure:** o input tRPC usa o campo `view=all|overdue|paid`, separado do parâmetro
  localizado da URL. A camada web faz o mapeamento: `status` ausente → `view=all`,
  `status=vencidas` → `view=overdue`, `status=pagas` → `view=paid`.

## Ajuste mínimo do shell aprovado na #52

A verificação em 375 px encontrou a sidebar fixa de 240 px comprimindo os controles. Nesta entrega,
o shell passa a mostrar um menu nativo de navegação abaixo de 640 px e mantém a sidebar em larguras
maiores. O menu reutiliza os destinos e filtros por papel, fecha ao navegar ou pressionar Escape
e devolve o foco ao acionador. A data utilitária do topo aparece a partir de 640 px. O acabamento
ampliado de responsividade continua na #54.
