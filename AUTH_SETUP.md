# OAuth / Identity Setup

## Architecture

- Identity provider: Keycloak OIDC
- Web app login: Next.js auth redirect endpoints
- Local authorization: `users` table remains source of truth
- Telegram linking: still bot-driven through `POST /api/bot/link-telegram`

## Environment Variables

Add these to the `web` service and local `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/west_santo_travel?schema=public
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=replace-with-a-long-random-secret
KEYCLOAK_ISSUER_URL=http://keycloak:8080/realms/west-santo
KEYCLOAK_CLIENT_ID=west-santo-web
KEYCLOAK_CLIENT_SECRET=replace-with-keycloak-client-secret
```

## Keycloak Configuration

Create:
- Realm: `west-santo`
- Client: `west-santo-web`
- Client type: OpenID Connect
- Access type: confidential
- Valid redirect URI: `http://localhost:3000/api/auth/callback`
- Valid post logout redirect URI: `http://localhost:3000/`

Do not enable open self-registration for privileged roles.

## Local Authorization Rules

After successful OIDC authentication:
- resolve local user by email
- deny if no local user exists
- deny if `is_active = false`
- enforce admin-only APIs in backend route handlers
- use `requireApiRole("ADMIN")` on admin mutation endpoints

Denied message:
- `Your account is not enabled for this application. Contact an admin.`

## Current Files

- Agent spec: [oauth-agent.md](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/oauth-agent.md)
- Project agent definition: [.agents/oauth-agent.md](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/.agents/oauth-agent.md)
- Auth routes: [apps/web/app/api/auth/login/route.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/app/api/auth/login/route.ts)
- Auth routes: [apps/web/app/api/auth/callback/route.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/app/api/auth/callback/route.ts)
- Auth routes: [apps/web/app/api/auth/logout/route.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/app/api/auth/logout/route.ts)
- Middleware: [apps/web/middleware.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/middleware.ts)
- Session helpers: [apps/web/lib/auth/session.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/lib/auth/session.ts)
- Role/API guards: [apps/web/lib/auth/guards.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel%20/apps/web/lib/auth/guards.ts)

## Integration Notes

- Drivers still do not get web login in v1.
- Telegram linking remains outside web login.
- Admin provisioning in the app must happen before a Keycloak-authenticated user can access the app.
