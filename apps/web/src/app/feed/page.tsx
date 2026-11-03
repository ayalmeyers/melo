import type { Metadata } from 'next';
import { Feed } from '@/components/interactive';

export const metadata: Metadata = { title: 'Feed' };

export default function FeedPage() {
  return <>
    <section className="band"><div className="wrap" style={{ paddingTop: 40, paddingBottom: 72 }}><span className="eyebrow">Feed</span><h1 style={{ fontSize: 'clamp(32px,5vw,48px)', marginTop: 8 }}>What people are arguing about</h1></div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 760 }}><Feed /></div></div>
  </>;
}
