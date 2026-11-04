import { createApple } from '@melo/core';

/** Apple's catalog, called straight from the phone (each phone has its own rate limit). */
export const apple = createApple(async url => {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Apple ${r.status}`);
  return r.json();
});
