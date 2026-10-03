"""Render both print PDFs and verify card size, embedded image, staff backs and QR."""
import json
import math
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader
from pypdf.generic import ContentStream
import zxingcpp

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root / 'tmp/pdfs' / f'markers-{version}'
output.mkdir(parents=True, exist_ok=True)
bundled = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe'
renderer = shutil.which('pdftoppm') or str(bundled)
all_ids = ['TUTORIAL'] + [f'H{i:02}' for i in range(1, 9)] + ['ANSWER']
checks, thumbnails = [], []
for filename, public_name, ids in [
    ('ar-obake-markers-duplex.pdf', 'markers.pdf', all_ids),
    ('ar-obake-tutorial-duplex.pdf', 'tutorial-marker.pdf', ['TUTORIAL']),
]:
    source = root / 'output/pdf' / filename
    assert source.read_bytes() == (root / 'public' / public_name).read_bytes()
    assert source.read_bytes() == (root / 'dist' / public_name).read_bytes()
    reader = PdfReader(source)
    assert len(reader.pages) == len(ids) * 2
    prefix = output / source.stem
    subprocess.run([renderer, '-r', '100', '-png', str(source), str(prefix)], check=True)
    qr_checks = []
    for index, page in enumerate(reader.pages):
        marker_id = ids[index // 2]
        assert math.isclose(float(page.mediabox.width), 210 * 72 / 25.4, abs_tol=.01)
        assert math.isclose(float(page.mediabox.height), 297 * 72 / 25.4, abs_tol=.01)
        text = page.extract_text()
        assert marker_id in text
        image_path = sorted(output.glob(f'{source.stem}-*.png'))[index]
        image = Image.open(image_path).convert('RGB')
        if index % 2 == 0:
            assert 'スタッフ用' not in text and 'https://' not in text
            embedded = page.images[0].image.convert('RGB')
            original = Image.open(root / 'public/markers' / f'{marker_id}.png').convert('RGB')
            assert embedded.size == (800, 800) and embedded.tobytes() == original.tobytes()
            transforms = [values for values, op in ContentStream(page.get_contents(), reader).operations if op == b'cm']
            assert any(math.isclose(float(t[0]), 190 * 72 / 25.4, abs_tol=.01) and math.isclose(float(t[3]), 190 * 72 / 25.4, abs_tol=.01) for t in transforms)
        else:
            assert 'スタッフ用' in text and '設置場所' in text and 'https://kazu107.github.io/ar-obake/' in text
            assert '青い帽子' not in text and 'あおの ぼうし' not in text
            codes = zxingcpp.read_barcodes(image)
            assert [code.text for code in codes] == ['https://kazu107.github.io/ar-obake/']
            qr_checks.append({'page': index + 1, 'qr': codes[0].text})
        image.thumbnail((248, 350))
        thumbnails.append((image.copy(), f'{public_name} p{index + 1} {marker_id}'))
    checks.append({'file': public_name, 'pages': len(reader.pages), 'markerSizeMm': 190, 'qrChecks': qr_checks, 'originalPublicDist': 'identical'})
sheet = Image.new('RGB', (4 * 270, math.ceil(len(thumbnails) / 4) * 382), '#dae0e8')
draw = ImageDraw.Draw(sheet)
for index, (image, label) in enumerate(thumbnails):
    x, y = index % 4 * 270, index // 4 * 382
    sheet.paste(image, (x + 11, y + 24))
    draw.text((x + 11, y + 7), label, fill='black')
sheet.save(output / 'contact-sheet.png')
report = {'testedAt': datetime.now(timezone.utc).isoformat(), 'appVersion': version, 'frontText': 'original H01-H08 / ANSWER / TUTORIAL labels', 'pdfs': checks}
(root / 'docs' / f'marker-pdf-{version}-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('MARKER_PDF_OK')
