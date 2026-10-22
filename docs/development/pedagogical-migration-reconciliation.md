# Pedagogical migration reconciliation

PR #207 rebases the full pedagogical branch on main `8c2e28c`. Both histories created the same
planning, attendance, session-generation and installment-agreement structures under different
migration names. An actual fresh deploy failed on the duplicate `Installment.suspended_until`.
Appending a final migration alone cannot repair a failure earlier in the chain.

On 2026-10-21 the owner explicitly authorized replacing only the 35 source-exclusive migrations
with `20261021150000_integrate_pedagogical_operations`. Every main migration remains unchanged.
This is a one-time exception to the immutable applied-migration rule, not permission to edit
other applied migrations.

## Canonical chain and data preservation

The new migration contains the Prisma schema delta from main, final PostgreSQL CHECK constraints
and partial indexes, and the required main-data backfills. It runs transactionally. Historical
makeups retain IDs, dates, status and recorded actors when imported as pedagogical appointments;
no absent attendance, performed content or coverage is invented. Kids tracks keep their catalog
classification. Intermediate material-order transformations are omitted because those tables did
not exist in main. Existing main rows and historical tables are not deleted.

Two Order CHECK constraints are extended in the new migration to admit the already implemented
contract-material association and one-off direct receipt. The stronger main QR validity, closure,
window lifetime, token, browser and author constraints remain in force.

## Existing development database

The operation-pedagogica DEV database already has the source history. It is preserved unchanged.
Do not run `migrate reset`, edit `_prisma_migrations`, or mark the canonical migration applied merely
to silence divergence. Use a fresh isolated database for canonical-chain validation. Reusing the
old DEV requires a separate reviewed reconciliation: export/backup first, compare complete schema,
constraints and backfill effects, then decide how to transfer data or baseline history. This PR
does not authorize that operation.

## Original history

Original files remain in remote branch
`backup/operacao-pedagogica-pre-rebase-20261021-0563389` at
`056338910a1a183ee70d02fe7ff48308d496b7c1`. Recover an original with
`git show <backup-sha>:packages/db/prisma/migrations/<name>/migration.sql`.
SHA-256 hashes below were checked against the source files before consolidation.

| Original migration                                         | SHA-256                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `20261011014500_admission_candidates`                      | `76cdfa0510e99f8cce1260685f682b3ded5c711b6cb5d84c694d8eb2e770a149` |
| `20261011040000_academic_assessments`                      | `02f646bbbf9aecb3a1dd493a36fc518d910df01cdd25d5de86091c64526b25af` |
| `20261011042000_lead_follow_up`                            | `464277c67da8eeafd14fb89e9f7ddd8796eed4a2d85d8881c8f675d5f8c6fe23` |
| `20261011060000_activity_log`                              | `3efd9e06c3016c4285ca21e3ee429c2dab5790dbebe4069365ba99c22d35f645` |
| `20261011070000_pedagogical_follow_up`                     | `1d34f31cdff93a8ae530321d2b9b78d7f601b47dd1dfcc05ef81db98e8b30fb8` |
| `20261011080000_stage_planning`                            | `8debd42219221619109cbeeca3018badd9259fe251a3c7e0967361bf473b748f` |
| `20261011080100_stage_plan_revision_lifecycle`             | `3b621aec91482402662016df391c08096d3801083097603684caf089fc4aa161` |
| `20261011100000_class_session_records`                     | `2e3a4e4c6e35519be4e6380fcb3a2003ef6e996564ece223e272568e88e0703f` |
| `20261011120000_student_attendance`                        | `ec0c6a463cbff650478f2cdcf3cf1d2a623b50969060a4f99ff6ef435264718d` |
| `20261011140000_pedagogical_appointments`                  | `c76f1caceb1ecaf471a21efc50b61f0796a0870076c501bcad4362e3de0a6c73` |
| `20261011153000_session_generation_requests`               | `7a10f528756c8f00d8136e0ef19970cbad0c5158be4e8c17aa7efa50935cb3b8` |
| `20261011183000_semester_organization`                     | `8d0e18beaf7f452226dd3da0f4894a94349bd99970eab83b9a23730ed2c636cf` |
| `20261014140000_replace_occurrence_addenda_with_editing`   | `7df773cff94b6e7bd0e00ec9488744a3e8407ec6d459d1b2d46f78f112270adc` |
| `20261014160000_interventions_as_treatments`               | `0e7fda4e48c155b6154a25a5f0741b1bad441641e2b199bfa2de4ba9218bfb29` |
| `20261014190000_installment_agreements`                    | `aa49dcdebf3036680b4d3c5a8f81d2acc94d234d8be358b1c69e8078082399a8` |
| `20261018130000_contract_termination`                      | `e747e2e9e81fab050b56f637aead304c406806516d59314c6d126ad18eb0cd7c` |
| `20261018131000_single_settlement_due_date`                | `77d22a5415c047d258e6b90c9ab589d8537b744b71c945eff850016e74b92a09` |
| `20261018170000_continuous_class_organization`             | `b22bb07c272aa909a5946dd85c6b833ea1e843eef6c18f2ae85585323ea889f2` |
| `20261018180000_confirm_existing_class_and_renew_contract` | `c4d85a82bb7e2717abfa19cb3f3cfb33921538bed5f03c0473e756a1b1b5ef66` |
| `20261018220000_book_pricing_by_category`                  | `10d42ccca9e80f02aa016cd26c3065543d0adf951b63107ca81d09880b073cd4` |
| `20261019010000_contract_material_orders`                  | `b679e0f3b02788cd215117c9bd36ecc83ac918643fd8a97bc60b9ea42d12987b` |
| `20261019011000_contract_material_party_source`            | `caca2927cb66021f66b7bf79cfc3f9d1cb6bd2a8473c4a5f14543befb19e6bfc` |
| `20261019140000_material_single_receipt`                   | `c4a055b5868ee9f87c46c751d381da2488c883bf72d3cc6558f504e0c63c377d` |
| `20261019150000_material_sale_items`                       | `8219deb93497ff240bf8e8c5c227b1112ce8131f432c97b1eb0221a5009b519d` |
| `20261019160000_unlimited_material_sale_items`             | `9c378a43b12868da633e1b0de08bdce625318e8b171d346653e9b6f3a9ad52ea` |
| `20261019170000_structured_teaching_programs`              | `3bc91dab69253b2dc58be32e30c183ceaeaf7311bf9c8b12ff38044f5e3f6dca` |
| `20261019200000_lead_placement_assessment`                 | `54567fd787a9ab71431c54d07d30ce5aa768dfcb40a1fd00f870e62a0cc8d4fb` |
| `20261019210000_lead_interest`                             | `85240dfa51964e1378c493cecec260f5115cf77286cc8dcfbbaf1c6a6cd6f8d1` |
| `20261019220000_teacher_workspace`                         | `7e009ebb9aeeeec91209c88847534853fde086810c865e8f253702b0ac1cf9ce` |
| `20261019221000_placement_correction_assignment`           | `411dbe36b50fddd40bee5209ba48fe717f1aab30d16c02f4bcabd3149818db2b` |
| `20261020144156_placement_corrected_file`                  | `234e0c102236ae49ff9c481da79af924ecaf2ea7377457e6e8bed9d6c28222f7` |
| `20261020144535_preserve_existing_reference_updates`       | `4026c40d324763d72f76d43736284512a6166fd79d3d44693aa4df189aa1b5a5` |
| `20261020220000_assessment_file_competence`                | `5aa011cd5ad1005a0e764fc6b052e549833f678a06e3255b340b9677053b3282` |
| `20261021010000_class_organization_continuity`             | `f1a368a86cae8a8292350d4f4970e01a0de515fec2e826b25c5158376300ea6f` |
| `20261021120000_assessment_observations`                   | `881bc9a5c35023c710fb3c20c648f5a36328c56f27a295dbac1f5502536f9d09` |
