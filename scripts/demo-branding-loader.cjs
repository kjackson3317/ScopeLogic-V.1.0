// Build-time branding adapter. Runs only for the employer-demo variant.
// Production source and builds retain their existing identity.
module.exports = function(source) {
  if (this.resourcePath.replaceAll('\\', '/').endsWith('/app/workspace.tsx')) {
    source = source.replaceAll('\r\n', '\n');
    for (const edit of require('./demo-workspace-transform.json')) {
      if (source.split(edit.before).length !== 2) throw new Error('Demo workspace adapter needs review against the current source.');
      source = source.replace(edit.before, edit.after);
    }
  }
  return source
    .replaceAll('/brand/scopelogic-logo-full.png', '/demo/wordmark.png')
    .replaceAll('/brand/scopelogic-logo-mark.png', '/demo/icon.png')
    .replaceAll('/brand/scopelogic-wordmark.png', '/demo/wordmark.png')
    .replaceAll('/brand/scopelogic-app-icon.png', '/demo/icon.png')
    .replaceAll('ScopeLogic Matrix™', 'Scope Matrix')
    .replaceAll('ScopeLogic Matrix', 'Scope Matrix')
    .replaceAll('ScopeLogic Clarification', 'Internal Clarification')
    .replaceAll('ScopeLogic Bid Alignment Report', 'Bid Alignment Report')
    .replaceAll('ScopeLogic Internal Matrix', 'Internal Review Matrix')
    .replaceAll('ScopeLogic LLC', 'Technology Preconstruction Workspace')
    .replaceAll('ScopeLogic v1.0', 'Technology Preconstruction Workspace')
    .replaceAll('scopelogic.net', 'example.invalid')
    .replace(/\bScopeLogic\b/g, 'Technology Workspace')
    .replaceAll('SLC', 'Internal')
    .replace(/\bscopelogic\b/g, 'technology-precon');
};
