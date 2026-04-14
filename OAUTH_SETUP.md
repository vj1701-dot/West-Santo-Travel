# OAuth Setup

This app uses:
- Keycloak for authentication
- the local Postgres database for authorization

Key rule:
- a user can authenticate with Keycloak and still be denied by the app if they are not provisioned locally or are inactive

## What The App Expects

Web login is only for:
- `ADMIN`
- `COORDINATOR`
- `PASSENGER`

The app does not use Keycloak roles as the source of truth for access.

The app checks the local `User` record by email and requires:
- matching local user exists
- `isActive = true`
- local role is one of the allowed app roles

If not, the user is sent to:
- `/access-denied`

## Required Environment Variables

Set these for the `web` app:

```env
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_URL=http://localhost:3000
KEYCLOAK_ISSUER=http://localhost:8081/realms/west-santo
KEYCLOAK_CLIENT_ID=west-santo-web
KEYCLOAK_CLIENT_SECRET=replace-with-keycloak-client-secret
```

Notes:
- `AUTH_URL` must match the public URL users use to reach the app
- `KEYCLOAK_ISSUER` must be the realm issuer URL, not just the Keycloak base URL

Example issuer:

```text
http://localhost:8081/realms/west-santo
```

## Keycloak Setup

For this repo's isolated local stack:
- Keycloak admin UI: `http://localhost:8081/admin`
- default admin username: `admin`
- default admin password: `admin`

This Keycloak instance is separate from any other Keycloak you already run.

### 1. Create A Realm

Create a realm:

```text
west-santo
```

### 2. Create A Client

Create an OIDC client:

```text
west-santo-web
```

Recommended client settings:
- Client authentication: `On`
- Authorization: `Off`
- Standard flow: `On`
- Direct access grants: `Off`
- Implicit flow: `Off`
- Service accounts: `Off`

### 3. Configure Redirect URIs

Add this valid redirect URI:

```text
http://localhost:3000/api/auth/callback/keycloak
```

If deploying elsewhere, also add the real domain:

```text
https://your-domain.example/api/auth/callback/keycloak
```

### 4. Configure Post Logout Redirect URIs

Add:

```text
http://localhost:3000
```

And the production URL if applicable:

```text
https://your-domain.example
```

### 5. Configure Web Origins

For local development:

```text
http://localhost:3000
```

For production, use the deployed app origin.

## Local User Provisioning

Before a user can log in successfully, create the user in the app database.

The email in Keycloak must match `User.email` in the app.

Current admin UI:
- `/admin`

API for creating users:
- `POST /api/users`

Required fields:
- `email`
- `firstName`
- `lastName`
- `role`

Optional:
- `phone`

Example payload:

```json
{
  "email": "admin@example.com",
  "firstName": "West",
  "lastName": "Admin",
  "role": "ADMIN",
  "phone": "15551234567"
}
```

Important:
- create the local user first
- then create the matching Keycloak user

## Login Flow

1. User visits the app
2. App redirects to Keycloak sign-in
3. User authenticates in Keycloak
4. App receives the OIDC callback
5. App looks up local user by email
6. If local user exists and is active, session is established
7. If not, app redirects to `/access-denied`

## Access Denied Cases

The user will be denied if:
- Keycloak did not provide an email
- no local user exists for that email
- local user exists but `isActive = false`
- the user lacks the required role for the requested action

Expected message:

```text
Your account is not enabled for this application. Contact an admin.
```

## Docker Notes

Current `docker-compose.yml` expects:

```yaml
AUTH_SECRET: replace-with-a-long-random-secret
AUTH_URL: http://localhost:3000
KEYCLOAK_ISSUER: ${KEYCLOAK_ISSUER:-http://keycloak:8080/realms/west-santo}
KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID:-west-santo-web}
KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET:-replace-with-keycloak-client-secret}
```

Published local ports:
- app web: `http://localhost:3000`
- app db: `localhost:5432`
- isolated Keycloak admin and realm endpoints: `http://localhost:8081`
- isolated Keycloak db: `localhost:5433`

Inside Docker, the app talks to Keycloak at:

```text
http://keycloak:8080/realms/west-santo
```

From your browser, use:

```text
http://localhost:8081/admin
```

## Quick Test Checklist

1. Start the app
2. Open `http://localhost:3000`
3. Confirm it redirects to Keycloak sign-in
4. Log in with a Keycloak user that has a matching active local user
5. Confirm access is granted
6. Log in with a Keycloak user not provisioned locally
7. Confirm redirect to `/access-denied`
8. Call `GET /api/dashboard` without login
9. Confirm `401`

## Files Involved

Auth and session:
- [apps/web/auth.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/apps/web/auth.ts)
- [apps/web/app/api/auth/[...nextauth]/route.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/apps/web/app/api/auth/%5B...nextauth%5D/route.ts)
- [apps/web/lib/auth/session.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/apps/web/lib/auth/session.ts)
- [apps/web/proxy.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/apps/web/proxy.ts)

Local authorization lookup:
- [packages/data/src/lib/repository.ts](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/packages/data/src/lib/repository.ts)

Docker env:
- [docker-compose.yml](/Users/sadhuvinamrajivandas/West%20Santo%20Travel/docker-compose.yml)
