# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

For local-markdown issues, a "label" is the value of the `Status:` line in the issue file.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Local sprint states

The sprint tracker also uses two workflow states that are not canonical mattpocock/skills triage
roles:

| Local state | Meaning |
| ----------- | ------- |
| `blocked`   | Cannot proceed until a named dependency, decision, credential, or sample exists |
| `done`      | Completed and accepted |

Use canonical roles when a skill asks for triage. Use `blocked` only when the project/issue itself
names the blocker, and `done` only after acceptance has been satisfied.

Edit the right-hand column to match whatever vocabulary you actually use.
