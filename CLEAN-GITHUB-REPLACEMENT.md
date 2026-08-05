# Clean Codespaces Replacement — ScopeLogic v1.0 RC3.1

Use the RC3.1 ZIP as one complete repository source tree. Do not layer individual RC3.1 files over older revisions.

## Browser-only Codespaces method

1. Upload the RC3.1 ZIP to the repository root in Codespaces.
2. Extract it under `/tmp/scopelogic-rc31`.
3. Confirm the extracted package contains `app`, `lib`, `public`, `supabase`, and `package.json`.
4. Preserve `.git` and remove every other repository item:

```bash
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
```

5. Copy the extracted release into the repository:

```bash
cp -a /tmp/scopelogic-rc31/. .
```

6. Verify, build, commit, and push:

```bash
node scripts/verify-clean-source.mjs
npm install
npm run build
git add -A
git commit -m "Install ScopeLogic v1.0 RC3.1"
git push origin main
```

Do not upload `.env` or `.env.local`. Production variables remain in Vercel.
