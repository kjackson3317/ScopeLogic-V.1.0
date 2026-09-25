import './globals.css';
import './commercial-facelift.css';
import './workspace-density.css';
import './slr-template-search.css';
import './review-workflow.css';
import './workstation-uniformity.css';
import './sidebar-folder-controls.css';
import './scopelogic-action-toast.css';
import './quote-modern-ui.css';
import './review-release-controller.css';
import './deliverables-preview.css';
import './slr-approved-layout.css';
import './mobile-responsive.css';
import type { Metadata, Viewport } from 'next';
import WorkspaceSidebarLinks from './workspace-sidebar-links';
import DismissibleUiBehavior from './dismissible-ui-behavior';
import SlrTemplateSearchEnhancer from './slr-template-search-enhancer';
import ReviewNotesWorkspaceController from './review-notes-workspace-controller';
import WorkstationUniformityBehavior from './workstation-uniformity-behavior';
import DeliverablesNavigationEnhancer from './deliverables-navigation-enhancer';
import DeliverablesReadOnlyGuard from './deliverables-readonly-guard';
import SlrDeliverablesEditor from './slr-deliverables-editor';
import ProjectWorkflowEnhancer from './project-workflow-enhancer';
import ScopeLogicActionToast from './scopelogic-action-toast';
import DeliverablesInlineController from './deliverables-inline-controller';
import ReviewReleaseController from './review-release-controller';

export const metadata: Metadata = {
  title: 'ScopeLogic v1.0',
  description: 'Division 27/28 scope and procurement workspace',
  icons: { icon: '/brand/scopelogic-app-icon.png', apple: '/brand/scopelogic-app-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DismissibleUiBehavior /><WorkspaceSidebarLinks /><SlrTemplateSearchEnhancer /><ReviewNotesWorkspaceController /><WorkstationUniformityBehavior /><DeliverablesNavigationEnhancer /><DeliverablesReadOnlyGuard /><SlrDeliverablesEditor /><ProjectWorkflowEnhancer /><ScopeLogicActionToast /><DeliverablesInlineController /><ReviewReleaseController />{children}</body></html>;
}
