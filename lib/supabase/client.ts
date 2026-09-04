import { createBrowserClient } from '@supabase/ssr';

type WorkspaceIdentity = {
  actualUserId: string;
  workspaceOwnerId: string;
  role: string;
};

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in Vercel.');

  const client = createBrowserClient(url, key);
  const originalGetUser = client.auth.getUser.bind(client.auth);
  let identityPromise: Promise<WorkspaceIdentity | null> | null = null;

  Object.defineProperty(client.auth, 'getUser', {
    configurable: true,
    value: async (...args: any[]) => {
      const result = await originalGetUser(...args);
      const actualUser = result.data?.user;
      if (result.error || !actualUser) return result;

      if (!identityPromise) {
        identityPromise = client
          .from('profiles')
          .select('workspace_owner_id, role')
          .eq('id', actualUser.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (error || !data) return null;
            return {
              actualUserId: actualUser.id,
              workspaceOwnerId: String(data.workspace_owner_id || actualUser.id),
              role: String(data.role || 'user'),
            };
          });
      }

      const identity = await identityPromise;
      if (!identity || identity.workspaceOwnerId === actualUser.id) return result;

      return {
        ...result,
        data: {
          ...result.data,
          user: {
            ...actualUser,
            id: identity.workspaceOwnerId,
            app_metadata: {
              ...(actualUser.app_metadata || {}),
              scopelogic_actual_user_id: identity.actualUserId,
              scopelogic_workspace_owner_id: identity.workspaceOwnerId,
              scopelogic_role: identity.role,
            },
          },
        },
      };
    },
  });

  return client;
}
