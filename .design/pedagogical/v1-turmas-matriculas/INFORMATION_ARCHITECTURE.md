# Information Architecture: V1 — Turmas e matrículas

Base: [DESIGN_BRIEF.md](DESIGN_BRIEF.md). Tabela → página da turma é decisão do usuário.
As composições abaixo concretizam essa direção para implementação; ainda não foram validadas
visualmente no produto.

## Mapa e navegação

- Pedagógico, no AppShell existente
  - Alunos: `/alunos`, experiência existente
  - Turmas: `/turmas`
    - Turma: `/turmas/[id]`

Adicionar somente Turmas à navegação existente, para os papéis administrativos autorizados
no backend. A navegação utilitária permanece no shell. No mobile, usar MobileNavigation.
Formulários de criação, edição, matrícula e movimentação são diálogos no contexto da página;
não criar uma árvore de rotas por ação. A turma é acessível por URL direta.

## Hierarquia de conteúdo

### Tabela de turmas

1. Título Turmas; ação principal Nova turma; busca e filtros próximos à tabela.
2. Linhas identificam turma, organização Regular/PPT, formato, professor, estágio compartilhado
   quando aplicável, horários e ocupação. Nome/código formam o ponto de navegação.
3. Filtros propostos: período, organização, formato, professor e situação; usar opções reais.
4. Paginação e quantidade de resultados pertencem ao frame da tabela.

Ordem inicial estável por identificação; ordenação final deve seguir a convenção das consultas
existentes. Não implementar ordenação por todas as colunas sem necessidade. Ausência de turmas
convida a criar; ausência de resultados convida a ajustar filtros.

### Página da turma

1. Voltar para Turmas; identificação da turma; ação principal Matricular aluno.
2. Resumo compacto: Regular/PPT, presencial/online, professor, período, horários, capacidade
   e estágio compartilhado no regular. Edição tem menor destaque.
3. Relação de alunos, com busca e filtros de situação. Mostrar estágio individual no PPT e
   vigência do vínculo quando relevante. Ações de vínculo ficam junto da linha correspondente.
4. Movimentações programadas e histórico operacional ficam numa seção secundária da mesma
   página, com data efetiva, ação, situação e autoria. Paginar conforme crescer.

Alunos atuais são o conteúdo inicial. Pausados, vínculos encerrados e entradas futuras precisam
ser encontráveis sem parecer ocupação atual. Não acrescentar abas para as outras verticais.
Esta página não cria uma nova página de aluno nem faz o clique no aluno navegar para uma rota
inexistente. Retorno pode começar pela localização do vínculo pausado no fluxo de matrícula,
permitindo encontrá-lo mesmo quando veio de outra turma.

## Fluxos

### Encontrar e abrir

1. Administração busca ou filtra a listagem.
2. Abre a turma pela linha, com link acessível no identificador e sem capturar cliques de outros controles.
3. Consulta o resumo e os alunos; URL direta funciona sem depender da listagem montada.
4. Voltar restaura filtros/página quando houver contexto; entrada direta volta à listagem padrão.

### Criar e editar turma

1. Nova turma abre formulário de organização, formato, professor habilitado, período,
   horários, capacidade e identificação conforme as regras existentes.
2. Regular exige estágio compartilhado e usa a convenção existente de nome; PPT não exige
   estágio compartilhado e usa nome manual conforme a validação atual.
3. Erros ficam associados aos campos, preservando preenchimento. Sucesso abre a turma criada.
4. Edição básica atualiza dados permitidos; não incluir mutações com impactos pedagógicos ou
   de agenda ainda indefinidos apenas porque existe um campo no banco.

### Matricular e retornar

1. Na turma, Matricular aluno permite localizar o aluno e distinguir nova matrícula de retorno
   de um vínculo pausado. Não tratar retorno como cadastro de um aluno novo.
2. Nova matrícula mostra turma de destino, data de entrada e estágio: herdado no regular,
   selecionado no PPT. No retorno, localizar a pausa, escolher destino e mostrar continuidade.
3. Turma cheia informa o excesso, sem bloquear confirmação ou pedir justificativa.
4. Sucesso fecha o formulário, atualiza consultas e mostra vínculo vigente ou programação futura.
5. Retorno com mudança de estágio não recebe comportamento inventado; depende da decisão
   apontada no brief antes de habilitar esse caminho.

### Pausar, encerrar ou cancelar programação

1. Ação contextual identifica aluno e vínculo; formulário solicita data efetiva e explica o efeito.
2. Confirmar uma ação futura a mostra como programada, preservando a situação vigente até a data.
3. Cancelar fica disponível antes da data efetiva e preserva registro da programação cancelada.
4. Ação de hoje atualiza situação e ocupação conforme o efeito. Não alterar notas ou financeiro.

### Corrigir o passado

1. A partir do histórico, escolher a movimentação a corrigir e informar mudança e justificativa.
2. Consultar os registros afetados e mostrar consequências antes da confirmação.
3. Confirmar só quando o tratamento desses impactos estiver definido e validado pelo servidor.
4. Preservar autoria e fato anterior. Se os dados mudarem após a prévia, atualizar a avaliação
   em vez de aplicar silenciosamente uma confirmação desatualizada.

## Estados e recuperação

| Situação                                              | Resposta da experiência                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Carregamento inicial                                  | Estrutura de carregamento do componente; não mostrar vazio antes da resposta.      |
| Atualização de consulta                               | Indicar atualização sem apresentar dados antigos como confirmação da mutação.      |
| Consulta falhou                                       | Mensagem e Tentar de novo; manter busca e contexto.                                |
| Nenhuma turma / nenhum aluno                          | Vazio contextual, com ação principal pertinente.                                   |
| Filtro sem resultados                                 | Explicar ausência de resultados e permitir ajustar/limpar filtros.                 |
| Turma inexistente ou acesso negado                    | Estado específico; não cair silenciosamente em outra turma.                        |
| Formulário inválido ou falha ao salvar                | Preservar valores, apontar erro e permitir correção.                               |
| Operação repetida ou estado alterado por outra pessoa | Resultado consistente do servidor e atualização da consulta; não duplicar vínculo. |
| Programação cancelada                                 | Mostrar cancelamento no histórico; não apagar nem contar como ação futura ativa.   |

## Vocabulário da interface

| Conceito                    | Rótulo                                             |
| --------------------------- | -------------------------------------------------- |
| Class                       | Turma                                              |
| Enrollment                  | Matrícula / vínculo com a turma, conforme contexto |
| Schedule type               | Regular / PPT                                      |
| Format                      | Presencial / Online                                |
| Full / over capacity        | Turma cheia / Acima da capacidade                  |
| Future movement             | Programada, sempre acompanhada da data efetiva     |
| Pause / return / exit       | Pausar / Retornar / Encerrar vínculo               |
| Cancel a scheduled movement | Cancelar programação                               |
| Past amendment              | Corrigir registro                                  |

Pausa do vínculo não é situação cadastral do aluno. “Programada” descreve a movimentação,
não substitui o estado atual do vínculo. Rótulos propostos não exigem enums novos no banco.

## Reutilização, crescimento e URLs

DataTablePage organiza listagem; DataTable e paginação organizam resultados. AppShell fornece
navegação, identidade visual e acesso móvel. Dialog e campos fornecem os formulários. A feature
compõe resumo, alunos e histórico sem criar um shell paralelo.

Busca, filtros e paginação usam parâmetros de query tipados, seguindo o padrão existente com
nuqs e helpers de paginação. IDs identificam turma na rota; nomes podem mudar sem quebrar URL.
Não colocar nomes de alunos ou outros dados pessoais em URLs. Voltar pode reaproveitar histórico
ou estado de navegação; não depender de URL externa de retorno. Paginar turmas, vínculos e
histórico no servidor; filtros remotos não carregam todo o cadastro.

Validar desktop e largura estreita, navegação por teclado, foco dos diálogos, quebra da toolbar
e rolagem contida da tabela em cada slice. Essa verificação acompanha a implementação, não
constitui uma revisão visual já realizada.
