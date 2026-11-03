import type { Metadata } from 'next';
import { Contact, LegalPage } from '../legal';
export const metadata: Metadata = { title: 'Support' };
export default function Support() {
  return <LegalPage title="Support" updated="November 3, 2026">
    <h2>Signing in</h2><p>Melo signs you in with a 6-digit code sent to your email. If it doesn&apos;t arrive within a minute, check spam, then request a new one.</p>
    <h2>Reporting and blocking</h2><p>Use Report on any post or reply to flag it for review. Block someone from their profile to stop seeing their posts and stop them messaging you.</p>
    <h2>Deleting your account</h2><p>Go to Settings and choose Delete account. Everything you created is removed.</p>
    <h2>Contact</h2><Contact />
  </LegalPage>;
}
