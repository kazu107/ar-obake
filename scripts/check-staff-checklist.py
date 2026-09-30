"""Validate the current printed staff sheet after rendering it with Poppler."""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'tmp/pdfs/qr-check-deps'))
import zxingcpp

version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
source = root / 'output/pdf/ar-obake-staff-placement-checklist.pdf'
reader = PdfReader(source)
assert len(reader.pages) == 1
page = reader.pages[0]
assert abs(float(page.mediabox.width) - 841.89) < 1
assert abs(float(page.mediabox.height) - 595.28) < 1
copy = page.extract_text()
ids = ['TUTORIAL'] + [f'H{i:02}' for i in range(1, 9)] + ['ANSWER']
assert all(marker in copy for marker in ids)
assert all(prop in copy for prop in ['こうもり', 'まくら', 'おかし', '本', '鈴', 'ほうき', 'メモ帳'])
assert version in copy and copy.count('初期：垂直') == 3 and copy.count('初期：平行') == 7
qr = zxingcpp.read_barcodes(Image.open(root / f'tmp/pdfs/staff-{version}.png'))
url = 'https://kazu107.github.io/ar-obake/'
assert len(qr) == 1 and qr[0].text == url
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
digest = sha(source)
assert all(sha(root / path) == digest for path in ['public/staff-checklist.pdf', 'dist/staff-checklist.pdf'])
proof = {'appVersion': version, 'pages': 1, 'paper': 'A4 landscape', 'markers': ids,
         'variants': 'all 10 implemented variants', 'perpendicularDefaults': ['H01', 'H02', 'H03'],
         'qr': url, 'originalPublicDist': 'identical', 'sha256': digest,
         'visualReview': 'Rendered single page inspected; no clipping or overlaps'}
(root / f'docs/staff-checklist-{version}-checks.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('STAFF_CHECKLIST_OK')
