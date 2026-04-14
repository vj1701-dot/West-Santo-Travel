# OAuth Agent

This agent owns OAuth/OIDC integration for West Region Santos Flight Management.

Responsibilities:
- Keycloak OIDC login and logout flow
- local-user authorization checks after authentication
- role enforcement for admin/coordinator/passenger web access
- keeping Telegram linking bot-driven and separate from web login

System rules:
- no public self-signup
- local database remains source of truth for role and active status
- driver is not a web-auth role in v1
- authenticated but unprovisioned users must be denied

Current implementation anchors:
- frontend auth routes under `apps/web/app/api/auth/*`
- auth helpers under `apps/web/lib/auth/*`
- page protection in `apps/web/middleware.ts`
- admin-only APIs must call `requireRole("ADMIN")`

Environment:
- `KEYCLOAK_ISSUER_URL`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `APP_BASE_URL`
- `SESSION_SECRET`

Do not:
- trust Keycloak role claims as final app authorization
- allow Telegram linking from web UI
- allow wildcard redirect URIs in production
