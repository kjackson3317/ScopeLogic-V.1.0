# Clean GitHub Replacement — ScopeLogic v1.0 RC2.3

This release must replace the repository contents as one complete source tree. Do not upload only the changed files. The previous Vercel error referenced legacy code that is not present in this package, which confirms that the GitHub repository contained a mixture of release versions.

## Recommended method: GitHub Desktop

1. Download and extract `ScopeLogic-v1.0-RC2.3-Clean-Production-Source.zip`.
2. Open GitHub Desktop and select the `ScopeLogic-Rev14` repository.
3. Select **Repository → Show in Explorer**.
4. In the repository folder, keep the hidden `.git` folder. Delete every other file and folder.
5. Copy every file and folder from the extracted RC2.3 package into the repository folder.
6. Return to GitHub Desktop. Confirm that the changes show deleted legacy files and added/replaced RC2.3 files.
7. Commit with the message `Clean install ScopeLogic v1.0 RC2.3`.
8. Select **Push origin**.
9. Open Vercel and monitor the new production deployment.

Do not copy a `.env` or `.env.local` file into GitHub. Vercel environment variables remain configured in Vercel and are not stored in the repository.

## Command-line alternative

From the existing local repository folder:

```bash
git rm -r .
# Copy the extracted RC2.3 files into this folder.
git add .
git commit -m "Clean install ScopeLogic v1.0 RC2.3"
git push origin main
```

The `.git` folder is retained automatically and the Git history remains intact.

## Expected Vercel verification

Before `next build`, Vercel will now run:

```text
ScopeLogic source verification passed
```

The source verifier rejects the legacy `new Blob([bytes])` implementation that caused the TypeScript failure.
