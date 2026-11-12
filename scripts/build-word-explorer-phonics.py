#!/usr/bin/env python3
"""Word Explorer phonics engine (build spec section 7.3): lines up every word's letters with its sounds.

Usage:
  curl -L -o cmudict.dict https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict
  python3 -I scripts/build-word-explorer-phonics.py cmudict.dict

Pronunciations: the CMU Pronouncing Dictionary (BSD-style license, commercial use allowed; copy in
public/word-explorer/CMUDICT-LICENSE.txt). Patterns: src/lib/word-explorer/phonicsPatterns.json.

For each word in public/word-explorer/index.json it finds the cheapest way to split the spelling into graphemes,
each matched to its sounds by a spelling rule (a pattern from section 7.1 costs least), then splits syllables and
names each syllable's type. Words that needed a spelling outside the list are flagged ("u": 1) for her review.

Writes public/word-explorer/phonics/<xx>.json  { word: { "g": [[letters, sound, patternId]...], "s": [[text, type]...], "u"?: 1 } }
       public/word-explorer/patterns.json      { patternId: [common words with that pattern...] }
"""
import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'word-explorer')
PATTERNS = json.load(open(os.path.join(ROOT, 'src', 'lib', 'word-explorer', 'phonicsPatterns.json')))
PAT = {p['id']: p for p in PATTERNS['patterns']}
EXTRA = {p['id'] for p in PATTERNS['patterns'] if p.get('extra')}
FLAG = {'other'}

VOWEL_SOUND = {'AE': 'ă', 'EH': 'ĕ', 'IH': 'ĭ', 'AA': 'ŏ', 'AO': 'aw', 'EY': 'ā', 'IY': 'ē', 'AY': 'ī', 'OW': 'ō',
               'UW': 'ū', 'UH': 'oo', 'OY': 'oi', 'AW': 'ow', 'ER': 'er'}
CONS_SOUND = {'B': 'b', 'CH': 'ch', 'D': 'd', 'DH': 'th-v', 'F': 'f', 'G': 'g', 'HH': 'h', 'JH': 'j', 'K': 'k', 'L': 'l',
              'M': 'm', 'N': 'n', 'NG': 'ng', 'P': 'p', 'R': 'r', 'S': 's', 'SH': 'sh', 'T': 't', 'TH': 'th-u', 'V': 'v',
              'W': 'w', 'Y': 'y', 'Z': 'z', 'ZH': 'zh'}
VOWELS = set(VOWEL_SOUND) | {'AH'}
base = lambda ph: re.sub(r'\d', '', ph)


def sound_of(phones):
    """A sound key for a run of CMU phones ("EY" -> ā, "K S" -> ks, "AH0" -> ə)."""
    if not phones:
        return ''
    b = [base(p) for p in phones]
    joined = ' '.join(b)
    special = {'K W': 'kw', 'K S': 'ks', 'G Z': 'gz', 'NG K': 'nk', 'Y UW': 'yū', 'AA R': 'ar', 'AO R': 'or', 'EH R': 'air',
               'IH R': 'ear', 'IY R': 'ear', 'AO L': 'awl', 'OW L': 'ol', 'AH L': 'ul', 'AH0 L': 'l'}
    if joined in special:
        return special[joined]
    if ' '.join(phones) in special:
        return special[' '.join(phones)]
    out = []
    for p, bp in zip(phones, b):
        if bp == 'AH':
            out.append('ə' if p.endswith('0') else 'ŭ')
        else:
            out.append(VOWEL_SOUND.get(bp) or CONS_SOUND.get(bp, bp.lower()))
    return ''.join(out) if len(out) > 1 and all(len(x) == 1 for x in out) else ' '.join(out) if len(out) > 1 else out[0]


# Rules: (letters, phones, pattern id, cost, context). Phones match with or without stress unless a digit is given.
R = []
def rule(letters, phones, pid, cost=1.0, ctx=None):
    R.append((letters, tuple(phones.split()) if phones else (), pid, cost, ctx))

end = lambda w, i, n: i + n == len(w)
end_or_s = lambda w, i, n: i + n == len(w) or w[i + n:] in ('s', 'd')
before_eiy = lambda w, i, n: i + n < len(w) and w[i + n] in 'eiy'
after_w = lambda w, i, n: i > 0 and w[i - 1] == 'w'
after_cons = lambda w, i, n: i > 0 and w[i - 1] not in 'aeiouy'

for c, ph in [('b', 'B'), ('c', 'K'), ('d', 'D'), ('f', 'F'), ('g', 'G'), ('h', 'HH'), ('j', 'JH'), ('k', 'K'), ('l', 'L'),
              ('m', 'M'), ('n', 'N'), ('p', 'P'), ('r', 'R'), ('s', 'S'), ('t', 'T'), ('v', 'V'), ('w', 'W'), ('x', 'K S'),
              ('y', 'Y'), ('z', 'Z')]:
    rule(c, ph, c)
for c, ph in [('bb', 'B'), ('dd', 'D'), ('gg', 'G'), ('mm', 'M'), ('nn', 'N'), ('pp', 'P'), ('rr', 'R'), ('tt', 'T'), ('cc', 'K')]:
    rule(c, ph, c[0])
rule('qu', 'K W', 'qu'); rule('c', 'S', 'c-soft', 1, before_eiy); rule('g', 'JH', 'g-soft', 1, before_eiy)
rule('s', 'Z', 's-z'); rule('x', 'G Z', 'other', 2)
rule('a', 'AE', 'a-short'); rule('e', 'EH', 'e-short'); rule('i', 'IH', 'i-short'); rule('o', 'AA', 'o-short'); rule('o', 'AO', 'o-short')
rule('u', 'AH1', 'u-short'); rule('u', 'AH2', 'u-short')
for v in 'aeiou':
    rule(v, 'AH0', 'schwa', 1.5)
rule('e', 'IH0', 'schwa', 1.5); rule('a', 'IH0', 'schwa', 1.5)
rule('sh', 'SH', 'sh'); rule('th', 'DH', 'th-voiced'); rule('th', 'TH', 'th-unvoiced'); rule('ch', 'CH', 'ch'); rule('ck', 'K', 'ck')
rule('wh', 'W', 'wh'); rule('ph', 'F', 'ph'); rule('ng', 'NG', 'ng'); rule('nk', 'NG K', 'nk'); rule('n', 'NG', 'other', 2)
rule('ff', 'F', 'ff'); rule('ll', 'L', 'll'); rule('ss', 'S', 'ss'); rule('zz', 'Z', 'zz')
rule('all', 'AO L', 'all'); rule('oll', 'OW L', 'oll'); rule('ull', 'AH L', 'ull'); rule('ull', 'UH L', 'ull')
for v, ph in [('a', 'EY'), ('e', 'IY'), ('i', 'AY'), ('o', 'OW'), ('u', 'UW')]:
    rule(v, ph, f'{v}-long')
rule('u', 'Y UW', 'u-long-yu'); rule('u', 'Y AH0', 'u-long-yu', 1.5)
rule('ce', 'S', '_ce', 1, end_or_s); rule('ge', 'JH', '_ge', 1, end_or_s)
rule('tch', 'CH', 'tch'); rule('dge', 'JH', 'dge')
rule('y', 'AY', 'y-long-i', 1, end); rule('y', 'IY', 'y-long-e', 1, end); rule('y', 'IH', 'other', 2); rule('y', 'AY', 'other', 2)
rule('le', 'AH0 L', 'cle', 1, lambda w, i, n: end(w, i, n) and after_cons(w, i, n)); rule('le', 'L', 'cle', 1, lambda w, i, n: end(w, i, n) and after_cons(w, i, n))
rule('ild', 'AY L D', 'ild'); rule('old', 'OW L D', 'old'); rule('ind', 'AY N D', 'ind'); rule('olt', 'OW L T', 'olt'); rule('ost', 'OW S T', 'ost')
rule('ar', 'AA R', 'ar'); rule('or', 'AO R', 'or'); rule('ore', 'AO R', 'ore', 1, end_or_s)
rule('er', 'ER', 'er'); rule('ir', 'ER', 'ir'); rule('ur', 'ER', 'ur'); rule('or', 'ER1', 'w-or', 1, after_w)
rule('ar', 'ER0', 'ar-er'); rule('or', 'ER0', 'or-er'); rule('ar', 'AH0 R', 'ar-er', 1.2); rule('or', 'AH0 R', 'or-er', 1.2); rule('er', 'AH0 R', 'er', 1.2)
rule('air', 'EH R', 'air'); rule('are', 'EH R', 'are', 1, end_or_s); rule('ear', 'EH R', 'ear-air'); rule('ear', 'IH R', 'ear'); rule('ear', 'IY R', 'ear')
rule('ear', 'ER', 'other', 1.5)
for l, ph, pid in [('ai', 'EY', 'ai'), ('ay', 'EY', 'ay'), ('ee', 'IY', 'ee'), ('ea', 'IY', 'ea'), ('ey', 'IY', 'ey'), ('oa', 'OW', 'oa'),
                   ('ow', 'OW', 'ow-long-o'), ('oe', 'OW', 'oe'), ('ie', 'AY', 'ie'), ('igh', 'AY', 'igh'), ('oo', 'UH', 'oo-book'),
                   ('u', 'UH', 'u-book'), ('oo', 'UW', 'oo-moon'), ('ew', 'UW', 'ew'), ('ui', 'UW', 'ui'), ('ue', 'UW', 'ue'),
                   ('au', 'AO', 'au'), ('aw', 'AO', 'aw'), ('augh', 'AO', 'augh'), ('ea', 'EH', 'ea-short-e'), ('a', 'AA', 'a-short-o'),
                   ('a', 'AO', 'a-short-o'), ('oi', 'OY', 'oi'), ('oy', 'OY', 'oy'), ('ou', 'AW', 'ou'), ('ow', 'AW', 'ow-ow'),
                   ('ei', 'EY', 'ei-a'), ('ey', 'EY', 'ey-a'), ('eigh', 'EY', 'eigh'), ('aigh', 'EY', 'aigh'), ('ea', 'EY', 'ea-a'),
                   ('ew', 'Y UW', 'ew-yu'), ('eu', 'Y UW', 'eu-yu'), ('ue', 'Y UW', 'ue-yu'), ('ou', 'UW', 'ou-u'),
                   ('ough', 'AO', 'ough-aw'), ('ough', 'OW', 'ough-o'),
                   ('kn', 'N', 'kn'), ('wr', 'R', 'wr'), ('mb', 'M', 'mb'), ('gn', 'N', 'gn'), ('gh', 'G', 'gh'), ('ch', 'SH', 'ch-sh'),
                   ('ch', 'K', 'ch-k')]:
    rule(l, ph, pid)
rule('ie', 'IY', 'other', 1.5); rule('ei', 'IY', 'other', 1.5); rule('ou', 'AH', 'other', 1.5); rule('o', 'AH1', 'other', 1.5)
rule('t', '', 'silent-t', 1.5, lambda w, i, n: i > 0 and w[i - 1] in 'sf' and i + 1 < len(w) and w[i + 1] in 'el')
rule('e', '', 'silent-e', 0.5, end); rule('e', '', 'silent-e', 2)
rule('ed', 'D', 'ed', 1, end); rule('ed', 'T', 'ed', 1, end); rule('ed', 'IH0 D', 'ed', 1, end); rule('ed', 'AH0 D', 'ed', 1, end)
rule('es', 'IH0 Z', 'es', 1, end); rule('es', 'AH0 Z', 'es', 1, end); rule('es', 'Z', 'es', 1.2, end)
rule('tion', 'SH AH0 N', 'tion'); rule('sion', 'ZH AH0 N', 'other', 1.5); rule('sion', 'SH AH0 N', 'other', 1.5)

BY_START = defaultdict(list)
for r in R:
    BY_START[r[0][0]].append(r)

LETTER_SOUND = {'a': 'AE', 'e': 'EH', 'i': 'IH', 'o': 'AA', 'u': 'AH'}


def phones_match(want, got):
    if len(want) != len(got):
        return False
    for w, g in zip(want, got):
        if re.search(r'\d', w):
            if w != g:
                return False
        elif w != base(g):
            return False
    return True


def align(word, phones):
    n, m = len(word), len(phones)
    INF = float('inf')
    best = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0
    for i in range(n):
        for j in range(m + 1):
            c0 = best[i][j]
            if c0 == INF:
                continue
            for letters, ph, pid, cost, ctx in BY_START[word[i]]:
                L = len(letters)
                if word[i:i + L] != letters or j + len(ph) > m:
                    continue
                if ph and not phones_match(ph, phones[j:j + len(ph)]):
                    continue
                if ctx and not ctx(word, i, L):
                    continue
                if c0 + cost < best[i + L][j + len(ph)]:
                    best[i + L][j + len(ph)] = c0 + cost
                    back[i + L][j + len(ph)] = (i, j, letters, ph and phones[j:j + len(ph)], pid)
            # Fallbacks: one letter to one or two sounds, or a silent letter. Flagged for review.
            for k in (1, 2, 0):
                if j + k <= m:
                    cost = 4 if k else 5
                    if c0 + cost < best[i + 1][j + k]:
                        best[i + 1][j + k] = c0 + cost
                        back[i + 1][j + k] = (i, j, word[i], phones[j:j + k], 'other')
    if best[n][m] == INF:
        return None
    out = []
    i, j = n, m
    while (i, j) != (0, 0):
        pi, pj, letters, ph, pid = back[i][j]
        out.append([letters, list(ph or []), pid])
        i, j = pi, pj
    return out[::-1]


SHORT = {'AE', 'EH', 'IH', 'AA', 'AH', 'UH', 'AO'}
LONG_SINGLE = {'a-long': 'a_e', 'e-long': 'e_e', 'i-long': 'i_e', 'o-long': 'o_e', 'u-long': 'u_e', 'u-long-yu': 'u_e-yu'}
R_CONTROLLED = {'ar', 'or', 'ore', 'er', 'ir', 'ur', 'w-or', 'ar-er', 'or-er', 'air', 'are', 'ear-air', 'ear'}
DIPHTHONG = {'oi', 'oy', 'ou', 'ow-ow'}
VCE = set(LONG_SINGLE.values())
# Units that keep a syllable closed (kind, cold, ball) rather than making a vowel team.
CLOSED_UNITS = {'ed', 'es', 'tion', 'other', 'ild', 'old', 'ind', 'olt', 'ost', 'all', 'oll', 'ull'}


def is_vowel_g(g):
    return any(base(p) in VOWELS for p in g[1]) or g[2] == 'cle'


def post(word, gs):
    # Silent e: a long single vowel, one consonant, then a final e (cake, home) becomes a_e, o_e...
    if len(gs) >= 3 and gs[-1][0] == 'e' and gs[-1][2] == 'silent-e':
        v, c = gs[-3], gs[-2]
        if v[2] in LONG_SINGLE and not is_vowel_g(c) and len(c[0]) <= 2:
            v[0] = v[0] + '_e'; v[2] = LONG_SINGLE[v[2]]
            gs.pop()
            gs[-1].append('dropped-e')  # the final e now lives in the a_e grapheme; syllable text puts it back
    # The same with a final ce or ge (nice, page): i_e plus _ce.
    if len(gs) >= 2 and gs[-1][2] in ('_ce', '_ge') and gs[-2][2] in LONG_SINGLE:
        gs[-2][0] += '_e'; gs[-2][2] = LONG_SINGLE[gs[-2][2]]
    return gs


def syllables(word, gs, phones):
    """Split the graphemes into syllables and name each syllable's type."""
    nuclei = [k for k, g in enumerate(gs) if is_vowel_g(g)]
    if not nuclei:
        return [[word, 'closed']]
    stress = {}
    for k in nuclei:
        st = [p[-1] for p in gs[k][1] if p[-1].isdigit()]
        stress[k] = st[0] if st else '0'
    cuts = []  # grapheme index where each later syllable starts, plus letters moved by a doubled consonant split
    for a, b in zip(nuclei, nuclei[1:]):
        between = list(range(a + 1, b))
        nxt_cle = gs[b][2] == 'cle'
        if nxt_cle:
            cuts.append((between[-1] if between else b, 0)); continue
        if not between:
            cuts.append((b, 0)); continue
        if len(between) == 1:
            g = gs[between[0]]
            short_stressed = any(base(p) in SHORT for p in gs[a][1]) and stress[a] in '12' and not gs[a][2].endswith('-long')
            if len(g[0]) == 2 and g[0][0] == g[0][1]:
                cuts.append((between[0], 1))  # hap|py: split the doubled letters
            elif short_stressed:
                cuts.append((b, 0))
            else:
                cuts.append((between[0], 0))
            continue
        cuts.append((between[1], 0))
    span = lambda g: g[0].split('_')[0]  # the letters a grapheme covers where it sits (a_e covers the a)
    sylls, start, carry = [], 0, ''
    for cut, split in cuts:
        txt = carry + ''.join(span(g) for g in gs[start:cut]) + (gs[cut][0][:split] if split else '')
        sylls.append((txt, gs[start:cut + (1 if split else 0)]))
        carry = gs[cut][0][split:] if split else ''
        start = cut + (1 if split else 0)
    sylls.append((carry + ''.join(span(g) for g in gs[start:]) + ('e' if gs and 'dropped-e' in gs[-1][3:] else ''), gs[start:]))
    out = []
    for txt, part in sylls:
        ids = {g[2] for g in part}
        if 'cle' in ids:
            t = 'consonant-le'
        elif ids & R_CONTROLLED:
            t = 'r-controlled'
        elif ids & DIPHTHONG:
            t = 'diphthong'
        elif ids & VCE:
            t = 'silent e'
        elif any(is_vowel_g(g) and len(g[0].replace('_', '')) > 1 and g[2] not in CLOSED_UNITS for g in part):
            t = 'vowel team'
        elif ids & (CLOSED_UNITS - {'other'}):
            t = 'closed'
        else:
            last_v = max((k for k, g in enumerate(part) if is_vowel_g(g)), default=-1)
            t = 'open' if last_v == len(part) - 1 else 'closed'
        out.append([txt, t])
    # Make sure the syllables spell the word.
    if ''.join(s[0] for s in out) != word:
        return [[word, 'closed']]
    return out


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src:
        sys.exit(__doc__)
    pron = {}
    for line in open(src, encoding='utf8'):
        parts = line.split('#')[0].split()
        if not parts:
            continue
        w = parts[0]
        if '(' in w:
            continue  # first pronunciation only
        pron[w] = parts[1:]
    index = json.load(open(os.path.join(OUT, 'index.json')))
    words = [w for w, *_ in index['words']]
    band = {w: b for w, _, b, _ in index['words']}
    shards = defaultdict(dict)
    by_pattern = defaultdict(list)
    flagged = done = 0
    for w in words:
        ph = pron.get(w)
        if not ph or not re.fullmatch(r'[a-z]+', w):
            continue
        gs = align(w, ph)
        if not gs:
            continue
        gs = post(w, gs)
        sy = syllables(w, gs, ph)
        unsure = any(g[2] in FLAG for g in gs)
        rec = {'g': [[g[0], sound_of(g[1]) if g[2] in ('other', 'schwa', 'ed', 'es', 'tion', 's-z') or g[2] not in PAT else PAT[g[2]]['sound'], g[2]] for g in gs], 's': sy}
        if unsure:
            rec['u'] = 1; flagged += 1
        key = re.sub(r'[^a-z]', '_', (w + '_')[:2])
        shards[key][w] = rec
        done += 1
        if not unsure:
            for pid in {g[2] for g in gs}:
                by_pattern[pid].append(w)
            # Nasalized a (am, an) is a pattern tag on the word, not a separate tile.
            for k, g in enumerate(gs[:-1]):
                if g[2] == 'a-short' and gs[k + 1][0] in ('m', 'n'):
                    by_pattern['am' if gs[k + 1][0] == 'm' else 'an'].append(w)
    os.makedirs(os.path.join(OUT, 'phonics'), exist_ok=True)
    for name in os.listdir(os.path.join(OUT, 'phonics')):
        os.remove(os.path.join(OUT, 'phonics', name))
    size = 0
    for key, recs in shards.items():
        data = json.dumps(recs, separators=(',', ':'), ensure_ascii=False, sort_keys=True)
        size += len(data.encode())
        open(os.path.join(OUT, 'phonics', key + '.json'), 'w').write(data)
    pat_out = {pid: sorted(set(ws), key=lambda x: (band.get(x, 5), len(x), x))[:80] for pid, ws in by_pattern.items()}
    json.dump(pat_out, open(os.path.join(OUT, 'patterns.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    lic = open(os.path.join(os.path.dirname(src), 'CMU-LICENSE')).read() if os.path.exists(os.path.join(os.path.dirname(src), 'CMU-LICENSE')) else ''
    open(os.path.join(OUT, 'CMUDICT-LICENSE.txt'), 'w').write('Word Explorer letter-sound data is built from the CMU Pronouncing Dictionary,\nhttps://github.com/cmusphinx/cmudict\n\n' + lic)
    print(done, 'words,', flagged, 'flagged for review,', size // 1024, 'KB,', len(pat_out), 'patterns')
    for t in ['rainbow', 'happy', 'cake', 'napkin', 'nice', 'table', 'water', 'light', 'dollar', 'word', 'kind', 'phone', 'mist', 'snap', 'ball', 'jumped']:
        r = shards[re.sub(r'[^a-z]', '_', (t + '_')[:2])].get(t)
        print(t, r)


if __name__ == '__main__':
    main()
