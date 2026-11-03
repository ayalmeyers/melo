import Link from 'next/link';
export default function NotFound() {
  return <section className="wrap sec"><h1 style={{ fontSize: 40 }}>That page moved or never existed.</h1><p className="muted" style={{ margin: '10px 0 20px' }}>Try Explore, or search for what you were after.</p><Link className="btn" href="/explore">Go to Explore</Link></section>;
}
