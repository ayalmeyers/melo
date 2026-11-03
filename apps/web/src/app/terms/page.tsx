import type { Metadata } from 'next';
import { Contact, LegalPage } from '../legal';
export const metadata: Metadata = { title: 'Terms of Use' };
export default function Terms() {
  return <LegalPage title="Terms of Use" updated="November 3, 2026">
    <p>By using Melo you agree to these terms.</p>
    <h2>The rules</h2>
    <p>Roast the music, never the person. There is zero tolerance for harassment, hate speech, threats, sexual content involving minors, spam, impersonation, or content that is illegal or infringes someone else&apos;s rights. Short quotes of lyrics are fine; full lyrics are not.</p>
    <p>We may remove content and suspend or delete accounts that break these rules. Reports are reviewed within 24 hours, and we remove objectionable content and the accounts that posted it.</p>
    <h2>Your content</h2>
    <p>You own what you post. You give Melo permission to host, display and share it within Melo and on its public pages. Wiki edits are contributed for everyone to read and improve.</p>
    <h2>Forecasts</h2>
    <p>Forecasts are for fun and reputation only. No money, prizes or anything of value is wagered or paid out.</p>
    <h2>Music and artwork</h2>
    <p>Melo links to Spotify, Apple Music and other services and does not host music. Artist and album names are used to identify works. Cover images shown are original generated art, not the official artwork.</p>
    <h2>Accounts</h2>
    <p>You must be at least 13. Keep access to your email secure. You can delete your account at any time from Settings.</p>
    <h2>Changes and contact</h2>
    <p>We may update these terms and will note the date above.</p>
    <Contact />
    <p className="muted">These terms are a working draft and will be reviewed by counsel before Melo&apos;s public launch.</p>
  </LegalPage>;
}
