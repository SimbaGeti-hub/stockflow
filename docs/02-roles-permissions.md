# Roles and permissions

Permissions are enforced by the backend on every request. Hiding a button in the interface is never treated as security. Roles are bundles of permissions, so custom roles can be added later without a rewrite.

Legend: yes = allowed, no = not allowed, own = only records the user created.

## Matrix

| Permission | Owner | Administrator | Staff |
|---|---|---|---|
| products:read | yes | yes | yes |
| products:write (create, edit, archive) | yes | yes | no |
| categories:write | yes | yes | no |
| inventory:read (stock levels and movement history) | yes | yes | yes |
| inventory:adjust (receive stock, corrections) | yes | yes | no |
| suppliers:read | yes | yes | no |
| suppliers:write | yes | yes | no |
| purchases:read | yes | yes | no |
| purchases:create | yes | yes | no |
| purchases:receive | yes | yes | no |
| customers:read | yes | yes | yes |
| customers:write | yes | yes | yes |
| sales:create | yes | yes | yes |
| sales:read | yes | yes | own |
| sales:void | yes | yes | no |
| sales:refund | yes | yes | no |
| reports:view | yes | yes | no |
| reports:export | yes | yes | no |
| audit:view | yes | yes | no |
| users:manage (invite, change role, deactivate) | yes | yes | no |
| settings:manage (business details, currency, tax) | yes | no | no |

## Rules

1. Every business has exactly one Owner. The Owner cannot be removed or demoted.
2. An Administrator can manage Staff and other Administrators, but cannot change the Owner.
3. A user can belong to a business with only one role at a time.
4. A user can never read or change data from a business they do not belong to.
5. Sensitive actions (void, refund, stock adjustment, role change, price change) are written to the audit log with the user and time.
6. Staff see only the navigation items they have permission to use.

## Decisions to confirm

- Staff can record sales but cannot create or edit products, so a cashier cannot change prices.
- Staff can see stock levels and add customers, but cannot receive stock.
- A sale can be recorded without a customer (walk-in).
- Staff can view only the sales they recorded themselves.
