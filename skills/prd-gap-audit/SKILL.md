# PRD Gap Audit Skill

Use this skill when comparing `Santos_FMS_PRD.md` to the current codebase.

## Steps

1. Read:
   - `Santos_FMS_PRD.md`
   - `.agents/FEATURE_STATUS.md`
   - `.agents/API_CONTRACTS.md`
   - `.agents/SHARED_SCHEMA.md`
2. Inspect the current modules in:
   - `apps/web`
   - `packages/data`
   - `prisma/schema.prisma`
3. Categorize requirements as:
   - implemented
   - partial
   - missing
4. Convert the highest-value missing requirement into an execution slice
5. Prefer slices that already have schema support

## Output Shape

- short findings list
- direct execution target
- blockers if any
