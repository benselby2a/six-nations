#!/usr/bin/env python3
"""Converts the tour pictures (tour-images/*.jpg, written by dev/tour-shots.sh) to WebP (about half the size)
and points js/tour-images.js at them. Safe to run repeatedly."""
import glob, hashlib, os, re, sys
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
js_path = os.path.join(root, 'js', 'tour-images.js')
js = open(js_path).read()
for jpg in sorted(glob.glob(os.path.join(root, 'tour-images', '*.jpg'))):
    name = os.path.splitext(os.path.basename(jpg))[0]
    webp = os.path.join(root, 'tour-images', name + '.webp')
    Image.open(jpg).save(webp, 'WEBP', quality=80, method=6)
    digest = hashlib.md5(open(webp, 'rb').read()).hexdigest()[:8]
    # "src": "tour-images/<name>.jpg" followed by "v": "<hash>"
    pattern = re.compile(r'("src": "tour-images/' + re.escape(name) + r')\.jpg(",\s*"v": ")[0-9a-f]+(")')
    js, n = pattern.subn(r'\1.webp\g<2>' + digest + r'\3', js)
    if n == 0:
        # a helper picture used while building (not shown in the tour)
        os.remove(webp); os.remove(jpg); continue
    os.remove(jpg)
    print(name, os.path.getsize(webp), 'bytes')
open(js_path, 'w').write(js)
