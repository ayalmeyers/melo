'use client';
import { useEffect } from 'react';

/** Shown when a page fails to load: plain words and a retry. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return <section className="wrap sec" style={{ maxWidth: 560, textAlign: 'center' }}>
    <h1 style={{ fontSize: 32 }}>{offline ? 'You seem to be offline' : 'That page didn’t load'}</h1>
    <p className="muted" style={{ margin: '12px 0 24px', fontSize: 17 }}>{offline ? 'Check your connection, then try again.' : 'Something went wrong on our side. Try again in a moment.'}</p>
    <button className="btn" onClick={reset}>Try again</button>
  </section>;
}
