/** Apple genre names (including the localized ones on the Japanese and Korean stores) to Melo genres. First match wins. */
export const MELO_GENRE: [RegExp, string][] = [
  [/classical|opera|klassik|classique|clásica|クラシック|클래식/i, 'classical'], [/k-pop|케이팝/i, 'kpop'], [/j-pop|anime|j-rock|vocaloid|アニメ/i, 'jpop'], [/bollywood|indian|tamil|telugu|punjabi|hindi|bhangra|desi/i, 'indian'],
  [/サウンドトラック|사운드트랙|soundtrack/i, 'soundtrack'], [/힙합|ヒップホップ/i, 'hiphop'], [/オルタナティブ|얼터너티브|alternativo|alternative/i, 'indie'], [/ロック|록|rock/i, 'rock'], [/ポップ|^팝$|팝 /i, 'pop'], [/country|americana|bluegrass/i, 'country'], [/soundtrack|musicals?|original score|cast recording/i, 'soundtrack'],
  [/hip-hop|rap/i, 'hiphop'], [/r&b|soul/i, 'rnb'], [/afro/i, 'afro'], [/latin|reggaeton|urbano|salsa|bachata|regional mexicano|música mexicana|corrido/i, 'latin'],
  [/city pop/i, 'citypop'], [/brazil|mpb|bossa|samba|sertanejo|funk brasileiro|pagode/i, 'brazil'], [/alternative|indie/i, 'indie'],
  [/rock|metal|punk/i, 'rock'], [/electronic|dance|house|techno/i, 'electronic'], [/jazz/i, 'jazz'], [/pop|k-pop/i, 'pop'], [/world|african/i, 'afro'],
];
export const toMeloGenre = (names: string[]): string | null => { for (const n of names) for (const [re, g] of MELO_GENRE) if (re.test(n)) return g; return null; };
