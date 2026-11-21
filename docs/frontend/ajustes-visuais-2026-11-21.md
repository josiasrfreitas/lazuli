# Ajustes visuais de 21 de novembro de 2026

| Tela               | Pedido atendido                                                                                                                          | Verificação                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estágios           | A divisória superior da lista ocupa toda a largura. Busca, filtro Legacy, reordenação e exportação compartilham a mesma barra.           | No navegador, a largura da barra coincidiu com a do contêiner no desktop e a 390 px.                                                                                         |
| Navegação lateral  | A decisão final foi manter no tema claro o azul de Nova track e aumentar o contraste dos textos e ícones.                                | O navegador mostrou a cor de fundo `#305985` na navegação e no botão.                                                                                                        |
| Conta              | O avatar recebeu um fundo da paleta da navegação e iniciais claras.                                                                      | Estilo conferido no componente.                                                                                                                                              |
| Atividades da hora | Adicionar atividade usa o cursor de clique. A alça indica arraste.                                                                       | Regras de cursor e handlers conferidos no código.                                                                                                                            |
| Páginas do livro   | O hover abrange o cabeçalho da página até a ação de editar.                                                                              | Seletor conferido no contêiner que inclui os dois botões.                                                                                                                    |
| Colaboradores      | Busca, filtros e cadastro ficam alinhados. Os filtros de área e presença de perfil docente são aplicados no servidor antes da paginação. | No navegador, os três controles tiveram a mesma coordenada vertical no desktop. O filtro Pedagógico exibiu o estado sem resultados e limpar restaurou os sete colaboradores. |
| Docentes           | As colunas foram redistribuídas. Os títulos longos podem quebrar linha e a tabela só precisa rolar quando falta largura.                 | Em uma janela de 1382 px, o conteúdo e a área visível mediram 1285 px. Todos os títulos couberam nas respectivas células.                                                    |

A suíte completa fica para a abertura do PR. Na verificação a 390 px em Colaboradores, a barra de controles coube nos 342 px disponíveis. O documento mediu 425 px de largura, indicando transbordamento fora da barra que requer diagnóstico separado.

## Anexos de colaboradores

O painel acompanha o tema do cadastro. A caixa vazia reúne um clipe em um círculo, uma mensagem e a ação de escolher o primeiro arquivo. Os anexos salvos ficam numa lista com rolagem própria. Cada item expande para mostrar os detalhes e a ação de download. Imagens têm miniatura e prévia ampliada. PDFs usam um ícone de documento.

O QR Code continua acessível no cabeçalho. Sua entrada respeita a preferência por movimento reduzido. A página de envio no celular usa a mesma caixa inicial e oferece a escolha da categoria antes do envio.

Verificação no navegador do workspace: em um cadastro novo, o primeiro envio de uma imagem de teste exibiu a miniatura. A expansão mostrou os metadados e o link de download com o nome original. O QR Code foi gerado e a página de captura, aberta a 390 px, listou o arquivo enviado pelo computador.
