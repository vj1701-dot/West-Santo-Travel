# migrations.md

## Files included
- `schema.prisma`
- `migration.sql`

## Suggested folder structure
```text
prisma/
  schema.prisma
  migrations/
    0001_init/
      migration.sql
```

## Apply workflow
1. Set `DATABASE_URL` in `.env`
2. Put `schema.prisma` in `prisma/schema.prisma`
3. Put `migration.sql` in `prisma/migrations/0001_init/migration.sql`
4. Run:
```bash
npx prisma generate
npx prisma migrate deploy
```

## Notes
- This schema is intentionally strict on relational integrity.
- Times are stored exactly as entered in local form. No timezone conversion layer is modeled.
- `telegram_chat_id` is the durable Telegram identity.
- Approval payloads are stored in JSON so you can snapshot coordinator proposals safely.
- Use service-layer logic to:
  - auto-create transport tasks
  - auto-build booking allocations
  - auto-log audits
  - queue notifications
