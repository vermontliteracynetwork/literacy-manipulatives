#!/usr/bin/env python3
"""Pictures for Word Explorer (build spec Phase 2, Pictures tab): Twemoji graphics (CC BY 4.0).

Usage:
  npm pack unicode-emoji-json@0.8.0 && tar xzf unicode-emoji-json-0.8.0.tgz   (emoji names only, used to pick; not shipped)
  python3 -I scripts/build-word-explorer-pictures.py package/data-by-emoji.json

A word gets a picture when an emoji's English name is that word (rainbow, apple, dog), or through the small
NAMED map below. Weapons, alcohol, faces and flags are left out. Pictures are copied into
public/word-explorer/pictures/ with public/word-explorer/pictures.json listing them, and credited in
public/word-explorer/TWEMOJI-LICENSE.txt.
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'word-explorer')
SRC = 'https://raw.githubusercontent.com/jdecked/twemoji/main/assets/svg/{}.svg'
GROUPS = {'Animals & Nature', 'Food & Drink', 'Travel & Places', 'Activities', 'Objects'}
SKIP = re.compile(r'(gun|pistol|knife|dagger|sword|bomb|bow and arrow|axe|beer|wine|sake|cocktail|tumbler|champagne|bottle with|cigarette|coffin|funeral|syringe|drop of blood|pill|skull|crossed swords|shield|razor|tropical drink|clinking|briefs|bikini|swim brief|chains|lipstick|thong|bra\b)', re.I)
# Words whose emoji name says more than the word ("mobile phone" for phone).
NAMED = {
    'phone': 'mobile phone', 'car': 'automobile', 'book': 'closed book', 'sun': 'sun', 'moon': 'crescent moon', 'star': 'star',
    'house': 'house', 'tree': 'deciduous tree', 'flower': 'tulip', 'ball': 'soccer ball', 'cake': 'shortcake', 'bike': 'bicycle',
    'boat': 'sailboat', 'cloud': 'cloud', 'rain': 'cloud with rain', 'snow': 'snowflake', 'clock': 'mantelpiece clock',
    'cat': 'cat', 'dog': 'dog', 'fish': 'fish', 'bird': 'bird', 'school': 'school', 'bus': 'bus', 'train': 'train', 'plane': 'airplane',
    'airplane': 'airplane', 'computer': 'laptop', 'pencil': 'pencil', 'apple': 'red apple', 'bread': 'bread', 'egg': 'egg',
    'milk': 'glass of milk', 'gift': 'wrapped gift', 'present': 'wrapped gift', 'heart': 'red heart', 'key': 'key', 'door': 'door',
    'chair': 'chair', 'bed': 'bed', 'shoe': 'running shoe', 'hat': 'billed cap', 'shirt': 't-shirt', 'mountain': 'mountain',
    'beach': 'beach with umbrella', 'island': 'desert island', 'fire': 'fire', 'water': 'droplet', 'leaf': 'leaf fluttering in wind',
    'turtle': 'turtle', 'frog': 'frog', 'owl': 'owl', 'whale': 'whale', 'rabbit': 'rabbit', 'horse': 'horse', 'pig': 'pig',
    'cow': 'cow', 'mouse': 'mouse', 'bee': 'honeybee', 'bug': 'bug', 'butterfly': 'butterfly', 'snail': 'snail', 'banana': 'banana',
    'pizza': 'pizza', 'cookie': 'cookie', 'carrot': 'carrot', 'corn': 'ear of corn', 'rocket': 'rocket', 'umbrella': 'umbrella',
    'guitar': 'guitar', 'drum': 'drum', 'map': 'world map', 'globe': 'globe showing americas', 'lightning': 'high voltage',
    'rainbow': 'rainbow', 'kite': 'kite', 'balloon': 'balloon', 'camera': 'camera', 'scissors': 'scissors', 'lamp': 'light bulb',
    'bell': 'bell', 'basket': 'basket', 'teddy': 'teddy bear', 'bear': 'bear', 'lion': 'lion', 'tiger': 'tiger', 'monkey': 'monkey',
    'dinosaur': 'sauropod', 'dragon': 'dragon', 'robot': 'robot', 'truck': 'delivery truck', 'tractor': 'tractor', 'tent': 'tent',
}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src:
        sys.exit(__doc__)
    data = json.load(open(src))
    by_name = {}
    for ch, info in data.items():
        if info['group'] not in GROUPS or SKIP.search(info['name']):
            continue
        by_name.setdefault(info['name'], ch)
    index = json.load(open(os.path.join(OUT, 'index.json')))
    block = json.load(open(os.path.join(ROOT, 'src', 'lib', 'word-explorer', 'blocklist.json')))
    blocked = set(block['words'])
    words = {w for w, *_ in index['words']} - blocked
    chosen = {}
    for w in sorted(words):
        name = NAMED.get(w) or (w if w in by_name else None)
        if name and name in by_name:
            chosen[w] = (by_name[name], name)
    pic_dir = os.path.join(OUT, 'pictures')
    os.makedirs(pic_dir, exist_ok=True)
    out = {}
    for w, (ch, name) in chosen.items():
        code = '-'.join(f'{ord(c):x}' for c in ch if ord(c) != 0xfe0f)
        path = os.path.join(pic_dir, code + '.svg')
        if not os.path.exists(path):
            try:
                with urllib.request.urlopen(SRC.format(code), timeout=20) as r:
                    open(path, 'wb').write(r.read())
            except Exception as e:  # noqa: BLE001
                print('skip', w, code, e)
                continue
        out[w] = {'file': f'/word-explorer/pictures/{code}.svg', 'name': name}
    json.dump(out, open(os.path.join(OUT, 'pictures.json'), 'w'), separators=(',', ':'), sort_keys=True)
    open(os.path.join(OUT, 'TWEMOJI-LICENSE.txt'), 'w').write(
        'Word Explorer pictures are Twemoji graphics, https://github.com/jdecked/twemoji\n'
        'Copyright 2019 Twitter, Inc and other contributors; graphics licensed under CC BY 4.0,\n'
        'https://creativecommons.org/licenses/by/4.0/\n')
    print(len(out), 'pictures')


if __name__ == '__main__':
    main()
