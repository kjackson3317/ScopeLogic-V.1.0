# Clean Codespaces Replacement — ScopeLogic v1.0 RC5.1

1. Upload the complete RC5.1 ZIP to the repository root in GitHub Codespaces.
2. Extract it outside the repository.
3. Preserve only `.git` in the repository root.
4. Copy the extracted RC5.1 source into the repository.
5. Run source verification, install, and production build.
6. Commit and push to `main`.
7. Wait for Vercel to show Ready.
8. Do not apply a new Supabase migration; RC5.1 is code-only.
9. Complete `RC5.1-ACCEPTANCE-CHECKLIST.md`.

Example commands:

```bash
ZIP=$(ls -1t ScopeLogic-v1.0-RC5.1-Production-Stability*.zip | head -1)
rm -rf /tmp/scopelogic-rc51
mkdir -p /tmp/scopelogic-rc51
unzip -q "$ZIP" -d /tmp/scopelogic-rc51
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-rc51/. .
node scripts/verify-clean-source.mjs
npm install
npm run build
rm -rf supabase/.temp
git add -A
git commit -m "Install ScopeLogic v1.0 RC5.1 production stability"
git push origin main
```

Never run `supabase db reset --linked` against production.
