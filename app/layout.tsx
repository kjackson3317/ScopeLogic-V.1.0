import './globals.css';
import './commercial-facelift.css';
import './destructive-action-contrast.css';
import './workspace-density.css';
import './slr-template-search.css';
import './review-observation-enhancer.css';
import './review-manual-overrides.css';
import './workstation-uniformity-v2.css';
import './workstation-uniformity-v3.css';
import './workstation-uniformity-v4.css';
import './workstation-uniformity-v5.css';
import './slr-green-banners.css';
import './sidebar-folder-controls.css';
import './slr-inline-editor.css';
import './quote-modern-ui.css';
import './quote-modern-ui-fix.css';
import './review-release-controller.css';
import './deliverables-preview-v2.css';
import type { Metadata } from 'next';
import WorkspaceSidebarLinksV2 from './workspace-sidebar-links-v2';
import DismissibleUiBehavior from './dismissible-ui-behavior';
import SlrTemplateSearchEnhancer from './slr-template-search-enhancer';
import ReviewObservationEnhancer from './review-observation-enhancer';
import WorkstationUniformityBehavior from './workstation-uniformity-behavior';
import SlrDeliverablesWorkflow from './slr-deliverables-workflow';
import DeliverablesInlineControllerV2 from './deliverables-inline-controller-v2';
import ReviewReleaseControllerV2 from './review-release-controller-v2';
import { isEmployerDemo } from '../lib/demo/config';

export const metadata: Metadata = {
  title: 'ScopeLogic v1.0',
  description: 'Division 27/28 scope and procurement workspace',
  icons: { icon: '/brand/scopelogic-app-icon.png', apple: '/brand/scopelogic-app-icon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DismissibleUiBehavior />{!isEmployerDemo && <WorkspaceSidebarLinksV2 />}<SlrTemplateSearchEnhancer /><ReviewObservationEnhancer /><WorkstationUniformityBehavior /><SlrDeliverablesWorkflow /><DeliverablesInlineControllerV2 /><ReviewReleaseControllerV2 />{children}</body></html>;
}
