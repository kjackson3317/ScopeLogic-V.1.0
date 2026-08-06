# Clean Codespaces Replacement — ScopeLogic v1.0 RC5

1. Upload the complete RC5 ZIP to the repository root in GitHub Codespaces.
2. Extract it outside the repository.
3. Preserve only `.git` in the repository root.
4. Copy the extracted RC5 source into the repository.
5. Run source verification, install, and production build.
6. Commit and push to `main`.
7. Wait for Vercel to show `Ready`.
8. Apply pending migrations `20260806000300` and `20260806000400` in sequence.
9. Complete `RC5-ACCEPTANCE-CHECKLIST.md`.

Example commands:

```bash
ZIP=$(ls -1t ScopeLogic-v1.0-RC5-Mobile-AI-Drafting*.zip | head -1)
rm -rf /tmp/scopelogic-rc5
mkdir -p /tmp/scopelogic-rc5
unzip -q "$ZIP" -d /tmp/scopelogic-rc5
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-rc5/. .
node scripts/verify-clean-source.mjs
npm install
npm run build
rm -rf supabase/.temp
git add -A
git commit -m "Install ScopeLogic v1.0 RC5"
git push origin main
```

Keep Production `SCOPELOGIC_AI_ENABLED=false` until the AI Preview acceptance test passes.

Never run `supabase db reset --linked` against production.
