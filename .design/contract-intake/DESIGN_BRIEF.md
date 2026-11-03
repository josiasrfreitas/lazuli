# Design Brief: modal de contrato

## Escopo confirmado

Somente o modal/etapa de criação de contrato. Renovação e estados da página do aluno serão
tratados depois, conforme orientação de 29/10/2026. As demais etapas do cadastro e a organização
de turmas ficam fora deste trabalho. Componentes compartilhados não autorizam alterar esses fluxos.

O [mapa de estados](STATE_MAP.md) preserva o levantamento anterior à implementação, decisões
do usuário e propostas ainda abertas. O usuário escolheu **Resumo ao lado** em 29/10/2026:
resumo à esquerda e campos à direita, implementados no produto. **Desktop é a prioridade**;
a cobertura estreita é complementar. Protótipos só devem ser feitos quando pedidos explicitamente.

## Direction contract

THESIS: preencher um assunto por vez mantendo o acordo visível à esquerda.

OWN-WORLD: sistema visual do Lazuli, tokens semânticos, superfícies neutras e resumo na cor
da navegação; Cambria/Georgia no texto e Calibri nos valores. Controles existentes e compactos.

STORY: identificar o responsável e o período, resolver mensalidades, escolher os livros e o
pagamento do material, conferir e concluir. A navegação preserva os valores preenchidos.

FIRST VIEWPORT: resumo lateral compacto à esquerda, com assuntos editáveis;
área principal à direita com apenas o assunto atual; rodapé estável com uma ação primária.
Em telas estreitas, resumo recolhível acima dos campos. Valores de ensino e material separados.

FORM: Resumo ao lado, alternativa 7, seed d061a8b8, escolhida explicitamente pelo usuário.
Implementação direta no modal real. A interação principal é editar um assunto a partir do resumo
sem perder o restante do acordo.

FINISH: revisão final e evidência manual registradas em IMPLEMENTATION.md, com esta superfície
documentada conforme o código. Esta extensão usa o sistema visual existente, sem alterar tokens globais.

## Problema

Quem atende o aluno precisa registrar um acordo enquanto conversa com a família. Antes desta
implementação, o formulário expunha decisões e detalhes com peso semelhante, misturava escolha
de material com pagamento e escondia a prévia inteira enquanto algum campo distante estava
incompleto. Preencher e revisar exigiam manter informações demais na memória.

## Resultado desejado

Um percurso compreensível em que cada bloco responde uma pergunta: quem paga e qual é o período;
quanto custa o ensino e quando será cobrado; quais materiais adquirir e como pagar; o que será
criado ao concluir. A pessoa consegue corrigir uma escolha sem recomeçar.

## Princípios

1. **Uma decisão principal por contexto.** Detalhes de bolsa, encargos e parcelamento aparecem
   quando necessários, com uma ação dominante.
2. **Cada valor tem nome e destino.** Mensalidades, taxa inicial e repasse de material são
   apresentados separadamente; aquisição não significa recebimento realizado.
3. **O formulário acompanha a conversa.** Aproveita dados conhecidos, mantém posição dos campos,
   preserva o rascunho durante a navegação e explica o que precisa ser revisto.

## Sistema visual existente

- Modo Impeccable: Operate; tarefa administrativa de preenchimento recorrente.
- Tipografia interna: Cambria/Georgia; números: Calibri/Segoe UI.
- Temas claro e escuro existentes; preservar tokens semânticos e preferência do usuário.
- Controles compactos, raios pequenos, agrupamentos por espaço e alinhamento.
- Primitivas: Dialog, FormSection, FormRow, Field, CurrencyInput, SearchSelect, SegmentedControl,
  Tooltip, FieldError e Button. Nenhum novo sistema visual global.
- Datas e valores com largura suficiente para seu conteúdo; nomes e acordo usam a largura restante.

## Inventário implementado

| Elemento                     | Situação                          | Uso                                                                                |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| Modal e rodapé               | Implementado                      | Área estável, uma ação primária e retorno secundário                               |
| Dados do aluno               | Implementado                      | Busca/cadastro no modal avulso; identidade vem das etapas anteriores no cadastro   |
| Responsável financeiro       | Implementado                      | Campos abertos desde o início e após copiar; busca de pagador existente preservada |
| Vigência e acordo            | Implementado                      | Datas agrupadas; texto explica que o início define o primeiro vencimento           |
| Mensalidades e bolsas        | Implementado                      | Prévia independente; bolsa e condições em blocos recolhíveis                       |
| Taxa de matrícula            | Implementado                      | Opcional, alinhada à mensalidade em campos curtos                                  |
| Material                     | Implementado para aquisição atual | Livros antes de faixa e pagamento; cotação considera apenas livros selecionados    |
| Combinado futuro de material | Lacuna de produto                 | Não criar controles que aparentem salvar dados sem persistência                    |
| Resumo por assunto           | Implementado                      | À esquerda no desktop; mensalidades legíveis com outros assuntos incompletos       |
| Navegação de assuntos        | Implementado                      | Responsável e período, mensalidades, material didático, conferir contrato          |

## Interações e estados essenciais

- Caminho comum com poucos campos; bolsa parcial abre o acordo; integral retira parcelas do ensino.
- Bolsa de material é independente da bolsa de mensalidade.
- Nova aquisição revela livros e pagamento; sem aquisição não exige cotação.
- Navegar entre assuntos preserva o preenchimento e volta ao início do painel.
- Copiar usa o Tooltip do design system e identifica aluno ou responsável conforme a origem.
  O ícone continua visível após copiar ou selecionar; a dica automática espera 650 ms, aparece
  por 4,5 s e tem intervalo de 30 min por origem na sessão. Hover continua disponível.
- Erros locais abrem o assunto e os blocos recolhíveis antes de focar o campo inválido. Os campos
  do pagador permanecem abertos no cadastro e após copiar.
  Erros de carregamento permitem tentar de novo.
- No cadastro, `deferStudentValidation` delega a validação do aluno ao fluxo pai. O modal avulso
  expõe nascimento e documento do responsável exigidos pelo validador.
- Revisão apresenta cobranças por natureza e data; não confunde valores a cobrar com já recebidos.
- O rascunho financeiro permanece enquanto o diálogo está montado. O fechamento segue o
  comportamento de cada entrada; persistência entre sessões ainda não existe.

## Alternativas estruturais exploradas

Lista de trabalho em ordem de adequação à tarefa, antes da escolha do usuário:

1. Quatro subetapas sequenciais, progresso superior e resumo curto por etapa.
2. Dois momentos maiores: condições de ensino e aquisição de material, com conferência final.
3. Seções expansíveis em uma coluna; concluídas viram resumo e a próxima abre.
4. Resumo do acordo como documento editável, expandindo um trecho por vez.
5. Índice lateral de assuntos com navegação livre e indicador de pendência por assunto.
6. Percurso de perguntas dependentes, uma decisão curta de cada vez.
7. Uma área de preenchimento guiado ao lado de um resumo persistente do acordo.

Na comparação anterior à escolha, as alternativas 7, 4 e 1 usaram o mesmo cenário ilustrativo,
com material sendo preenchido e ensino já definido. Seed de superfície: `d061a8b8`, modo Operate,
construção em código. A alternativa 7 foi aceita e aplicada ao modal real.

| Direção apresentada | Vantagem                                               | Custo                                                                   |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Resumo ao lado      | Mantém o combinado visível enquanto resolve um assunto | Modal mais largo; resumo precisa recolher em telas pequenas             |
| Acordo editável     | Facilita conferir e corrigir diretamente               | Demanda sinalização clara da próxima pendência para quem começa do zero |
| Etapas curtas       | Reduz opções simultâneas e dá uma sequência previsível | Mais avanços/retornos; resumo precisa evitar trabalho de memória        |

## Responsividade e acessibilidade

No desktop, resumo à esquerda, painel de campos à direita e rodapé estável. Datas e valores têm
larguras curtas; nomes e acordos recebem o espaço restante. Resumo e painel rolam quando necessário.
Em largura estreita, o resumo recolhe acima dos campos. O formulário permite Enter para avançar
ou validar; a troca de assunto reposiciona foco e rolagem. Erros usam texto e foco; valores derivados
usam anúncio não interruptivo. A cobertura manual de teclado não foi exaustiva.

## Fora do escopo

- Redesenhar renovação, perfil do aluno, listas de contratos ou organização de turmas.
- Criar controles de pagamento recebido, comprovantes ou terceiro que realizou o pagamento.
- Mudar regras de preço, bolsas, calendário, receita ou criar persistência de rascunho sem decisão.
- Criar previsão de compras, posse externa ou garantia de preço futuro como se já existissem.
- Introduzir logística de entrega de material ou despesas/lucro.

## Próximos trabalhos registrados

1. Após resolver este modal, mapear estados e subestados de renovação de contrato.
2. Depois, mapear estados e apresentação da página do aluno.
3. Retomar integração da organização dentro de Turmas com as regras de material já esclarecidas.

## Evidência e aceite

Em 29/10/2026, os fluxos reais do cadastro e do modal avulso foram exercitados no navegador Orca.
As capturas estão em `.impeccable/review/contract-setup/desktop.png` e `mobile.png`; a segunda
mostra a rota real em iframe temporário da mesma origem, com 390 CSS px, como cobertura complementar.
Não é teste em dispositivo nativo. A captura desktop adicional
`.impeccable/review/contract-setup/desktop-scholarship-error.png` registra a bolsa recolhida
reaberta pela validação, com foco no acordo obrigatório e erro visível.
[IMPLEMENTATION.md](IMPLEMENTATION.md) registra o veredito **ship para os dois achados tratados**,
com a distinção entre essa prova no navegador e o contrato de erro do pagador, sem caso bloqueado
reproduzido. Persistência final e falhas de rede não foram exercitadas.
