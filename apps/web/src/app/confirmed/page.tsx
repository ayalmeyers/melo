import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Email confirmed' };
/** Where confirmation links from the iPhone app land. */
export default function Confirmed() {
  return <section className="band" style={{ minHeight: '70vh' }}><div className="wrap" style={{ maxWidth: 520, paddingTop: 72, paddingBottom: 80 }}>
    <h1 style={{ fontSize: 40 }}>You&apos;re confirmed.</h1>
    <p className="muted" style={{ marginTop: 12, fontSize: 17 }}>Go back to the Melo app and sign in with your email and password, or keep going here.</p>
    <p style={{ marginTop: 24 }}><a className="btn" href="/feed">Continue on the web</a></p>
  </div></section>;
}
