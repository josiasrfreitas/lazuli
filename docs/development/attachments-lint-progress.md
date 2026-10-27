# Attachments lint progress

> **Closed batch 1:** 50 original errors across the 13 files below; latest remaining: 0 by targeted ESLint, including the new PDF helper.
> **Full baseline:** 129 Web errors, `pnpm -F @lazuli/web exec eslint . -f json -o /tmp/lazuli-attachments-web-lint-baseline.json`.
> **Full lint after batch 1:** 79 Web errors, all outside batch 1, from `pnpm lint --concurrency=1` (log: `/tmp/lazuli-attachments-lint-after-batch1b.log`).
> **Closed batch 2:** 50 original errors across the 11 files below; latest remaining: 0 by targeted ESLint after formatting, including `address-lookup.ts`.
> **Targeted command:** `pnpm -F @lazuli/web exec eslint src/features/student-documents/student-photo.tsx src/features/student-documents/use-capture.ts src/features/students/new-student/address-lookup.ts src/features/students/new-student/address-step.tsx src/features/students/new-student/dados-step.tsx src/features/students/new-student/intake-dialog-chrome.tsx src/features/students/new-student/new-student-dialog.tsx src/features/students/new-student/new-student-navigation.ts src/features/students/new-student/new-student-sources.ts src/features/students/new-student/new-student-view.tsx src/features/students/new-student/reducer.ts src/features/students/profile/student-contact.tsx --quiet` (exit 0).
> **Full lint after batch 2:** 29 Web errors, all in the three files below; `pnpm lint --concurrency=1` (log: `/tmp/lazuli-attachments-lint-after-batch2.log`), JSON snapshot: `/tmp/lazuli-attachments-web-lint-after-batch2.json`. Compared by file, rule, and message with the 129-error baseline: no new errors.
> **Closed final batch:** 29 original errors in the three files below; latest remaining: 0. Targeted ESLint, Web typecheck, all 321 Web unit tests, and root `pnpm lint --concurrency=1` passed (0 errors, 961 warnings). Log: `/tmp/lazuli-attachments-lint-final.log`.
> **Next gate:** review complete diff, format/typecheck/build/integration checks proportionate to deployment, then publish PR and deploy staging. Run one check at a time.

| File under `apps/web/src`                                    | Final batch errors |
| ------------------------------------------------------------ | -----------------: |
| `features/students/profile/registration-document-upload.tsx` |                  2 |
| `features/students/profile/registration-documents.tsx`       |                  9 |
| `features/students/profile/registration-editor.tsx`          |                 18 |

| File under `apps/web/src`                                 | Batch 2 errors |
| --------------------------------------------------------- | -------------: |
| `features/student-documents/student-photo.tsx`            |              7 |
| `features/student-documents/use-capture.ts`               |              6 |
| `features/students/new-student/address-step.tsx`          |             10 |
| `features/students/new-student/dados-step.tsx`            |              2 |
| `features/students/new-student/intake-dialog-chrome.tsx`  |              1 |
| `features/students/new-student/new-student-dialog.tsx`    |              4 |
| `features/students/new-student/new-student-navigation.ts` |              1 |
| `features/students/new-student/new-student-sources.ts`    |              2 |
| `features/students/new-student/new-student-view.tsx`      |             10 |
| `features/students/new-student/reducer.ts`                |              1 |
| `features/students/profile/student-contact.tsx`           |              6 |

Batch 2 closed with Web typecheck and all 321 Web unit tests passing. The 29 remaining errors form the final partial batch of 50.

| File under `apps/web/src`                                | Original errors |
| -------------------------------------------------------- | --------------: |
| `app/api/student-documents/[kind]/route.ts`              |               2 |
| `features/student-documents/capture.tsx`                 |               5 |
| `features/student-documents/delete-document-button.tsx`  |               2 |
| `features/student-documents/mobile-page.tsx`             |               4 |
| `features/student-documents/model.ts`                    |               1 |
| `features/student-documents/panel.tsx`                   |               7 |
| `features/student-documents/pdf-preview.tsx`             |               3 |
| `features/student-documents/prefill.ts`                  |               1 |
| `features/student-documents/qr-dialog.tsx`               |              10 |
| `features/student-documents/result.tsx`                  |              10 |
| `features/student-documents/upload-picker.tsx`           |               2 |
| `features/student-documents/use-capture-session.ts`      |               2 |
| `features/student-documents/use-enrollment-documents.ts` |               1 |

All three batches are closed: the Web lint error count moved from 129 to 79 to 29 to 0, with no new file/rule/message errors in the intermediate JSON comparison. Web typecheck and all 321 Web unit tests pass. The first local application build compiled but stopped during page data collection because `DATABASE_URL` was unset; the deployment build supplies a synthetic URL. Deployment and PR publication remain pending.
