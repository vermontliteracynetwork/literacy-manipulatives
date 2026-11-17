#!/usr/bin/env python3
"""More Word Explorer pictures: Mulberry Symbols (CC BY-SA 4.0, free for commercial use; made for AAC).

Usage:
  git clone --depth 1 https://github.com/mulberrysymbols/mulberry-symbols mulberry
  python3 -I scripts/build-word-explorer-mulberry.py mulberry

A Word Explorer word gets a Mulberry symbol for each part of speech Mulberry draws it as ("cook" the verb from
"cook_,_to", "apple" the noun). Mature-rated symbols, blocked words and words not in Word Explorer are left out;
a Twemoji picture a word already has stays its noun picture. Writes public/word-explorer/pictures/m/<word>-<pos>.svg,
adds a "by" map (part of speech to picture) to every entry in public/word-explorer/pictures.json, and the credit
public/word-explorer/MULBERRY-LICENSE.txt.
"""
import csv
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'word-explorer')
src = sys.argv[1]

words = {w[0] for w in json.load(open(os.path.join(OUT, 'index.json'), encoding='utf8'))['words']}
blocked = set(json.load(open(os.path.join(ROOT, 'src', 'lib', 'word-explorer', 'blocklist.json'), encoding='utf8')).get('words', []))
pics = json.load(open(os.path.join(OUT, 'pictures.json'), encoding='utf8'))
for v in pics.values():
    v.setdefault('by', {'noun': v['file']})

POS = {'Noun': 'noun', 'Verb': 'verb', 'VerbComplex': 'verb'}
dest = os.path.join(OUT, 'pictures', 'm')
os.makedirs(dest, exist_ok=True)
added = 0
rows = list(csv.DictReader(open(os.path.join(src, 'scripts', 'data', 'symbol-info-en.csv'), encoding='utf8')))
rows.sort(key=lambda r: r['symbol'])
for r in rows:
    pos = POS.get(r['grammar'])
    if not pos or r['rated'] != '0':
        continue
    name = re.sub(r'_,_to$', '', r['symbol'])
    m = re.match(r'^([a-z]+)(?:_(\d))?$', name)
    if not m:
        continue
    word = m.group(1)
    if word not in words or word in blocked:
        continue
    entry = pics.setdefault(word, {'file': '', 'name': word, 'by': {}})
    if pos in entry['by']:
        continue
    svg = os.path.join(src, 'EN', r['symbol'] + '.svg')
    if not os.path.exists(svg):
        continue
    out = f'{word}-{pos}.svg'
    shutil.copyfile(svg, os.path.join(dest, out))
    entry['by'][pos] = f'/word-explorer/pictures/m/{out}'
    if not entry['file']:
        entry['file'] = entry['by'][pos]
    added += 1

json.dump(pics, open(os.path.join(OUT, 'pictures.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'MULBERRY-LICENSE.txt'), 'w', encoding='utf8').write(
    'Mulberry Symbols, copyright 2018-2026 Steve Lee, https://mulberrysymbols.org\n'
    'Licensed under the Creative Commons Attribution-ShareAlike 4.0 License (CC BY-SA 4.0):\n'
    'https://creativecommons.org/licenses/by-sa/4.0/\n'
    'Used in Word Explorer as word pictures (public/word-explorer/pictures/m/), unchanged.\n')
print(added, 'Mulberry pictures added;', len(pics), 'words now have a picture')
