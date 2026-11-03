// Concatenates the migrations and seed into supabase/setup.sql, a single file to paste into the Supabase SQL editor.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const files = [...readdirSync('supabase/migrations').sort().map(f => `supabase/migrations/${f}`), 'supabase/seed.sql'];
let out = '-- Melo database setup: paste this whole file into Supabase → SQL Editor → New query, then Run.\n-- Generated from supabase/migrations + supabase/seed.sql. Run it once on a fresh project.\n';
for (const f of files) out += `\n-- ===== ${f} =====\n` + readFileSync(f, 'utf8');
writeFileSync('supabase/setup.sql', out);
console.log('wrote supabase/setup.sql');
