# Clean GitHub Replacement — ScopeLogic v1.0 RC3

Use the RC3 ZIP as one complete repository source tree. Do not layer individual RC3 files over mixed older revisions.

## GitHub Desktop method

1. Extract `ScopeLogic-v1.0-RC3-Cloud-Storage-Database-Cutover.zip`.
2. Open GitHub Desktop and select `ScopeLogic-Rev14`.
3. Select **Repository → Show in Explorer**.
4. Keep the hidden `.git` folder. Delete every other file and folder.
5. Copy all extracted RC3 files and folders into the repository folder.
6. Commit with `Clean install ScopeLogic v1.0 RC3`.
7. Push origin.
8. Monitor the Vercel production deployment.

Do not copy `.env` or `.env.local` into GitHub. Vercel environment variables remain in Vercel.

The Vercel build should report:

```text
ScopeLogic source verification passed
```
