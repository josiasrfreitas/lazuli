# Design Brief: V1 — Turmas e matrículas

Data: 07/10/2026. Work item: [#157](https://github.com/josiasrfreitas/lazuli/issues/157).
Contexto e decisões de domínio: [brief do módulo pedagógico](../DESIGN_BRIEF.md).

## Problema

A administração precisa encontrar uma turma, compreender sua organização e gerenciar quem
participa dela. Essas operações exigem contexto da turma, não uma página de aluno com abas
para todo o módulo. Ao matricular, pausar ou retornar um aluno, também precisa distinguir o
vínculo vigente da programação futura e preservar o percurso pedagógico anterior.

Os problemas concretos e cenários estão nas seções 1–6 do brief do módulo: contexto próprio da
turma, continuidade do percurso, diferenças Regular/PPT, capacidade informativa, vigência das
movimentações e impacto das correções retroativas.

## Solução e sucesso esperado

Uma tabela de turmas leva à página única de cada turma. Nela, dados essenciais e alunos ficam
visíveis; formulários contextuais registram criação, matrícula e movimentações. A administração
consegue concluir a operação, recarregar a página e reconhecer o resultado persistido, incluindo
a distinção entre hoje e uma data futura. Voltar à tabela preserva o contexto de busca.

Essa é a direção escolhida pelo usuário. A composição visual do workshop foi rejeitada e o
protótipo foi descartado. Layouts internos descritos na arquitetura são propostas para a
implementação, não evidência de aprovação visual.

## Usuário e acesso

Usuário primário: administração da escola. Manter o acesso administrativo já aplicado pelos
procedures de turmas e matrículas, refletido na navegação e no servidor. Não ampliar acesso a
professores ou secretaria por inferência do nome de uma função operacional. Usar professores
já habilitados enquanto V2 é planejada.

## Princípios de experiência

1. Contexto antes da ação: identificar turma, horário, estágio e ocupação antes de matricular.
2. Flexibilidade explícita: indicar excesso de capacidade sem introduzir autorização extra.
3. Continuidade legível: separar vigente, programado e histórico sem esconder os efeitos da ação.

## Direção estética

Interface operacional compacta, sóbria e legível, seguindo as tabelas e formulários do Lazuli.
Título e uma ação dominante por contexto; dados relacionados alinhados, campos curtos com
largura adequada e conteúdo principal próximo ao cabeçalho. Evitar cartões decorativos,
painéis de métricas sem necessidade e várias ações com o mesmo destaque.

Referências: DataTablePage, tabela de alunos e padrão DenseForm do Storybook. Reutilizar
Cambria nos textos, fonte numérica nos números e os tokens semânticos existentes. Não introduzir
paleta, fontes ou sistema de temas próprios. [Referência de tokens](DESIGN_TOKENS.md).

## Decisões e limites do produto

- Regular usa estágio compartilhado; PPT usa estágio individual. Presencial/online é outro eixo.
- Capacidade só informa: matrícula em turma cheia não exige motivo ou autorização adicional.
- Pausa libera vaga na data efetiva. Retorno escolhe turma e preserva histórico; não garante a
  vaga anterior nem prorroga automaticamente o prazo do plano.
- Permitir hoje e datas futuras; cancelar programação antes da efetivação mantendo seu registro.
- Correção passada exige justificativa e avaliação de impactos. Seu tratamento concreto ainda
  precisa de decisão antes da escrita do slice 4.
- Movimentação não avança estágio, aprova aluno, redefine plano, gera cobrança nem muda por si
  só a situação cadastral do aluno.
- Não assumir exclusividade por trilha. Preservar proteção contra duplicidade na mesma turma.

## Inventário de componentes

| Componente                                                  | Tratamento                                     | Uso                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AppShell, SidebarNav, MobileNavigation                      | Reutilizar; estender configuração de navegação | Entrada Turmas no grupo Pedagógico.                                                       |
| DataTablePage, DataTable, TablePagination                   | Reutilizar                                     | Listagem e relação de alunos com estados e paginação.                                     |
| DataTable                                                   | Modificação possível, restrita                 | Navegação acessível por linha, caso o contrato atual seja insuficiente; manter link real. |
| TableFilterControls, TableFilterChips, SearchSelect         | Reutilizar                                     | Busca, filtros e seleção remota.                                                          |
| Dialog, FormSection/FormRow, Field, Input, SegmentedControl | Reutilizar                                     | Formulários contextuais e confirmação.                                                    |
| Badge, EmptyState, componentes de carregamento              | Reutilizar                                     | Ocupação, situação e estados da consulta.                                                 |
| Página da turma e formulários de operação                   | Criar em apps/web                              | Composições específicas da feature, sem copiar o protótipo.                               |
| Lista de movimentações e prévia de correção                 | Criar em apps/web                              | Vigência, autoria, cancelamento e impactos.                                               |

## Interações essenciais

Encontrar → abrir turma → consultar alunos → matricular. Criar turma → salvar → abrir a turma.
No vínculo: pausar/encerrar → escolher data → confirmar efeitos → mostrar situação atual e
programada. Para retorno: localizar vínculo pausado → escolher turma → confirmar continuidade.
No histórico: solicitar correção → informar justificativa → avaliar impactos → confirmar quando
as regras desses impactos estiverem definidas. Fluxos detalhados na [arquitetura](INFORMATION_ARCHITECTURE.md).

## Responsividade e acessibilidade

Em desktop, tabela ocupa a área operacional e formulários agrupam campos relacionados. Em
larguras estreitas, toolbar quebra em grupos, formulários passam a uma coluna e a tabela usa
rolagem contida sem causar overflow da página. Não esconder identificação ou operação principal.
Manter navegação móvel do AppShell; não criar outra navegação específica.

Usar links reais para abrir turmas, foco visível, rótulos associados, ordem de Tab previsível,
Enter para submeter formulário e retorno do foco ao fechar diálogo. Evitar controles interativos
aninhados na navegação por linha. Status incluem texto, não só cor. Objetivo de contraste WCAG AA:
4,5:1 para texto normal e 3:1 para texto grande e controles relevantes. Verificar no produto;
reutilizar tokens não comprova acessibilidade automaticamente.

## Fora do recorte e decisões abertas

Transferências, página unificada do aluno, cadastro de professores, frequência, notas, planos e
financeiro não são entregues nesta V1. Não expor arquivamento com vínculos nem edição de horários
com aulas existentes sem definir os impactos. Edição básica não pode reescrever o significado
pedagógico dos vínculos ou aulas. Retorno com mudança de estágio permanece decisão pontual.

## Estado do fluxo

Entendimento consolidado da conversa; brief e IA documentados; tokens reaproveitados; tarefas
em quatro slices numa única issue. Implementação e validação visual permanecem pendentes.
Não há DESIGN_REVIEW porque não há construção desta entrega para revisar. O usuário optou por
refinar diretamente no app e não manter alternativas do workshop.
