# Segurança e acompanhamento do slice

## Segurança

Siga a ordem de ativação, spawn e babysit da skill principal. Segurança começa em todo PR,
com o PR já ativo, sem aguardar CI.
Confirme a configuração exigida na skill principal. O reviewer recebe o PR, o SHA, o aceite e todo o diff,
incluindo schema, jobs, UI e testes, junto do inventário de rotas/variantes do bloco; deve verificar a implementação e as fronteiras reais.
Inspecione o entorno necessário para entender as proteções; mantenha achados fora do slice
separados e não amplie a implementação automaticamente.

Escolha verificações aplicáveis às superfícies alteradas:

- Sessão, papel e autorização por recurso no servidor; alterar IDs não pode contornar a permissão
  sobre turma, aluno ou avaliação. Ocultar controles da UI não comprova essa proteção.
- Validação de payloads, vínculo entre entidades, transações, repetição de comandos e concorrência
  que possam corromper dados ou duplicar efeitos.
- Consultas, renderização, uploads, URLs externas, endpoints e inicialização automática quando
  puderem permitir injeção, execução indevida, exposição ou alteração não autorizada.
- Fronteira de workers: payloads mínimos de identificadores/status; nenhum PII de aluno em
  Hatchet ou logs. Confira também exposição de segredos e PII em erros, respostas e evidências.

Para cada achado, retorne severidade baseada em impacto, ator/pré-condição, caminho explorável,
evidência, regra violada e correção mínima. Diferencie falha confirmada, hipótese a verificar e
falso positivo. Uma checklist genérica ou uma aprovação sem áreas examinadas não é review.
Use reprodução local controlada quando necessária; não ataque serviços reais.

Retorne SHA, modelo/modo efetivamente usados, áreas examinadas, achados e limitações. O
coordenador corrige os achados confirmados e registra o reteste pelo mesmo reviewer/configuração.
Guarde detalhes exploráveis, credenciais e PII fora de issues públicas; o acompanhamento pode
registrar status e impacto sem material sensível. Achados pendentes impedem concluir o slice.

## Registro no PR e na issue central

Consolide aceite, invariantes, exclusões, SHAs, contagem, testes escolhidos, checks, revisões de
segurança, feedback PullFrog e pendências no corpo do PR. A issue central resume link, entrega,
contagem e estado de todos os PRs. Crie issues adicionais somente para trabalho próprio ou defeitos
reproduzidos sem duplicata; evidência de revisão não exige uma issue exclusiva.

```markdown
## Progresso

- [ ] Fluxo completo implementado
- [ ] Checks pertinentes aprovados e seleção de testes justificada
- [ ] Escopo e inventário conferidos; contagem informativa separa testes, documentação e scripts
- [ ] PR aberto ativo antes de iniciar segurança
- [ ] Babysit iniciado enquanto segurança trabalha
- [ ] Segurança Sol 6.1/medium aprovada no head final
- [ ] CI estável e PullFrog final concluídos, feedback tratado
- [ ] Merge observado, quando autorizado
```
