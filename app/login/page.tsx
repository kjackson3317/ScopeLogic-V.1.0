import DemoGuestLogin from '../demo-guest-login';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const requested = params.next || '/';
  const nextPath = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-heading"><span>Guest Test Access</span><h1>Technology Preconstruction Workspace</h1><p>Use the shared guest account below to review the browser-local test workspace. No production data is connected.</p></div>
    <DemoGuestLogin nextPath={nextPath} />
  </section></main>;
}
