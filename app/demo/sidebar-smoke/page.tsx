import DemoDeliverablesNav from '../../demo-deliverables-nav';

export const dynamic = 'force-static';

export default function DemoSidebarSmokePage() {
  return (
    <main style={{padding:24}}>
      <h1>Demo Sidebar Smoke Test</h1>
      <aside className="sidebar" style={{position:'relative',width:260,minHeight:540}}>
        <DemoDeliverablesNav />
      </aside>
    </main>
  );
}
