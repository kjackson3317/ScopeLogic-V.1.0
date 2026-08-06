# ScopeLogic v1.0 — Production Deployment

## 1. Source deployment

Install the complete v1.0 source through GitHub Codespaces using `CLEAN-GITHUB-REPLACEMENT.md`. The production build must complete before commit and push.

## 2. Vercel

Wait for the deployment associated with `Release ScopeLogic v1.0` to show `Ready`.

Confirm these Production variables remain present:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

`NEXT_PUBLIC_SITE_URL` must use the final custom HTTPS domain.

## 3. Supabase migration

Relink the Codespace if required, then run:

```bash
npx supabase@latest migration list
npx supabase@latest db push --dry-run
npx supabase@latest db push
npx supabase@latest migration list
```

Only this migration should be pending before the push:

```text
20260806000300_scopelogic_v1_production_closeout.sql
```

Do not use the v1.0 application before the migration is applied. The application refuses cloud writes unless System Status reports schema version `1.0`.

## 4. Production acceptance

Open the permanent custom domain, force refresh, sign in, and complete `V1.0-ACCEPTANCE-CHECKLIST.md`.

After acceptance:

```bash
git tag v1.0.0
git push origin v1.0.0
```
