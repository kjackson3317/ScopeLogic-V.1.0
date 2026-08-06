# Clean Codespaces Replacement — ScopeLogic v1.0

1. Upload the complete v1.0 ZIP to the repository root in GitHub Codespaces.
2. Extract it outside the repository.
3. Preserve only `.git` in the repository root.
4. Copy the extracted v1.0 source into the repository.
5. Run source verification, install, and production build.
6. Commit and push to `main`.
7. Wait for Vercel to show `Ready`.
8. Apply migration `20260806000300_scopelogic_v1_production_closeout.sql`.
9. Complete the final acceptance checklist.

Example commands:

```bash
ZIP=$(ls -1t ScopeLogic-v1.0-Production-Final*.zip | head -1)
rm -rf /tmp/scopelogic-v1
mkdir -p /tmp/scopelogic-v1
unzip -q "$ZIP" -d /tmp/scopelogic-v1
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-v1/. .
node scripts/verify-clean-source.mjs
npm install
npm run build
rm -rf supabase/.temp
git add -A
git commit -m "Release ScopeLogic v1.0"
git push origin main
```

Never run `supabase db reset --linked` against production.
