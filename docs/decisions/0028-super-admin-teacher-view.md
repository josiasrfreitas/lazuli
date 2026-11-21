# 0028 Super administrator and read-only teacher access

Status: Accepted

SUPER_ADMIN inherits the administrative permissions of SYSTEM_ADMIN, including global settings. This updates the authorization rule in ADR 0022. Provision the role explicitly on a verified account through the same controlled database process.

Only a super administrator can select another active teacher for read-only access. Check the authenticated actor and teacher eligibility on every request. The selected teacher determines resource scope. The authenticated account remains the actor for attribution. Disabled and departed teachers are unavailable, including through previously saved links.
