import './globals.css';
import './commercial-facelift.css';
import './destructive-action-contrast.css';
import './workspace-density.css';
import './slr-template-search.css';
import './review-observation-enhancer.css';
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
import type { Metadata } from 'next';
import WorkspaceSidebarLinks from './workspace-sidebar-links';
import DismissibleUiBehavior from './dismissible-ui-behavior';
import SlrTemplateSearchEnhancer from './slr-template-search-enhancer';
import ReviewObservationEnhancer from './review-observation-enhancer';
import WorkstationUniformityBehavior from './workstation-uniformity-behavior';
import DemoDeliverablesSidebar from './demo-deliverables-sidebar';
import SlrDeliverablesWorkflow from './slr-deliverables-workflow';
import DeliverablesInlineController from './deliverables-inline-controller';
import ReviewReleaseController from './review-release-controller';
import { isEmployerDemo } from '../lib/demo/config';

export const metadata: Metadata = {
  title: 'ScopeLogic v1.0',
  description: 'Division 27/28 scope and procurement workspace',
  icons: {
    icon: '/brand/scopelogic-app-icon.png',
    apple: '/brand/scopelogic-app-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DismissibleUiBehavior />{!isEmployerDemo && <WorkspaceSidebarLinks />}<SlrTemplateSearchEnhancer /><ReviewObservationEnhancer /><WorkstationUniformityBehavior />{isEmployerDemo && <DemoDeliverablesSidebar />}<SlrDeliverablesWorkflow /><DeliverablesInlineController /><ReviewReleaseController />{children}</body></html>;
}
