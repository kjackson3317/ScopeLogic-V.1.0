# Clean Codespaces Replacement — ScopeLogic v1.0 RC4

Use the RC4 ZIP as one complete repository source tree. Do not layer individual RC4 files over prior releases.

## Browser-only Codespaces method

1. Upload the RC4 ZIP to the repository root in the existing Codespace.
2. Extract it under `/tmp/scopelogic-rc4`.
3. Confirm the extracted package contains `app`, `lib`, `public`, `supabase`, and `package.json`.
4. Preserve `.git` and remove every other repository item:

```bash
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
```

5. Copy the extracted release into the repository:

```bash
cp -a /tmp/scopelogic-rc4/. .
```

6. Verify, build, commit, and push:

```bash
node scripts/verify-clean-source.mjs
npm install
npm run build
git add -A
git commit -m "Install ScopeLogic v1.0 RC4"
git push origin main
```

Do not upload `.env` or `.env.local`. Production variables remain in Vercel.
