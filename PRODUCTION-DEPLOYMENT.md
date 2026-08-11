# ScopeLogic v1.0 RC5.1 — Deployment

## 1. Source deployment

Install the complete RC5.1 source through GitHub Codespaces using `CLEAN-GITHUB-REPLACEMENT.md`. The production build must complete before commit and push.

## 2. Vercel

Keep these variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

RC5.1 does not use `OPENAI_API_KEY`, `OPENAI_MODEL`, or `SCOPELOGIC_AI_ENABLED`. Remove those three variables after the RC5.1 deployment is verified Ready.

## 3. Supabase

RC5.1 has no new database migration. Because production already reports `Remote database is up to date`, do not run migration repair or reset. After source deployment, an optional verification command is:

```bash
npx supabase@latest migration list
```

All migrations through `20260806000400` should remain matched Local and Remote.

## 4. Production acceptance

After Vercel reports Ready:

1. Open the permanent custom domain and press Ctrl+F5.
2. Confirm existing projects and documents remain visible.
3. Confirm the single top cloud status shows Cloud synced.
4. Confirm no AI control or AI status card appears.
5. Confirm Sign Out appears under Account at the bottom of the sidebar/mobile drawer.
6. Open one project, one SLR, one cloud document, and one deliverable page.
7. Complete `RC5.1-ACCEPTANCE-CHECKLIST.md`.

Never run `supabase db reset --linked` against production.
