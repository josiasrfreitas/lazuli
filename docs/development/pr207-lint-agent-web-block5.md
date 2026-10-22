# PR #207 — ficha `web-block5`

> **FOCO:** bloco 5 Web, **16 erros restantes projetados** do inventário
> inicial (31 no baseline `c631cf3`): lead e os dois arquivos de
> nivelamento estão com 0 no lint direcionado. O último lint de toda a área
> ainda é `/tmp/lazuli-pr207-block5-current.json` (27, antes da extração).
> Arquivos próprios:
> `apps/web/src/features/admissions/lead-capture-dialog.tsx` (4),
> `placement-assessment.tsx` (11), `placement-schedule.tsx` (7),
> `visit-dialog.tsx` (6) e `apps/web/src/features/shared/task-form.tsx` (3).
> `placement-visit-details.tsx` (extração própria). Próxima ação: verificar
> typecheck da extração, revisar diff de lead/nivelamento e resolver
> `placement-schedule.tsx` (7), `visit-dialog.tsx` (6) e `task-form.tsx` (3);
> não tocar na API em edição.

- Estado: em andamento. `lead-capture-dialog.tsx` dividido em estado, envio,
  agendamento e campos; lint do arquivo: **0 erros, 2 avisos**.
- Lint direcionado de toda a área congelada: **27 erros, 149 avisos**.
- Lint direcionado de `placement-assessment.tsx` e
  `placement-visit-details.tsx`: **0 erros**; snapshot em
  `/tmp/lazuli-pr207-placement-pair-current.json`. O primeiro arquivo foi
  dividido por estados de carregamento; o segundo concentra a visita, prova,
  resultado, professor e cancelamento em componentes menores. Medir a área
  completa depois dos próximos arquivos para confirmar o saldo de 16.
- Último resultado completo: Web 31, API 230 no baseline; bloco Web 16
  projetados, aguardando medição integral após as últimas correções.
- A suíte Web passou com **295/295 testes** após a extração de lead e
  nivelamento (`/tmp/lazuli-pr207-web-tests-block5.log`). O typecheck Web
  repetido não encontrou erros nos arquivos Web alterados; falhou somente em
  `packages/api/src/teacher-workspace/home-planning.ts:108`, em edição pelo
  outro agente. Repetir após estabilizar a API.
- Commit: lead em `e37ab94`. O par de nivelamento passou no lint final com
  0 erros e está pronto para commit.
- Check/commit em execução: commit atômico do par de nivelamento e reserva da
  extração.
- Gate próprio: lint direcionado do bloco 5 zero, typecheck/testes pertinentes,
  lint Web completo e comparação por fingerprint com o snapshot anterior.
- Próximo registro: arquivos alterados, erros medidos, checks e ação seguinte.
