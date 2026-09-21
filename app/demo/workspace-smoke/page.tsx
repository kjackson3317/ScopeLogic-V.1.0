import Workspace from '../../workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DemoWorkspaceSmokePage() {
  return <Workspace userEmail="Demo Presenter" userId="demo-presenter" />;
}
