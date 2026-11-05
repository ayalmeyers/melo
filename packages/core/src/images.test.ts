import { describe, expect, it } from 'vitest';
import { findArtistPhoto, pickPage, pickPhoto, pickTitlePage } from './images';

const search = { query: { pages: {
  '1': { title: 'Frank Ocean discography', index: 2, pageprops: { wikibase_item: 'Q2' } },
  '2': { title: 'Frank Ocean', index: 1, pageprops: { wikibase_item: 'Q1' } },
} } };
const claims = { claims: { P18: [{ mainsnak: { datavalue: { value: 'Frank Ocean 2012.jpg' } } }] } };
const info = { query: { pages: { '-1': { title: 'File:Frank Ocean 2012.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Frank_Ocean_2012.jpg/800px-Frank_Ocean_2012.jpg',
  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Frank_Ocean_2012.jpg', extmetadata: { Artist: { value: '<a href="//x">Jane Photographer</a>' }, LicenseShortName: { value: 'CC BY-SA 3.0' } } }] } } } };

describe('artist photos', () => {
  it('picks the page named exactly like the artist', () => {
    expect(pickPage(search, 'Frank Ocean')).toBe('Q1');
    expect(pickPage(search, 'Tems')).toBeNull();
    expect(pickPage({ query: { pages: { a: { title: 'Rosalía (singer)', index: 1, pageprops: { wikibase_item: 'Q9' } } } } }, 'Rosalia')).toBe('Q9');
  });
  it('builds a credit with photographer and license', () => {
    expect(pickPhoto(info)).toEqual({ url: info.query.pages['-1'].imageinfo[0].thumburl, credit: 'Photo by Jane Photographer (CC BY-SA 3.0) via Wikimedia Commons', source: 'https://commons.wikimedia.org/wiki/File:Frank_Ocean_2012.jpg' });
    expect(pickPhoto({ query: { pages: { x: { imageinfo: [{ url: 'https://evil.example/a.jpg' }] } } } })).toBeNull();
  });
  it('walks Wikipedia → Wikidata → Commons', async () => {
    const calls: string[] = [];
    const photo = await findArtistPhoto('Frank Ocean', async url => { calls.push(url); return url.includes('wikipedia.org') ? search : url.includes('wikidata') ? claims : info; });
    expect(photo?.credit).toContain('Jane Photographer');
    // Title lookup finds nothing described as a musician in this mock, so it falls back to search.
    expect(calls).toHaveLength(4);
    expect(calls[3]).toContain('File%3AFrank%20Ocean%202012.jpg');
    expect(await findArtistPhoto('Nobody', async () => ({ query: { pages: {} } }))).toBeNull();
  });
  it('finds the artist page by title and skips disambiguations and non-music pages', () => {
    const drake = { query: { normalized: [], redirects: [], pages: {
      '1': { title: 'Drake', pageprops: { disambiguation: '', wikibase_item: 'Q0' }, description: 'Topics referred to by the same term' },
      '2': { title: 'Drake (musician)', pageprops: { wikibase_item: 'Q33240' }, description: 'Canadian rapper (born 1986)', pageimage: 'Drake_July_2016.jpg' },
      '-1': { title: 'Drake (singer)', missing: '' } } } };
    expect(pickTitlePage(drake, 'Drake')).toEqual({ qid: 'Q33240', pageimage: 'Drake_July_2016.jpg' });
    const future = { query: { pages: { '1': { title: 'Future', description: 'Time after the present', pageprops: { wikibase_item: 'Q1' } }, '2': { title: 'Future (rapper)', description: 'American rapper (born 1983)', pageprops: { wikibase_item: 'Q2' } } } } };
    expect(pickTitlePage(future, 'Future')?.qid).toBe('Q2');
    const sza = { query: { normalized: [{ from: 'SZA (singer)', to: 'SZA (singer)' }], redirects: [{ from: 'SZA (singer)', to: 'SZA' }], pages: { '5': { title: 'SZA', description: 'American singer (born 1989)', pageprops: { wikibase_item: 'Q5' } } } } };
    expect(pickTitlePage(sza, 'SZA')?.qid).toBe('Q5');
    expect(pickTitlePage({ query: { pages: {} } }, 'Nobody')).toBeNull();
  });
  it('accepts the thumb.wikimedia.org host and drops tracking parameters', () => {
    const p = pickPhoto({ query: { pages: { x: { title: 'File:K.jpg', imageinfo: [{ thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/K.jpg/960px-K.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo' }] } } } });
    expect(p?.url).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/K.jpg/960px-K.jpg');
  });
  it('only accepts free images hosted on Commons', () => {
    expect(pickPhoto({ query: { pages: { x: { imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/en/a/ab/Nonfree.jpg' }] } } } })).toBeNull();
  });
});
