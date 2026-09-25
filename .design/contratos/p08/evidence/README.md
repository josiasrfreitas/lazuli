# P08 visual evidence

Captured from the real `/contratos` page on 2026-09-25 through Orca's browser.
All names and financial facts in these images are temporary local fixtures.

| Capture                                       | Viewport   | What it demonstrates                                                     |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| [Before, desktop](before-desktop-dark.png)    | 1280 × 800 | The table columns from base commit `0efb2c6`, without payment progress.  |
| [After, desktop](after-desktop-dark.png)      | 1280 × 800 | Paid counts, proportional bars, waivers and cancellation details.        |
| [After, mobile dark](after-mobile-dark.png)   | 375 × 812  | The payment column remains readable using the table's horizontal scroll. |
| [After, mobile light](after-mobile-light.png) | 375 × 812  | The same information with the existing light theme tokens.               |

The before capture temporarily used `contract-columns.tsx` from the base commit;
the data and the rest of the application were the same. The implementation was
restored before the mobile captures. These are browser screenshots, without image
editing or substituted DOM content.

The four contracts belong to one payer:

- Ana: five fully paid installments, one partial payment and two waivers in a
  twelve-installment plan → **5 de 12 pagas**, **2 dispensadas**.
- Bruno: no payments → **0 de 12 pagas**.
- Clara: fully paid → **12 de 12 pagas**.
- Davi: the same payments and waivers as Ana, with the order cancelled →
  **5 de 12 pagas**, **2 dispensadas · 5 canceladas**.

The mobile DOM reported `innerWidth = 375` and document `scrollWidth = 375`.
Only the table scrolls horizontally. Progress bars exposed current/maximum values
of `5/12`, `0/12`, `12/12` and `5/12`, with the corresponding Portuguese value text.
Temporary database fixtures were removed after capture.

Execution evidence and the agreed counting rule are recorded in [PLAN.md](../PLAN.md).
