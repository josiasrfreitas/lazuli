# Handoff de Colaboradores e Docentes

Implementar o recorte acordado em 20/11/2026 na branch `feat/catalogo-estagios`.
A issue original também prevê salários e férias. Registre o recorte abaixo na issue
ao entregar e confira sua referência no agrupador de itens fora de escopo.
[ISS45 #298](https://github.com/josiasrfreitas/lazuli/issues/298) ·
[Agrupador #244](https://github.com/josiasrfreitas/lazuli/issues/244) ·
[Fora de escopo #306](https://github.com/josiasrfreitas/lazuli/issues/306)

## Escopo

- Renomear **Comercial** para **Comercial e Pessoas** e acrescentar **Colaboradores**
  ao grupo ao lado de **Leads**. Manter a listagem especializada **Docentes** e os
  links atuais. Para este recorte, manter **Docentes** em **Pedagógico**, na rota
  `/professores`.
- Usar o formulário docente como base para cadastrar e editar nome, dados de
  contato, vínculo, foto, documentos e acesso. Reaproveitar CLT, PJ, Autônomo e
  Outro como tipos de vínculo.
- Adicionar **Área** como enum com Secretaria, Diretoria, Pedagógico e Comercial.
  Adicionar **Cargo** em texto livre. Para a primeira versão, considerar uma área
  e um cargo por cadastro. A opção **Atua como docente** cria o perfil docente
  vinculado. Nesse caso, a pessoa aparece nas duas listagens com o mesmo cadastro.
- Permitir configurar o acesso da conta e suas permissões pelos papéis existentes,
  conforme as regras de administração vigentes. Área, cargo, atuação docente e
  papel de acesso são decisões independentes. A gestão granular de permissões
  tem uma issue própria. [ISS42 #295](https://github.com/josiasrfreitas/lazuli/issues/295)
- Remover **Previsão de férias** do formulário docente, incluindo os campos
  e validações da edição. Preservar as datas já gravadas em edições cadastrais.
- Acrescentar **Score médio dos alunos** na listagem de Docentes, com a regra
  da ficha individual e a estratégia de leitura descrita abaixo.

Fora deste recorte ficam salários, folha, férias, jornada, ponto, carga horária
contratual e os relatórios de conversão comercial. Preservar os fluxos pedagógicos
atuais de aulas, agenda, atribuição de turmas e desligamento docente.

## Colaborador e especialização docente

- **Colaborador** concentra nome, CPF, e-mail, telefone, área, cargo, tipo de
  vínculo, foto e documentos. A conta vinculada concentra o estado do acesso e o
  papel de autorização.
- **Docente** estende Colaborador por uma relação de um para um opcional no
  cadastro comum. Reaproveitar `TeacherProfile`. Manter no perfil as observações
  docentes já existentes (`notes`) e o encerramento da atuação
  (`departureDate`, `departureRecordedAt`, `departureRecordedById`). O perfil é a
  fonte da indicação docente após a migração dos registros antigos.
- **Turmas, agenda e score** aparecem na visão docente. As atribuições e aulas
  continuam nas relações atuais. O score é calculado a partir dos alunos.
- **Dados legados.** Preservar `weeklyHours`, `vacationStart` e `vacationEnd`
  no perfil atual durante a migração. Esses valores não entram nos formulários
  deste recorte.
  [Schema Prisma](../../packages/db/prisma/schema.prisma) ·
  [Encerramento da atuação](../../packages/api/src/teachers/departure.ts)

## Implementação

1. **Cadastro e identidade.** Generalizar o cadastro e reaproveitar `TeacherProfile`
   para a atuação docente. Antes de migrar os dados, verificar como os docentes sem
   perfil são reconhecidos por `teacherIdentityWhere`. Incluir os docentes atuais
   em Colaboradores preservando `User.id`, vínculos, documentos e referências de
   turmas e aulas. Deixar a área desconhecida pendente de preenchimento para os
   registros antigos. Fazer com que as duas telas leiam e editem os mesmos dados
   cadastrais. Usar migração nova para alterações no banco.
   [Schema Prisma](../../packages/db/prisma/schema.prisma) ·
   [Identidade docente](../../packages/api/src/teachers/identity.ts)
2. **Acesso.** Usar `User.role` e `User.isEnabled` para a conta vinculada e manter
   as proteções no servidor, inclusive a restrição de alterações a contas
   `SYSTEM_ADMIN`. Vincular contas existentes ao cadastro e preservar o papel
   da conta ao marcar um colaborador como docente. Manter o acesso desabilitado
   por padrão em novas contas, como no formulário docente. A existência do perfil
   pode habilitar o modo docente para uma conta com acesso ativo. Por isso, a
   criação do perfil também precisa de autorização no servidor. `User.email` é
   obrigatório no modelo atual. Se a operação precisar cadastrar colaboradores
   sem e-mail ou sem conta, confirmar esse requisito com o responsável antes de
   definir o vínculo entre cadastro e conta.
   [Comandos docentes](../../packages/api/src/teachers/commands.ts) ·
   [Regras de acesso](../../packages/auth/src/staff-access.ts)
3. **Formulário e arquivos.** Reutilizar os campos compartilhados, o upload por
   sessão e o acesso autorizado a fotos e documentos. Validar que arquivos
   existentes continuem acessíveis ao editar pelas duas telas e que o servidor
   bloqueie acesso direto sem permissão. Revisar a montagem do payload docente
   e a limpeza de datas em `profileData` ao retirar os campos de férias.
   [Navegação atual](../../apps/web/src/components/app-shell/nav-items.ts) ·
   [Formulário docente](../../apps/web/src/features/teachers/teacher-dialog.tsx) ·
   [Campos de vínculo](../../apps/web/src/features/teachers/teacher-employment-fields.tsx) ·
   [Arquivos privados](../frontend/file-attachments.md) ·
   [API de arquivos docentes](../../packages/api/src/teachers/files.ts)
4. **Score em lote.** Reaproveitar a regra da ficha. Usar as turmas atuais sob
   responsabilidade habitual do docente e fazer a média dos scores disponíveis
   dos alunos, contando cada aluno uma vez por docente. Mostrar **Sem dados**
   quando a média for indisponível. Ler os alunos e seus scores em lote para a
   página exibida. A consulta completa da ficha também carrega presença, notas e
   ocorrências, então extrair apenas a leitura necessária para a coluna. Medir
   latência e contagem de consultas com dados representativos, comparando a
   listagem com e sem a coluna. Se o cálculo pesar no carregamento inicial,
   carregar a coluna em uma chamada em lote após a primeira renderização e
   registrar a medição no PR.
   [Métrica docente](../../packages/api/src/teachers/metrics.ts) ·
   [Leitura de scores em lote](../../packages/db/src/student-health-batch.ts) ·
   [Tabela docente](../../apps/web/src/features/teachers/teacher-table.tsx)

## Aceite

- Criar um colaborador de Secretaria com cargo livre, tipo de vínculo, foto e
  documento. Conferir a edição e a reabertura do cadastro em Colaboradores.
- Marcar um colaborador existente como docente. Conferir sua presença nas duas
  listagens, a edição dos mesmos dados pelos dois caminhos e a preservação do
  papel de acesso. Conferir também um docente já cadastrado com turma, observações
  e arquivos. Validar que encerrar a atuação preserve o papel administrativo de
  uma conta que também exerce docência.
- Habilitar e desabilitar o login com uma conta autorizada. Exercitar os endpoints
  de edição e leitura de arquivos com uma conta sem a permissão correspondente.
- Editar um docente com datas de férias existentes e confirmar que o formulário
  funciona sem os campos de previsão e que as datas gravadas são preservadas.
- Conferir a média da listagem contra a ficha para um docente com aluno em mais
  de uma turma e para outro sem dados. Registrar latência e quantidade de
  consultas para uma página representativa.
- Ler os padrões de frontend antes de alterar a UI. Validar navegação, cadastro e
  tabela no navegador em desktop e largura estreita. Usar as verificações focadas
  durante a implementação e os gates do repositório antes da entrega.
  [Frontend](../frontend/README.md) · [Testes](../testing/README.md)
