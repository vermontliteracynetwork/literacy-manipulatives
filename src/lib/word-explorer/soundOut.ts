// Kid respelling ("HAP-ee") from a word's IPA (spec section 5, soundOut). The stressed syllable is in capital
// letters. Draft quality until the CMUdict phonics engine (Phase 2) replaces it.

const VOWELS: [string, string, string][] = [
  // [ipa, in an open syllable, in a closed syllable]
  ['aɪ', 'y', 'igh'], ['aʊ', 'ow', 'ow'], ['ɔɪ', 'oy', 'oy'], ['oʊ', 'oh', 'oh'], ['əʊ', 'oh', 'oh'], ['eɪ', 'ay', 'ay'],
  ['ɪə', 'eer', 'eer'], ['eə', 'air', 'air'], ['ʊə', 'oor', 'oor'],
  ['ɝ', 'ur', 'ur'], ['ɜ', 'ur', 'ur'], ['ɚ', 'er', 'er'],
  ['æ', 'a', 'a'], ['ɑ', 'ah', 'o'], ['ɒ', 'o', 'o'], ['ɔ', 'aw', 'aw'], ['ʌ', 'uh', 'u'], ['ə', 'uh', 'uh'],
  ['ɛ', 'eh', 'e'], ['e', 'ay', 'e'], ['ɪ', 'ih', 'i'], ['i', 'ee', 'ee'], ['ʊ', 'uu', 'uu'], ['u', 'oo', 'oo'],
  ['ɐ', 'uh', 'uh'], ['ᵻ', 'ih', 'i'], ['o', 'oh', 'oh'], ['a', 'ah', 'a'],
];
const CONSONANTS: [string, string][] = [
  ['tʃ', 'ch'], ['dʒ', 'j'], ['θ', 'th'], ['ð', 'th'], ['ʃ', 'sh'], ['ʒ', 'zh'], ['ŋ', 'ng'], ['ɹ', 'r'], ['r', 'r'],
  ['ɾ', 't'], ['ɡ', 'g'], ['g', 'g'], ['j', 'y'], ['p', 'p'], ['b', 'b'], ['t', 't'], ['d', 'd'], ['k', 'k'], ['f', 'f'],
  ['v', 'v'], ['s', 's'], ['z', 'z'], ['h', 'h'], ['m', 'm'], ['n', 'n'], ['l', 'l'], ['w', 'w'], ['x', 'k'],
];
const LAX = new Set(['æ', 'ɛ', 'ɪ', 'ʌ', 'ʊ', 'ɒ']);
const ONSETS = new Set(['pl', 'pr', 'bl', 'br', 'tr', 'dr', 'kl', 'kr', 'gl', 'gr', 'fl', 'fr', 'θr', 'ʃr', 'sp', 'st', 'sk', 'sm', 'sn', 'sl', 'sw', 'spl', 'spr', 'str', 'skr', 'tw', 'kw', 'dw']);

type Tok = { ipa: string; vowel: boolean; stress: 0 | 1 | 2 };

function tokenize(ipa: string): Tok[] {
  const s = ipa.replace(/[ː/\[\]()]/g, '').replace(/\./g, '').replace(/ɹ̩|ɚ/g, 'ɚ').normalize('NFC');
  const out: Tok[] = [];
  let stress: 0 | 1 | 2 = 0;
  let i = 0;
  outer: while (i < s.length) {
    const ch = s[i];
    if (ch === 'ˈ') { stress = 1; i++; continue; }
    if (ch === 'ˌ') { stress = 2; i++; continue; }
    for (const [v] of VOWELS) if (s.startsWith(v, i)) { out.push({ ipa: v, vowel: true, stress }); stress = 0; i += v.length; continue outer; }
    for (const [c] of CONSONANTS) if (s.startsWith(c, i)) { out.push({ ipa: c, vowel: false, stress: 0 }); i += c.length; continue outer; }
    i++; // marks we don't spell (ʔ, diacritics)
  }
  // A stress mark sits before a syllable's onset; move it onto the vowel.
  return out;
}

function stressOf(ipa: string): number[] {
  // Which vowel (by index) each stress mark points at.
  const s = ipa.replace(/[ː]/g, '');
  const marks: number[] = [];
  let vowelCount = 0;
  let pending = 0;
  let i = 0;
  outer: while (i < s.length) {
    if (s[i] === 'ˈ') { pending = 1; i++; continue; }
    if (s[i] === 'ˌ') { pending = Math.max(pending, 0); i++; continue; }
    for (const [v] of VOWELS) if (s.startsWith(v, i)) { if (pending === 1) marks.push(vowelCount); pending = 0; vowelCount++; i += v.length; continue outer; }
    i++;
  }
  return marks;
}

export function soundOutFromIpa(ipa: string | undefined): string {
  if (!ipa) return '';
  const toks = tokenize(ipa.split(/[,;]/)[0].trim());
  const primary = stressOf(ipa.split(/[,;]/)[0].trim());
  const vowelIdx = toks.map((t, i) => (t.vowel ? i : -1)).filter((i) => i >= 0);
  if (!vowelIdx.length) return '';
  // Split consonants between vowels into the coda of one syllable and the onset of the next.
  const sylls: Tok[][] = [];
  let start = 0;
  vowelIdx.forEach((vi, n) => {
    const next = vowelIdx[n + 1];
    if (next === undefined) { sylls.push(toks.slice(start)); return; }
    const cluster = toks.slice(vi + 1, next);
    let coda = 0;
    const stressedLax = LAX.has(toks[vi].ipa) && (primary.includes(n) || vowelIdx.length === 1);
    if (cluster.length === 1) coda = stressedLax ? 1 : 0;
    else if (cluster.length >= 2) {
      const tail = cluster.map((c) => c.ipa).join('');
      coda = ONSETS.has(tail) && !stressedLax ? 0 : 1;
      if (cluster.length >= 3 && !ONSETS.has(cluster.slice(1).map((c) => c.ipa).join(''))) coda = cluster.length - 1;
    }
    sylls.push(toks.slice(start, vi + 1 + coda));
    start = vi + 1 + coda;
  });
  const spelled = sylls.map((syl, n) => {
    const v = syl.findIndex((t) => t.vowel);
    const closed = syl.slice(v + 1).length > 0;
    let txt = '';
    syl.forEach((t, i) => {
      if (t.vowel) {
        const row = VOWELS.find(([x]) => x === t.ipa)!;
        let sp = closed ? row[2] : row[1];
        if (t.ipa === 'aɪ' && i === 0) sp = 'eye';
        // r after a vowel: "ar", "or", "air", "eer"
        const nxt = syl[i + 1]?.ipa;
        if ((nxt === 'ɹ' || nxt === 'r') && ['ɑ', 'ɔ', 'ɛ', 'ɪ', 'e', 'o'].includes(t.ipa)) sp = { ɑ: 'a', ɔ: 'o', ɛ: 'ai', ɪ: 'ee', e: 'ai', o: 'o' }[t.ipa as 'ɑ'];
        txt += sp;
      } else txt += CONSONANTS.find(([x]) => x === t.ipa)![1];
    });
    return primary.includes(n) || sylls.length === 1 ? txt.toUpperCase() : txt;
  });
  return spelled.join('-');
}
