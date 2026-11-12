#!/usr/bin/env python3
"""Builds Word Explorer's dictionary data from Open English WordNet 2024 (CC BY 4.0).

Usage:
  curl -L -o oewn.xml.gz https://github.com/globalwordnet/english-wordnet/releases/download/2024-edition/english-wordnet-2024.xml.gz
  python3 -I scripts/build-word-explorer-data.py oewn.xml.gz

Writes (all generated, edit this script, not the output):
  public/word-explorer/index.json        every word: [word, parts of speech, frequency band], irregular forms
  public/word-explorer/entries/<xx>.json meanings, examples, synonyms, opposites, word family, forms, IPA,
                                         sharded by the word's first two letters so a word page loads one small file
  public/word-explorer/OEWN-LICENSE.txt  the CC BY 4.0 credit line

Only words in the Write mode word list (public/writer/words.json) are kept, so every word is an everyday word.
The kid-safe filter (src/lib/word-explorer/blocklist.json) drops blocked words, and drops any meaning, example or
synonym whose text uses a blocked term. Em dashes are replaced (her rule: no em dashes anywhere).
Share-alike data is not mixed in here: OEWN is CC BY 4.0 (attribution only).
"""
import gzip
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'word-explorer')
MAX_PER_POS = 5
MAX_SENSES = 8
MAX_EXAMPLES = 3
MAX_SYN = 10

block = json.load(open(os.path.join(ROOT, 'src', 'lib', 'word-explorer', 'blocklist.json')))
BLOCKED_WORDS = set(block['words'])
TERM_RE = re.compile(r'\b(' + '|'.join(re.escape(t) for t in block['meaningTerms']) + r')', re.I)


def blocked_word(w):
    return w.lower() in BLOCKED_WORDS


def blocked_text(t):
    return bool(TERM_RE.search(t)) or any(blocked_word(x) for x in re.findall(r"[a-z]+", t.lower()))


def clean(t):
    t = t.replace('—', ', ').replace('–', ' to ').replace('``', '"').replace("''", '"')
    return re.sub(r'\s+', ' ', t).strip().strip(';').strip()


ranks = json.load(open(os.path.join(ROOT, 'public', 'writer', 'words.json')))
BAND = {}
for r, lst in enumerate(ranks):
    for w in lst:
        BAND.setdefault(w.lower(), r + 1)  # SCOWL size level 0..3 -> band 1..4 (5 = not in the list)
pos_json = json.load(open(os.path.join(ROOT, 'public', 'writer', 'pos.json')))
POS_ORDER = {}
for code, lst in pos_json.items():
    for w in lst.split(' '):
        POS_ORDER[w] = code
KEEP = set(BAND)

src = sys.argv[1] if len(sys.argv) > 1 else None
if not src:
    sys.exit(__doc__)
opener = gzip.open if src.endswith('.gz') else open

POS = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 's': 'adjective', 'r': 'adverb'}
entries = defaultdict(list)          # word -> [entry]
sense_word = {}                      # sense id -> (word, pos)
synset_members = defaultdict(list)   # synset id -> [word]
synsets = {}                         # synset id -> {def, ex, lex, sim}
forms = {}                           # irregular form -> base word

print('reading', src)
with opener(src, 'rb') as f:
    for ev, el in ET.iterparse(f, events=('end',)):
        tag = el.tag
        if tag == 'LexicalEntry':
            lemma_el = el.find('Lemma')
            word = lemma_el.get('writtenForm')
            pos = POS.get(lemma_el.get('partOfSpeech'), None)
            senses = []
            for s in el.findall('Sense'):
                rels = defaultdict(list)
                for r in s.findall('SenseRelation'):
                    rels[r.get('relType')].append(r.get('target'))
                senses.append({'id': s.get('id'), 'synset': s.get('synset'), 'ant': rels['antonym'],
                               'der': rels['derivation'], 'sim': rels['similar']})
                sense_word[s.get('id')] = (word, pos)
                synset_members[s.get('synset')].append(word)
            ipa = None
            for p in lemma_el.findall('Pronunciation'):
                if p.get('variety') in (None, 'US') or ipa is None:
                    ipa = p.text
            fs = [x.get('writtenForm') for x in el.findall('Form')]
            if pos and re.fullmatch(r"[a-z][a-z'-]*", word) and word in KEEP:
                entries[word].append({'pos': pos, 'senses': senses, 'ipa': ipa, 'forms': fs})
                for x in fs:
                    if x != word and re.fullmatch(r"[a-z'-]+", x):
                        forms.setdefault(x, word)
            el.clear()
        elif tag == 'Synset':
            sim = [r.get('target') for r in el.findall('SynsetRelation') if r.get('relType') == 'similar']
            d = el.find('Definition')
            synsets[el.get('id')] = {
                'def': clean(d.text or '') if d is not None else '',
                'ex': [clean(e.text or '') for e in el.findall('Example')],
                'lex': el.get('lexfile', ''),
                'sim': sim,
            }
            el.clear()

print(len(entries), 'words with meanings')


def kid_word(w):
    return w in KEEP and not blocked_word(w) and re.fullmatch(r"[a-z][a-z'-]*", w)


def strip_quotes(t):
    t = t.strip()
    if len(t) > 1 and t[0] == '"' and t[-1] == '"':
        t = t[1:-1]
    return t.strip()


def pos_rank(word, pos):
    code = POS_ORDER.get(word, '')
    letter = {'noun': 'n', 'verb': 'v', 'adjective': 'a', 'adverb': 'r'}[pos]
    for i, c in enumerate(code):
        if c == letter:
            return i
        if c == letter.upper():
            return 10 + i
    return 20


out = {}
for word, ents in entries.items():
    if blocked_word(word):
        continue
    rec = {'ipa': next((e['ipa'] for e in ents if e['ipa']), None), 'parts': []}
    total = 0
    for e in sorted(ents, key=lambda e: pos_rank(word, e['pos'])):
        senses = []
        for s in e['senses']:
            if len(senses) >= MAX_PER_POS or total >= MAX_SENSES:
                break
            ss = synsets.get(s['synset'])
            if not ss or not ss['def'] or blocked_text(ss['def']):
                continue
            syn = [m for m in dict.fromkeys(synset_members[s['synset']]) if m != word and kid_word(m)][:MAX_SYN]
            # Similar words (an adjective's satellites), so "happy" also offers glad, cheerful...
            sim = []
            for t in ss['sim']:
                for m in synset_members.get(t, []):
                    if m != word and m not in syn and m not in sim and kid_word(m):
                        sim.append(m)
            ant = []
            for t in s['ant']:
                w2 = sense_word.get(t, (None,))[0]
                if w2 and kid_word(w2) and w2 not in ant:
                    ant.append(w2)
            fam = []
            for t in s['der']:
                w2, p2 = sense_word.get(t, (None, None))
                if w2 and kid_word(w2) and w2 != word and [w2, p2] not in fam:
                    fam.append([w2, p2])
            ex = [strip_quotes(x) for x in ss['ex'] if x and not blocked_text(x)]
            ex = [x for x in ex if re.search(r'\b' + re.escape(word[:max(3, len(word) - 2)]), x, re.I)][:MAX_EXAMPLES]
            sense = {'id': s['id'], 'def': ss['def'], 'lex': ss['lex']}
            if ex: sense['ex'] = ex
            if syn: sense['syn'] = syn
            if sim: sense['sim'] = sim[:MAX_SYN]
            if ant: sense['ant'] = ant
            if fam: sense['fam'] = fam
            senses.append(sense)
            total += 1
        if senses:
            part = {'pos': e['pos'], 'senses': senses}
            if e['forms']:
                part['forms'] = e['forms']
            rec['parts'].append(part)
    if rec['parts']:
        if not rec['ipa']:
            del rec['ipa']
        out[word] = rec

shards = defaultdict(dict)
for w, rec in out.items():
    key = re.sub(r'[^a-z]', '_', (w + '_')[:2])
    shards[key][w] = rec

os.makedirs(os.path.join(OUT, 'entries'), exist_ok=True)
for name in os.listdir(os.path.join(OUT, 'entries')):
    os.remove(os.path.join(OUT, 'entries', name))
total_bytes = 0
for key, recs in shards.items():
    data = json.dumps(recs, separators=(',', ':'), ensure_ascii=False, sort_keys=True)
    total_bytes += len(data.encode())
    with open(os.path.join(OUT, 'entries', key + '.json'), 'w') as f:
        f.write(data)

# The index: every kid-safe word in the word list, with the parts of speech WordNet gives it (most common first)
# and its frequency band. Words with no WordNet meaning (the, and, she) are still listed so search finds them.
index = []
for w in sorted(KEEP):
    if blocked_word(w) or not re.fullmatch(r"[a-z][a-z'-]*", w):
        continue
    index.append([w, POS_ORDER.get(w, ''), BAND[w], 1 if w in out else 0])
idx = {'v': 1, 'source': 'Open English WordNet 2024 (CC BY 4.0); SCOWL word list (frequency band stand-in)',
       'words': index, 'forms': {k: v for k, v in sorted(forms.items()) if not blocked_word(k)}}
with open(os.path.join(OUT, 'index.json'), 'w') as f:
    json.dump(idx, f, separators=(',', ':'), ensure_ascii=False)

with open(os.path.join(OUT, 'OEWN-LICENSE.txt'), 'w') as f:
    f.write('Word Explorer meanings, examples, synonyms, opposites and word families come from\n'
            'Open English WordNet (2024 edition), https://github.com/globalwordnet/english-wordnet\n'
            'Licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0),\n'
            'https://creativecommons.org/licenses/by/4.0/\n'
            'Open English WordNet is based on Princeton WordNet 3.0 (see public/writer/WORDNET-LICENSE.txt).\n'
            'Changes: filtered to everyday words, kid-safe filtered, trimmed to the most common meanings.\n')

print(len(out), 'entries,', len(shards), 'files,', total_bytes // 1024, 'KB;', len(index), 'index words;', len(forms), 'forms')
