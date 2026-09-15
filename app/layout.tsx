import './globals.css';
import './commercial-facelift.css';
import './destructive-action-contrast.css';
import './workspace-density.css';
import './takeoff-desktop.css';
import type { Metadata } from 'next';
import WorkspaceSidebarLinks from './workspace-sidebar-links';
import DismissibleUiBehavior from './dismissible-ui-behavior';

export const metadata: Metadata = {
  title: 'ScopeLogic v1.0',
  description: 'Division 27/28 scope and procurement workspace',
  icons: {
    icon: '/brand/scopelogic-app-icon.png',
    apple: '/brand/scopelogic-app-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><DismissibleUiBehavior /><WorkspaceSidebarLinks />{children}</body></html>;
}
