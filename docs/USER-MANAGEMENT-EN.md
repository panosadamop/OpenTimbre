# User & role management

Open **Administration** in the Studio. The tab is visible only to accounts with the *View users* or *View activity log* permission.

## Roles and permissions

Every user has exactly one role. A role is a named set of permissions:

| Permission | Id | Grants |
|---|---|---|
| Cloud workspace | `workspace.use` | Save songs, upload recordings, manage instrument libraries |
| Publish to catalogue | `catalogue.publish` | Make library metadata public |
| Synthesis | `synthesis.use` | DSP and neural synthesis jobs, list own models |
| Neural training | `neural.train` | Train models on linked recordings |
| Recording analysis | `recordings.analyze` | AI recording assistant |
| View users | `users.view` | User list, roles, statistics |
| Manage users | `users.manage` | Create, edit, disable/enable, reset passwords, sign out, delete |
| Manage roles | `roles.manage` | Create/edit/delete roles and assign roles to users |
| View activity log | `audit.view` | Audit log of sign-ins and admin actions |

Built-in roles:

- **Superadmin**: every permission. Locked: it cannot be edited or deleted.
- **Administrator**: all studio features plus view/manage users and the activity log. It cannot change roles.
- **User**: all studio features. New registrations and Google/GitHub sign-ups get this role. Existing users keep the same access they had before this release.

Custom roles can be created under **Roles & permissions**. Built-in roles other than Superadmin can be edited but not deleted. A custom role can only be deleted when no user has it.

## Users

- **New user**: password accounts only. The initial password can be generated, in which case it is shown once, or set manually (12+ characters).
- **Edit**: name, email (password accounts only; Google/GitHub emails come from the provider), role, and active/disabled.
- **Reset password**: generated or manual. All of the user's sessions are signed out.
- **Sign out everywhere**: ends every active session of the user.
- **Disable**: the user cannot sign in and their current sessions end immediately. This is reversible.
- **Delete**: permanently removes the account and all of its workspace items, recordings, libraries and trained models. You must type the user's email to confirm.

## Safeguards

These are enforced by the API, not only hidden in the UI:

- Only a superadmin can modify, disable, delete or sign out a superadmin, or grant the Superadmin role.
- Nobody can grant a role, or give a role permissions, beyond what they hold themselves.
- You cannot change your own role, disable your own account or delete yourself. You also cannot remove *Manage roles* from your own role.
- At least one active superadmin must always remain.

The bootstrap CLI is still available for the first superadmin and for recovery:

```bash
cd services/ai
ADMIN_EMAIL=you@example.org python create_superadmin.py
```

## Sessions

Sessions are 24-hour signed cookies that also carry a per-user token version. Disabling a user, resetting their password or using *Sign out everywhere* increases that version, which invalidates every existing session immediately. Every request re-checks the account, so a role change takes effect on the user's next action.

## Activity log

The log records sign-ins, failed and blocked sign-ins, registrations, and every user and role change, with the actor, the target and a short detail. Passwords are never logged. You can filter by event type or search by email.

## API

All endpoints are under `/api/v1/admin` and require the permission shown.

| Method & path | Permission |
|---|---|
| `GET /summary`, `/users`, `/roles`, `/permissions` | `users.view` |
| `POST /users`, `PATCH /users/{id}`, `POST /users/{id}/password`, `POST /users/{id}/revoke-sessions`, `DELETE /users/{id}` | `users.manage` (role changes also need `roles.manage`) |
| `POST /roles`, `PATCH /roles/{name}`, `DELETE /roles/{name}` | `roles.manage` |
| `GET /audit?q=&action=&limit=&offset=` | `audit.view` |

`GET /api/auth/me` returns the signed-in user's `role` and `permissions`.

## Upgrading

The database migrates automatically on first start. The migration:

- adds the new user columns;
- removes the old `CHECK(role IN ("user","superadmin"))` constraint;
- creates the role and audit tables.

Back up `auth.sqlite3` before upgrading a production install.
