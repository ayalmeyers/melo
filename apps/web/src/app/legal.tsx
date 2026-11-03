export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '';
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <section className="wrap sec"><div className="prose"><span className="eyebrow">Last updated {updated}</span><h1 style={{ fontSize: 40 }}>{title}</h1>{children}</div></section>;
}
export function Contact() {
  return SUPPORT_EMAIL ? <p>Email <b>{SUPPORT_EMAIL}</b>. We reply within two business days.</p> : <p>Contact details are being set up. Use the Report button inside the app for anything urgent.</p>;
}
