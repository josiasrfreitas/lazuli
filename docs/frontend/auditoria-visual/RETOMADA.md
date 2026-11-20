# Continuidade da auditoria

A coleta cobriu o navegador embutido do Orca em staging na revisão `c4d3a9247e049c34a2ba3c55def30fd3837b4782`, no desktop e em 390 px. A mesma conta autorizada abriu Administração e Professor. As matrizes preservam o resultado de cada caminho e as capturas por estado. [Matriz pública](matriz.md) · [Matriz autenticada](matriz-diretoria.md)

## O que depende de um cenário adicional

| Fluxo                                         | Até onde chegou                                                                                          | Evidência necessária                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Aula e atendimento com endereço próprio       | A Agenda abre resumos e o contexto Professor abre registro de aula no modal. Atendimentos chega à Agenda | Link navegável da seção de aula/atendimento para os padrões `/aulas/[id]` ou `/atendimentos/[id]`, se estiver exposto em outra situação |
| Ocorrência e intervenção com endereço próprio | As abas do acompanhamento e a abertura de Registrar ocorrência foram observadas                          | Ocorrência e intervenção de QA com ação de abrir o detalhe identificável pela interface                                                 |
| Chamada docente parametrizada                 | Uma aula visível abriu Chamada e registro na própria `/professor/agenda`                                 | Link direto ao padrão `/professor/agenda/[id]/chamada`, caso exista em outro fluxo                                                      |
| Documentos e presença com link válido         | A entrada pública sem QR foi examinada. O QR fictício da prévia leva ao formulário fictício              | QR de QA válido já disponível, com abertura sem gravação ou envio de documento real                                                     |
| Senha com link válido                         | Cadastro expirado, erro e pedido de novo link foram exercitados                                          | Link de cadastro ou recuperação de QA fornecido pelo canal autorizado                                                                   |
| Workshop e Perfil                             | As duas entradas de workshop exibiram 404 em inglês. Perfil chegou a 403 na sessão                       | Confirmar a rota esperada e condições de acesso se essas entradas precisarem oferecer uma tarefa própria                                |

## Como continuar

1. Confirme a revisão de staging e selecione a aba autenticada no Orca pelo `browserPageId`.
2. Escolha Administração ou Professor no seletor da conta. Use o mesmo acesso autorizado e confirme o menu predominante antes de interpretar diferenças.
3. Siga links que a interface expõe. Use 1440 × 900 e 390 × 844, reaplicando a emulação touch quando a navegação reinicializar o viewport.
4. Atualize a matriz e o manifesto após cada lote. Em capturas autenticadas, suprima os dados de cadastro em texto, imagens, campos e camadas flutuantes antes de gravar, e revise os PNGs de modo local. Evite identificadores e links válidos de acesso nos artefatos.
5. Preserve a origem da ação, o resultado visual e o estado que ainda faltar. Use `relacoes-diretoria.md` para relacionar o que se repetir ou divergir entre telas.
