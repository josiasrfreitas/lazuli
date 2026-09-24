# 0022 Restrict global settings to system administrators

Status: Accepted

Global finance settings affect the terms offered for future agreements. `SYSTEM_ADMIN` is a separately provisioned staff role. It inherits current `ADMIN` access and is the only role permitted to read or save `/ajustes` and its tRPC procedures. `ADMIN` continues to manage ordinary school operations but cannot change these global conditions. Both route and procedure authorization enforce the boundary; navigation reflects it but is not the security gate.

Production provisioning is manual and explicit: an operator identifies an existing pre-provisioned `User` by verified email, approves the change, and updates that row's `role` to `SYSTEM_ADMIN` in a controlled database operation. Do not promote accounts automatically, create a self-service role editor, or change the ordinary administrator during migration. Development seed creates `sistema@lazuli.local` as a distinct account.

The singleton stores current settings and update attribution. A future contract must copy the offered terms when signed. Existing installment adjustments retain amounts already applied. Historical orders without a contract snapshot retain their legacy interest preview.
