# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the label strings used in **Linear**.

| Label in mattpocock/skills | Label in Linear     | Meaning                                  |
| -------------------------- | ------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`      | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`        | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`   | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`   | Requires human implementation            |
| `wontfix`                  | `wontfix`           | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), apply the corresponding label in Linear.

## Workflow states

Linear may also use workflow states outside the canonical triage set, for example:

| State     | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| `blocked` | Cannot proceed until a named dependency, decision, credential, or sample exists |
| `done`    | Completed and accepted                                                          |

Use canonical triage labels when a skill asks for triage. Use `blocked` only when the issue itself names the blocker.

Edit the right-hand column to match whatever vocabulary you actually use in Linear.
