#!/usr/bin/env python3
"""Builds public/word-explorer/lists.json, the index Browse and the Word List Maker filter (build spec Phase 4).

Run after build-word-explorer-data.py, build-word-explorer-phonics.py and build-word-explorer-pictures.py:
  python3 -I scripts/build-word-explorer-lists.py

For every word: its parts of speech (WordNet, every meaning), frequency band, the grapheme pattern of every
letter-sound, the type of every syllable, its WordNet topic (from the lexicographer file of its first meaning), and
whether it has a picture. Patterns, syllable types and topics are stored as numbers into the lists at the top.
"""
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'word-explorer')
index = json.load(open(os.path.join(OUT, 'index.json')))
pics = json.load(open(os.path.join(OUT, 'pictures.json')))
phon = {}
for f in glob.glob(os.path.join(OUT, 'phonics', '*.json')):
    phon.update(json.load(open(f)))
lex = {}
for f in glob.glob(os.path.join(OUT, 'entries', '*.json')):
    for w, rec in json.load(open(f)).items():
        s = rec['parts'][0]['senses'][0]
        lex[w] = s['lex']

patterns, sylls, lexes = [], [], []
def idx(lst, v):
    if v not in lst:
        lst.append(v)
    return lst.index(v)

rows = []
for w, pos, band, has in index['words']:
    p = phon.get(w)
    if not has and not p:
        continue
    g = sorted({idx(patterns, x[2]) for x in p['g']}) if p and not p.get('u') else []
    sy = [idx(sylls, s[1]) for s in p['s']] if p and not p.get('u') else []
    lx = idx(lexes, lex[w]) if w in lex else -1
    rows.append([w, pos, band, g, sy, lx, 1 if w in pics else 0])
data = {'patterns': patterns, 'syllables': sylls, 'lex': lexes, 'words': rows}
s = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
open(os.path.join(OUT, 'lists.json'), 'w').write(s)
print(len(rows), 'words', len(s) // 1024, 'KB', len(patterns), 'patterns', len(lexes), 'topics')
