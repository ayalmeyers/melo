// Prints each step of the artist-photo lookup for a few names (diagnostics for the catalog build).
import { commonsInfoUrl, pickImageFile, pickPhoto, pickTitlePage, wikidataImageUrl, wikiTitlesUrl } from '../packages/core/src/images';
const UA = 'MeloCatalogBuilder/1.0 (https://github.com/ayalmeyers/melo)';
const get = async (u: string) => (await fetch(u, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })).json();
for (const name of ['Kendrick Lamar', 'SZA', 'Taylor Swift', 'Radiohead']) {
  const t = await get(wikiTitlesUrl(name));
  console.log('\n=== ' + name + '\nTITLES', JSON.stringify(t).slice(0, 1500));
  const pick = pickTitlePage(t, name); console.log('PICK', JSON.stringify(pick));
  if (!pick?.qid) continue;
  const c = await get(wikidataImageUrl(pick.qid)); console.log('CLAIMS', JSON.stringify(c).slice(0, 600));
  const file = pickImageFile(c) ?? pick.pageimage; console.log('FILE', file);
  if (!file) continue;
  const i = await get(commonsInfoUrl(file)); console.log('INFO', JSON.stringify(i).slice(0, 1200)); console.log('PHOTO', JSON.stringify(pickPhoto(i)));
}
