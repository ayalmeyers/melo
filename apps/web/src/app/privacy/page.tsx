import type { Metadata } from 'next';
import { Contact, LegalPage } from '../legal';
export const metadata: Metadata = { title: 'Privacy Policy' };
export default function Privacy() {
  return <LegalPage title="Privacy Policy" updated="November 3, 2026">
    <p>Melo is a place to log, rate and discuss music and podcasts. This policy explains what we collect and why. We never sell your data.</p>
    <h2>What we collect</h2>
    <p><b>Account:</b> your email address, used only to sign you in with one-time codes and to contact you about your account.</p>
    <p><b>Profile and activity:</b> the name, username, bio, city, country and Top 4 you choose, plus what you post, rate, log, follow, forecast and edit on wikis. Profiles, posts, ratings, follows, forecasts and wiki edits are public by design.</p>
    <p><b>Messages:</b> group chats and direct messages are visible only to their members inside Melo.</p>
    <p><b>Waitlist:</b> if you join the waitlist we store your email and any answers you give, only to invite you.</p>
    <p><b>Technical data:</b> our hosting providers keep standard request logs for security and reliability.</p>
    <h2>Who processes it</h2>
    <p>Melo runs on Supabase (database and sign-in) and Vercel (website hosting). They process data on our behalf under their own security and privacy terms.</p>
    <h2>Your choices</h2>
    <p>You can edit your profile at any time, delete any post, reply or moment, block people, and delete your whole account from Settings. Deleting your account removes your profile, posts, replies, diary, forecasts, follows and chat memberships.</p>
    <h2>Children</h2>
    <p>Melo is not for children under 13. If you believe a child has an account, contact us and we will remove it.</p>
    <h2>Contact</h2>
    <Contact />
    <p className="muted">This policy is a working draft and will be reviewed by counsel before Melo&apos;s public launch.</p>
  </LegalPage>;
}
