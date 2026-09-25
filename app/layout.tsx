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
import './deliverables-preview-v2.css';
import './slr-approved-layout.css';
import './mobile-responsive.css';
import type { Metadata, Viewport } from 'next';
import WorkspaceSidebarLinksV2 from './workspace-sidebar-links-v2';
import DismissibleUiBehavior from './dismissible-ui-behavior';
import SlrTemplateSearchEnhancer from './slr-template-search-enhancer';
import ReviewNotesWorkspaceController from './review-notes-workspace-controller';
import WorkstationUniformityBehavior from './workstation-uniformity-behavior';
import DeliverablesNavigationEnhancer from './deliverables-navigation-enhancer';
import DeliverablesReadOnlyGuard from './deliverables-readonly-guard';
import SlrDeliverablesEditorV2 from './slr-deliverables-editor-v2';
import ProjectWorkflowEnhancer from './project-workflow-enhancer';
import ScopeLogicActionToast from './scopelogic-action-toast';
import DeliverablesInlineControllerV2 from './deliverables-inline-controller-v2';
import ReviewReleaseControllerV2 from './review-release-controller-v2';

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
  return <html lang="en"><body><DismissibleUiBehavior /><WorkspaceSidebarLinksV2 /><SlrTemplateSearchEnhancer /><ReviewNotesWorkspaceController /><WorkstationUniformityBehavior /><DeliverablesNavigationEnhancer /><DeliverablesReadOnlyGuard /><SlrDeliverablesEditorV2 /><ProjectWorkflowEnhancer /><ScopeLogicActionToast /><DeliverablesInlineControllerV2 /><ReviewReleaseControllerV2 />{children}</body></html>;
}
