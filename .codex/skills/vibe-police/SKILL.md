---
name: vibe-police
description: >-
  Integrate vibe-coded MVP work into Lazuli through complete vertical workflows: select slices,
  choose few valuable tests, run checks, then activate PRs, spawn the security agent and
  monitor CI with babysit-pr while they work. Group related features according to the owner's delivery plan; report changed lines excluding tests, documentation and scripts. Use for MVP branch extraction or when
  the user invokes vibe-police; ordinary isolated edits do not require this entire workflow.
---

# Vibe Police

A execução restante de `operacao-pedagogica` deve produzir **exatamente três PRs, sem mínimo ou máximo de linhas**, por decisão do proprietário:

1. Operação pedagógica.
2. Entrada, comercial e contratos.
3. Organização de turmas e semestre, Log e seed final.

A branch atual, ainda sem PR ou segurança iniciados, compõe o primeiro bloco. Preserve os PRs
já integrados. Faça commits coerentes dentro de cada PR e mantenha funcionalidades acopladas
juntas. Os limites anteriores de linhas foram revogados.

Entregue um ou mais fluxos reais relacionados por PR, extraídos da branch do MVP e utilizáveis
sobre a base de integração.
Leia `AGENTS.md`, `CONTEXT.md`, o work item e as decisões aceitas pertinentes antes de definir
o aceite. A branch de origem é material a avaliar; seu comportamento não define o requisito.
Pedido de criar/editar esta skill ou apenas planejar slices não inicia entregas no GitHub.

## Dependências e papéis

Esta é a skill principal do workflow. Localize as instalações de `pr` e `babysit-pr` no
catálogo de skills e leia cada `SKILL.md` ao chegar à etapa indicada abaixo. Use o watcher
incluído em `babysit-pr`; não copie sua implementação nem fixe caminhos pessoais neste repo.
Verifique a disponibilidade das duas skills, do watcher, dos modelos e do acesso ao GitHub
no início. Se faltar algo, avance apenas nas etapas independentes e reporte o bloqueio concreto.

| Papel       | Configuração exigida             | Responsabilidade                                                  |
| ----------- | -------------------------------- | ----------------------------------------------------------------- |
| Coordenador | Modelo da sessão                 | Recortar, implementar, selecionar evidências, corrigir e entregar |
| Segurança   | OpenAI Sol 6.1, esforço `medium` | Revisão de violações e falhas exploráveis, incluindo retestes     |

Delegue segurança a um agente separado do implementador, com override explícito de modelo
OpenAI Sol 6.1 e `reasoning_effort: "medium"`. Confirme os IDs e opções no runtime antes de
despachar. Se a configuração exigida não estiver disponível, informe o que falta e peça uma
alternativa; registre o modelo efetivamente usado. O coordenador implementa as correções.

O workflow **não possui etapa nem agente de QA funcional**, conforme decisão do proprietário.
As verificações da implementação, segurança, CI e PullFrog permanecem obrigatórias. Não inicie
rodadas de QA nem recrie a antiga cadência alternada.

## Navegador

Use o navegador do Orca via `$orca-cli` nas verificações de UI da implementação
e nos retestes no app real. Leia a skill `orca-cli` e o guia servido pelo executável da sessão antes de
controlar o browser. Confirme a worktree e a URL; registre o `browserPageId` junto à worktree para
retomar a página correta. Mantenha o Chrome DevTools MCP encerrado;
não o inicie nem o use como alternativa ao navegador do Orca.

## 1. Inventariar rotas e extrair o bloco

Identifique origem, destino e seus SHAs. **A partir desta etapa, tome as decisões de extração
por rota real do frontend da origem, dentro dos três blocos definidos pelo proprietário.**
Enumere as páginas pelo código do snapshot preservado, incluindo rotas dinâmicas, grupos,
redirecionamentos, prévias e workshops. Para cada rota, siga layouts e imports até componentes,
API, regras, persistência e jobs envolvidos.

Registre todas as variantes encontradas: papéis e permissões, parâmetros de caminho/query,
estados vazio/carregando/erro/dados, abas/filtros, diálogos, ações e condições de renderização.
Leia também os componentes compartilhados alcançados por esses caminhos. Dê a cada variante
um destino e um estado separado de implementação e de conferência de comportamento. Um índice
automático de arquivos ou condicionais ajuda a localizar trabalho; não substitui a leitura do
código nem comprova cobertura de variantes.

Mantenha o inventário versionado e ligado ao SHA da origem. Associe cada rota e variante às
issues de aceite, ao bloco/PR de destino e à evidência no head final. Alterações de lint/review
precisam preservar os comportamentos identificados; registre divergências intencionais com
motivo e requisito que as autoriza. Testes e expectativas continuam fundamentados no aceite e
nas invariantes, sem ajustes apenas para acompanhar a implementação nova. Preserve as correções
já integradas à main.

Jobs, importações, scripts, seed e dependências sem rota também precisam de destino explícito.
Prévias, workshops e trechos sem uso real exigem decisão registrada; sua existência não comprova
conclusão de produto. Antes de concluir cada PR, reconcilie todas as rotas/variantes atribuídas
a ele. Antes de concluir a execução, reconcilie o inventário inteiro contra a main observada.

Um slice contém ator, gatilho, ciclo de trabalho, resultado persistido e forma de consultá-lo.
Inclua interface, autorização no servidor, regras, persistência e trabalho assíncrono quando
forem necessários. O fluxo precisa funcionar sem código pendente da branch de origem.
Uma edição isolada, scaffold, CRUD técnico ou PR só de backend/frontend não é um slice.

Exemplos de fronteiras a verificar contra o aceite:

- Presença: professor abre o encontro da turma, registra a chamada e consulta o resultado salvo.
- Avaliações/notas: cria ou seleciona a avaliação, lança resultados por competência e confere
  a consolidação prevista no aceite.
- Turmas: organiza a turma e seus participantes e consulta a composição efetiva.
- Planejamento: prepara o plano de aulas, salva e retoma o plano no contexto do professor.

“Experiência do professor” pode conter vários desses fluxos. Agrupe funcionalidades por sentido
lógico: mesma jornada, contexto de uso ou dependência funcional. Cada fluxo deve estar completo dentro do bloco correspondente. Reorganize dependências
transversais conforme o uso real, preservando os outros dois blocos e evitando endpoints, links
ou telas sem comportamento implementado. A contagem de linhas é informativa.

Use uma branch/worktree limpa derivada do destino, preservando a origem e trabalho concorrente.
Extraia somente mudanças necessárias ao fluxo, inclusive dependências transversais mínimas.
PRs em sequência devem partir da base já integrada. Não empilhe uma camada incompleta para
fazer a contagem caber. Alterações de UI seguem também `docs/frontend/README.md`.

Mantenha uma issue central da execução com todos os PRs, entrega, contagem e estado. Atualize-a
a cada abertura, mudança relevante e merge; mantenha-a aberta até concluir todas as funcionalidades
solicitadas. Uma issue por PR não é necessária: reutilize as issues de origem e registre o escopo,
aceite, invariantes, exclusões, dependências e origem/destino na issue central ou no work item
existente, consolidando as evidências no corpo do PR após a abertura. Crie issues adicionais apenas
quando houver trabalho próprio a acompanhar, como um defeito reproduzido e sem duplicata.
A execução deste workflow autoriza essas atualizações de acompanhamento.

**Saída:** bloco implementado sobre a base, acompanhamento central atualizado e escopo revisável.

## 2. Escolher evidências e executar checks

Antes de escrever testes, siga [`docs/testing/README.md`](../../../docs/testing/README.md).
Rankeie candidatos por valor, fundamente as expectativas fora da implementação e acrescente
somente os que protegem uma falha relevante ainda não coberta. Zero novos testes é aceitável.
Registre no acompanhamento central ou no PR uma justificativa curta dos selecionados e candidatos a omissão/remoção.
Não transforme essa avaliação em uma bateria automática de testes por função ou camada.

Execute formatação, lint, typecheck e testes relevantes antes de abrir o PR. Consulte os scripts
atuais e os gates de CI; inclua build quando afetado, qualidade dos testes tocados e checks de
migrations quando aplicáveis. `pnpm test:affected --base <destino>` pode selecionar os testes;
confira o que ele efetivamente executou. Testes existentes relevantes continuam obrigatórios.
Registre comando, resultado e SHA; diferencie falha preexistente, falha introduzida e impedimento
de ambiente. Um gate necessário bloqueado não é aprovação para avançar à revisão.

Inspecione o diff completo e `git diff --check`. Faça um commit local e execute a contagem abaixo
em checkout limpo, antes de publicar o SHA. Corrija falhas antes de avançar.

### Contagem informativa e rastreabilidade

Execute o helper no checkout limpo, com a base real atualizada:

```bash
python3 .codex/skills/vibe-police/scripts/check_pr_size.py --base origin/main
```

O relatório separa produto, testes, documentação, scripts e binários. Registre adições + remoções;
configuração, migrations e lockfiles contam como produto. Não existe gate de mínimo ou máximo.
Repita após correções para manter a evidência ligada ao SHA final.

Mantenha um inventário versionado dos arquivos alterados desde a base comum até o snapshot
preservado da origem e uma matriz dos requisitos. Cada entrada precisa de destino em um dos três
blocos, evidência de integração ou exclusão justificada. Diferenças e arquivos idênticos são pistas
para revisão, não prova de que uma jornada está concluída. Antes de encerrar a execução inteira,
audite a matriz contra a main efetiva e as verificações dos fluxos; nenhum item pode ficar sem destino.

**Saída:** SHA limpo, checks pertinentes aprovados, seleção de testes justificada e escopo rastreável.

## 3. Abrir o PR e iniciar as revisões em paralelo

Leia `$pr` e use seu template **Summary → Evidence → Merge Danger** como corpo explícito do PR,
mesmo que o template padrão do GitHub seja diferente. Inclua a menor visualização útil, vínculo
à issue central e às issues de origem pertinentes, evidência real antes/depois, checks e contagem. Declare segurança pendente ao
abrir; atualize os resultados e seus SHAs conforme chegarem. Não fabrique execução anterior
se a base não puder rodar: declare a limitação e use o diff ou comportamento ausente como
evidência verificável. Consolide aceite, evidências e rodadas de revisão no corpo do PR.

Siga esta ordem em cada PR, após checks locais e contagem aprovados:

1. Confira branch/base, faça push e **abra ou ative o PR como pronto para revisão**. Se estiver
   em draft, use `gh pr ready`. Confirme PR aberto, `isDraft: false` e o SHA limpo enviado.
2. **Só então faça spawn do agente de segurança** sobre esse mesmo SHA, sem aguardar CI.
3. **Ligue imediatamente `$babysit-pr` enquanto segurança trabalha**, usando seu watcher e
   protocolo de acknowledgement para acompanhar CI e PullFrog. Não espere as revisões terminarem
   para iniciar o acompanhamento.

Para corpos multilinha com `gh`, use arquivo temporário e `--body-file`. Nos retestes, confirme
que o PR continua ativo, retome segurança no novo SHA e mantenha o babysit em paralelo.

A execução deste workflow autoriza commits/pushes de correções no escopo, abertura do PR e
manutenção das issues; não autoriza merge, fechar PR, dispensar reviews ou responder a terceiros.
Autorizações explícitas do usuário continuam válidas. PR aberto não significa pronto para merge.

## 4. Segurança durante o PR

### Segurança com OpenAI Sol 6.1 / medium

Delegue durante o PR conforme [references/reviews.md](references/reviews.md#segurança).
Forneça diff completo, SHA, aceite e fronteiras de confiança. Corrija violações confirmadas;
registre a evidência para descartar falsos positivos. Após correções, execute os checks afetados
e atualize a contagem antes do push; encaminhe reteste de segurança no novo SHA.
Mudanças fora do escopo viram pendências explícitas.

**Saída:** configuração de revisão confirmada e nenhum achado de segurança confirmado do slice
sem tratamento. Incerteza relevante ou risco que exige decisão do dono bloqueia a entrega.

## 5. Concluir o acompanhamento do PR

PullFrog faz parte do ciclo: trate seus comentários e reviews como feedback a verificar no código.
A presença de `.github/workflows/pullfrog.yml` não prova que houve review. Confirme a revisão do
head atual; CI verde com PullFrog ausente ou pendente ainda não conclui este workflow. Retome o
mesmo watcher, respeitando seu orçamento de espera, e reporte bloqueio se a revisão não chegar.

Após qualquer correção, atualize evidências, contagem e revisões afetadas para o novo SHA antes
de concluir. Siga os limites de tentativas e tempo de `babysit-pr`; timeout não significa sucesso.

**Conclusão:** PR com escopo completo e contagem registrada, CI estável verde, segurança válida para o head final, review
PullFrog recebida e feedback tratado. Reporte link do PR e issue, SHA, contagem, testes escolhidos
e pendências. “Pronto para merge” e “integrado” são estados diferentes: só declare integrado
quando observar o merge. Nunca faça merge automaticamente.
