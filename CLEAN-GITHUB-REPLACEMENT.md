# Clean Codespaces Replacement — ScopeLogic v1.0 RC4.1

Use this procedure when installing the complete RC4.1 ZIP through GitHub Codespaces.

1. Upload `ScopeLogic-v1.0-RC4.1-Matrix-Checklist-Refinement.zip` to the repository root.
2. Extract and verify the package in `/tmp/scopelogic-rc41`.
3. Preserve `.git` and remove every other repository file.
4. Copy the complete extracted package into the repository.
5. Run source verification, dependency installation, and the production build.
6. Commit and push only after the build succeeds.

```bash
rm -rf /tmp/scopelogic-rc41
mkdir -p /tmp/scopelogic-rc41
unzip -q "ScopeLogic-v1.0-RC4.1-Matrix-Checklist-Refinement.zip" -d /tmp/scopelogic-rc41
ls -la /tmp/scopelogic-rc41
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a /tmp/scopelogic-rc41/. .
node scripts/verify-clean-source.mjs
npm install
npm run build
git add -A
git commit -m "Install ScopeLogic v1.0 RC4.1"
git push origin main
```

Do not open the updated production application until migration `20260806000200_scopelogic_rc41_matrix_checklist_refinement.sql` is applied.
