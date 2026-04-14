# OAuth Auth Integration Execution Agent
West Region Santos Flight Management System

## Role

You are the execution agent responsible for implementing Keycloak/OIDC login in this repository's Next.js app while keeping the local database as the source of truth for authorization.

You must work within the existing repository structure and extend the current app rather than redesigning it.

## Objective

Implement production-safe web authentication for the Next.js app using Keycloak over standard OIDC.

The result must:
- require login for protected web pages and protected API routes
- use Keycloak only for identity
- use the local database for authorization
- deny authenticated but unprovisioned users
- preserve Telegram linking as a separate bot-driven flow

## Locked Rules

Do not change these rules:

- No public sign-up
- No custom username/password auth
- No frontend-only authorization
- No reliance on Keycloak roles for application authorization
- No Telegram linking from the web app
- No driver web login in v1

Application web roles remain:
- `ADMIN`
- `COORDINATOR`
- `PASSENGER`

## Current Repository Shape

This repo currently uses:
- Next.js app router in `apps/web`
- Prisma/Postgres schema in `prisma/schema.prisma`
- shared data access in `packages/data`
- direct server-side data access from pages and route handlers

Important implication:
- middleware alone is not sufficient
- every protected page and protected API route must also enforce server-side authorization

## Required Implementation

### 1. Add Auth.js-based OIDC integration

Use Auth.js / NextAuth with a Keycloak provider.

Add:
- `apps/web/auth.ts`
- `apps/web/app/api/auth/[...nextauth]/route.ts`

Responsibilities:
- configure Keycloak provider from env
- export auth helpers
- perform local user lookup during sign-in
- persist only local authorization facts into session/JWT

### 2. Local DB remains source of truth

Use local `User` records for access control.

Login allow rules:
1. user authenticates with Keycloak
2. match local user by normalized email
3. local user must exist
4. local user must be active
5. local role must be one of `ADMIN`, `COORDINATOR`, `PASSENGER`
6. if not provisioned locally, deny access

Do not trust Keycloak role claims for app authorization.

### 3. Add shared server auth helpers

Add:
- `apps/web/lib/auth/session.ts`

This module should expose helpers such as:
- `requireUser()`
- `requireAdmin()`
- `requireRole(...roles)`
- optional `getOptionalUser()`

These helpers should:
- read the current Auth.js session server-side
- ensure a local authorized user is present
- throw or return a standardized unauthorized/forbidden response path

### 4. Protect pages

Add:
- `apps/web/middleware.ts`

Middleware should:
- require authentication for app pages
- redirect unauthenticated users to sign-in
- allow auth endpoints
- allow bot-specific endpoints that should not use web login

But do not stop at middleware.

Also update protected server pages to call `requireUser()` or `requireAdmin()`:
- `apps/web/app/page.tsx`
- `apps/web/app/admin/page.tsx`
- `apps/web/app/itineraries/page.tsx`
- `apps/web/app/transport-tasks/page.tsx`
- `apps/web/app/approvals/page.tsx`
- `apps/web/app/passengers/page.tsx`

Authorization rules:
- `/admin` must require `ADMIN`
- other operational pages should require at least an authorized local user unless stricter rules are warranted by existing behavior

### 5. Protect API routes

Update protected route handlers to enforce local authorization before data access.

At minimum:
- `apps/web/app/api/users/route.ts`
- `apps/web/app/api/users/[id]/route.ts`
- `apps/web/app/api/passengers/route.ts`
- `apps/web/app/api/passengers/[id]/route.ts`
- `apps/web/app/api/itineraries/route.ts`
- `apps/web/app/api/itineraries/[id]/route.ts`
- `apps/web/app/api/itineraries/[id]/segments/route.ts`
- `apps/web/app/api/approvals/route.ts`
- `apps/web/app/api/approvals/[id]/review/route.ts`
- `apps/web/app/api/dashboard/route.ts`
- `apps/web/app/api/transport-tasks/route.ts`
- `apps/web/app/api/airports/route.ts`

Keep this route outside web-login protection:
- `apps/web/app/api/bot/link-telegram/route.ts`

Use local role enforcement:
- user management routes should require `ADMIN`
- approval review should require `ADMIN`
- read/write operations for other operational data should require at least an authorized local user, then tighten further if needed

### 6. Add repository helpers for auth lookup

Update:
- `packages/data/src/lib/repository.ts`
- `packages/data/src/index.ts`

Add a focused helper such as:
- `findAuthorizedUserByEmail(email: string)`

Optional:
- `findAuthorizedUserById(id: string)`

This helper should:
- normalize email to lowercase
- fetch the local user
- include fields needed for authorization
- optionally include scope assignments if they will be enforced now

Do not move business authorization into Keycloak.

### 7. UI integration

Add:
- `apps/web/app/access-denied/page.tsx`
- `apps/web/components/login-button.tsx`
- `apps/web/components/logout-button.tsx`

Update:
- `apps/web/components/app-shell.tsx`
- optionally `apps/web/app/layout.tsx`

Behavior:
- show login entry when signed out
- show current user identity and logout when signed in
- show clear denial message for provisioned/auth mismatch

Required denied-access message:

`Your account is not enabled for this application. Contact an admin.`

### 8. Env and Docker wiring

Update:
- `apps/web/package.json`
- `docker-compose.yml`
- any `.env.example` or setup docs if present

Add dependencies:
- `next-auth`
- `jose`

Add env vars for the web app:
- `AUTH_SECRET`
- `AUTH_URL` or `NEXTAUTH_URL`
- `KEYCLOAK_ISSUER`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`

Optional for local development:
- add a `keycloak` service to `docker-compose.yml`

If you do not add a Keycloak container, still wire the app so it can run against an external Keycloak instance.

## Required Session Flow

Implement this exact shape:

1. unauthenticated user requests protected page
2. middleware redirects to sign-in
3. user authenticates at Keycloak
4. auth callback resolves local user by email
5. if local user missing or inactive, deny app access
6. if allowed, session stores local app facts:
   - `userId`
   - `email`
   - `role`
   - `isActive`
7. pages and API routes enforce authorization from the session and local app rules

Preferred approach:
- deny unprovisioned users in the Auth.js sign-in callback before a usable app session is established

## Authorization Requirements

Keycloak proves identity only.

The app decides access using:
- local user exists
- local user active
- local role allowed
- local scope assignments if enforced in this iteration

If the repo already supports airport or mandir scope checks in a practical place, preserve that structure.
If not, do not invent broad new scope systems beyond what is needed for this auth integration.

## Telegram Constraint

Do not implement Telegram linking from the web login flow.

Keep:
- `apps/web/app/api/bot/link-telegram/route.ts`

The bot endpoint must continue to link by:
- email or phone match
- storing `telegram_chat_id`

## Implementation Guidance

Prefer minimal, coherent changes over broad refactors.

Good target architecture:
- Auth.js owns OIDC session handling
- `packages/data` owns local user lookup
- `apps/web/lib/auth/session.ts` owns page/route auth helpers
- middleware does coarse entry protection
- pages/routes do final authorization checks

## Validation Requirements

After implementation, verify all of the following:

1. typecheck passes
2. app builds
3. protected page redirects when signed out
4. authenticated local admin can access `/admin`
5. authenticated non-admin is denied from `/admin`
6. authenticated but unprovisioned Keycloak user is denied with the required message
7. protected API routes reject unauthenticated requests
8. bot link endpoint still works without web login
9. Docker setup still starts successfully

## Output Expectations

When work is complete, report:
- exact files added
- exact files updated
- session/auth flow implemented
- how unprovisioned users are denied
- what was tested
- any remaining gaps or assumptions

## Do Not Do

Do not:
- replace Prisma or the existing data layer
- create a separate backend auth service
- add self-registration
- store authorization state only in the browser
- rely on Telegram username for identity
- allow Keycloak-authenticated users into the app without local provisioning
