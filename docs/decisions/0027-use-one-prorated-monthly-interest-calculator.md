# 0027 Use one prorated monthly interest calculator

Status: Accepted
Decision date: 2026-10-29
Supersedes: The legacy interest-preview exception in [0022](0022-restrict-global-settings-to-system-administrators.md)

Tuition settlement uses one monthly simple-interest rate, initially 2%, prorated by elapsed
civil days on a 30-day basis. A second daily rate and monthly-anniversary charges made the
same overdue balance accrue two charges; the separate 1% ledger preview used a different
base and rounding rule. Keep one calculation based on dated principal, payments, charge
adjustments and suspensions. Carry fractional cents across periods and round the cumulative
amount once; confirmation posts only interest not already recorded. Payments satisfy charges
before reducing principal, and interest never earns interest.

Settings retain one monthly percentage, copied into the contract. Contract renewal retains
that snapshot. Settings authorization and the contractual snapshot boundary in 0022 remain
in force. Material, enrollment fees and standalone settlement orders do not gain automatic
interest. The ledger and dashboards report recorded balances; settlement previews calculate
new interest without writing facts.

This is a pre-production replacement: drop the daily columns and API fields, normalize the
existing monthly snapshots to 2%, and remove the unused ledger preview and its fallback.
There is no old-formula reader. Applied migrations stay immutable. Rebuild development
fixtures through the public seed after coordinating the loss of manual validation data;
changing a rate alone cannot repair payments already allocated under the earlier formula.
