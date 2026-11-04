import { describe, expect, it } from 'vitest';
import { findArtistPhoto, pickPage, pickPhoto } from './images';

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
    expect(calls).toHaveLength(3);
    expect(calls[2]).toContain('File%3AFrank%20Ocean%202012.jpg');
    expect(await findArtistPhoto('Nobody', async () => ({ query: { pages: {} } }))).toBeNull();
  });
});
