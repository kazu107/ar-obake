"""A4 landscape sheet for staff to print and fill by hand."""
import json
import shutil
from pathlib import Path
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

root = Path(__file__).resolve().parents[1]
for name, path in [('Japanese', 'C:/Windows/Fonts/YuGothR.ttc'), ('JapaneseBold', 'C:/Windows/Fonts/YuGothB.ttc')]:
    pdfmetrics.registerFont(TTFont(name, path, subfontIndex=0)) if Path(path).exists() else pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
regular = 'Japanese' if Path('C:/Windows/Fonts/YuGothR.ttc').exists() else 'HeiseiKakuGo-W5'
bold = 'JapaneseBold' if Path('C:/Windows/Fonts/YuGothB.ttc').exists() else 'HeiseiKakuGo-W5'
version = json.loads((root / 'package.json').read_text(encoding='utf-8'))['version']
output = root / 'output' / 'pdf' / 'ar-obake-staff-placement-checklist.pdf'
output.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(output), pagesize=landscape(A4), pageCompression=1, invariant=1)
pdf.setTitle('ARおばけ探偵団 - スタッフ用設置確認表')
pdf.setAuthor('ARおばけ探偵団')
pdf.setSubject('印刷して手書きで記入する設置場所・表示角度・読み取り・設置回収の確認表')
ink, muted, line = HexColor('#152443'), HexColor('#55647A'), HexColor('#D9E0EA')

def text(x, y, value, size=10, strong=False, color=ink):
    pdf.setFillColor(color)
    pdf.setFont(bold if strong else regular, size)
    pdf.drawString(x * mm, y * mm, value)

def checkbox(x, y, label, size=9):
    pdf.setStrokeColor(muted)
    pdf.setLineWidth(.7)
    pdf.rect(x * mm, (y - .5) * mm, 2.8 * mm, 2.8 * mm, stroke=1, fill=0)
    text(x + 4.3, y, label, size)

text(13, 190, 'ARおばけ探偵団　設置確認表', 20, True)
text(253, 191, 'スタッフ用', 11, True)
for x, label, end in [(13, '会場', 87), (92, '日付', 150), (155, '担当', 216), (221, '端末', 284)]:
    text(x, 177, label, 10, True)
    pdf.setStrokeColor(muted)
    pdf.line((x + 13) * mm, 175.5 * mm, end * mm, 175.5 * mm)
text(13, 166, '設置場所を記入し、実際に設定した角度にチェック。使用する端末で各カードの読み取りと表示を確認してください。', 10)

columns = [22, 34, 62, 49, 33, 35, 36]
headings = ['ID', 'カード / おばけ', '設置場所', '表示角度', '読み取り確認', '設置', '回収']
starts = [13]
for width in columns:
    starts.append(starts[-1] + width)
top, header_h, row_h = 156, 10, 11.8
pdf.setFillColor(ink)
pdf.roundRect(13 * mm, (top - header_h) * mm, 271 * mm, header_h * mm, 2 * mm, stroke=0, fill=1)
for x, heading in zip(starts, headings):
    text(x + 2, top - 6.4, heading, 9.5, True, white)

ids = ['TUTORIAL'] + [f'H{i:02}' for i in range(1, 9)] + ['ANSWER']
names = ['れんしゅう', 'いちばん', 'にばん', 'さんばん', 'よんばん', 'ごばん', 'ろくばん', 'ななばん', 'はちばん', 'こたえ']
variants = {'TUTORIAL': '手振り', 'H01': 'かぼちゃ', 'H02': 'こうもり', 'H03': 'まくら / 半目', 'H04': 'おかし', 'H05': '本', 'H06': '鈴', 'H07': 'ほうき', 'H08': '驚き', 'ANSWER': 'メモ帳 / うなずき'}
for index, (marker_id, name) in enumerate(zip(ids, names)):
    row_top = top - header_h - index * row_h
    bottom = row_top - row_h
    pdf.setFillColor(white if index % 2 == 0 else HexColor('#F3F6FA'))
    pdf.rect(13 * mm, bottom * mm, 271 * mm, row_h * mm, fill=1, stroke=0)
    pdf.setStrokeColor(line)
    pdf.setLineWidth(.6)
    pdf.line(13 * mm, bottom * mm, 284 * mm, bottom * mm)
    for x in starts:
        pdf.line(x * mm, row_top * mm, x * mm, bottom * mm)
    pdf.setFillColor(ink)
    pdf.setFont('Helvetica-Bold', 9)
    pdf.drawString((starts[0] + 2) * mm, (bottom + 4.3) * mm, marker_id)
    text(starts[1] + 2, bottom + 6.6, name, 9.5, True)
    text(starts[1] + 2, bottom + 2.2, variants.get(marker_id, '通常'), 8, color=muted)
    pdf.setStrokeColor(line)
    pdf.line((starts[2] + 3) * mm, (bottom + 3) * mm, (starts[3] - 3) * mm, (bottom + 3) * mm)
    checkbox(starts[3] + 3, bottom + 6.8, '平行')
    checkbox(starts[3] + 24, bottom + 6.8, '垂直')
    text(starts[3] + 3, bottom + 2.1, '初期：' + ('垂直' if marker_id in ['H01', 'H02', 'H03'] else '平行'), 8, color=muted)
    checkbox(starts[4] + 3, bottom + 4.3, '確認済み')
    checkbox(starts[5] + 3, bottom + 4.3, '設置済み')
    checkbox(starts[6] + 3, bottom + 4.3, '回収済み')

text(13, 22, '平行＝壁向け／垂直＝机向け。角度は端末ごとに設定し、次のカメラ開始で反映します。', 8.5)
text(13, 15, f'アプリ{version}用。全10体の小物・表情と、約2秒で動きが止まることも確認。A4横・100%で印刷。', 8.5)
url = 'https://kazu107.github.io/ar-obake/'
pdf.setFont('Helvetica', 9)
pdf.drawString(13 * mm, 8 * mm, url)
qr = QrCodeWidget(url, barWidth=22 * mm, barHeight=22 * mm, barLevel='M')
drawing = Drawing(22 * mm, 22 * mm)
drawing.add(qr)
renderPDF.draw(drawing, pdf, 262 * mm, 3 * mm)
pdf.showPage()
pdf.save()
shutil.copyfile(output, root / 'public' / 'staff-checklist.pdf')
print(output)
