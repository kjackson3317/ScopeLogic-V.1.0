# ScopeLogic v1.0 RC5 — Deployment

## 1. Source deployment

Install the complete RC5 source through GitHub Codespaces using `CLEAN-GITHUB-REPLACEMENT.md`. The production build must complete before commit and push.

## 2. Vercel

Confirm these variables are present:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
OPENAI_API_KEY
SCOPELOGIC_AI_ENABLED=false
```

`OPENAI_MODEL=gpt-5-mini` is optional because the server route uses that model by default.

Deploy RC5 and wait for Vercel to report `Ready`. AI remains disabled while `SCOPELOGIC_AI_ENABLED=false`.

## 3. Supabase migrations

Relink the Codespace if required, then run:

```bash
npx supabase@latest migration list
npx supabase@latest db push --dry-run
```

The dry run should list only these pending migrations, in this order:

```text
20260806000300_scopelogic_v1_production_closeout.sql
20260806000400_scopelogic_rc5_mobile_ai.sql
```

Then apply and verify:

```bash
npx supabase@latest db push
npx supabase@latest migration list
npx supabase@latest db push
```

The final command must report that the remote database is up to date. RC5 blocks cloud writes until schema version `1.0-RC5` is available.

## 4. Core and mobile acceptance

Complete the non-AI sections of `RC5-ACCEPTANCE-CHECKLIST.md` while Production AI remains disabled.

## 5. AI preview acceptance

Set `SCOPELOGIC_AI_ENABLED=true` for the Vercel Preview environment only, redeploy a preview, and complete the AI acceptance section. Never expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_` variable.

## 6. Production AI enablement

After preview acceptance, change Production `SCOPELOGIC_AI_ENABLED` to `true`, redeploy, and repeat one controlled AI draft test. AI-generated text remains a draft until the administrator applies selected fields and selects Submit Entry.

## 7. Final release

After all acceptance tests pass:

```bash
git tag v1.0.0
git push origin v1.0.0
```
