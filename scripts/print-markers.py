from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]
font_path = Path('C:/Windows/Fonts/YuGothR.ttc')
if font_path.exists():
    pdfmetrics.registerFont(TTFont('Japanese', str(font_path), subfontIndex=0))
else:
    pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
japanese = 'Japanese' if font_path.exists() else 'HeiseiKakuGo-W5'
all_ids = [f'H{i:02}' for i in range(1, 9)] + ['ANSWER', 'TUTORIAL']


def usage(marker_id: str) -> str:
    if marker_id == 'TUTORIAL':
        return 'ゲームの最初に1回読む練習カード'
    if marker_id == 'H01':
        return '1枚・4枚・9枚・10枚セットで使用'
    if marker_id in ['H02', 'H03', 'ANSWER']:
        return '4枚・9枚・10枚セットで使用'
    return '9枚・10枚セットで使用'


def make_pdf(output: Path, marker_ids: list[str], title: str) -> None:
    pdf = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    pdf.setTitle(title)
    pdf.setAuthor('AR Obake project')
    total = len(marker_ids)
    for index, marker_id in enumerate(marker_ids):
        pdf.setFillColorRGB(.063, .11, .21)
        pdf.setFont(japanese, 12)
        pdf.drawString(25*mm, 273*mm, 'ARおばけ探偵団 / 印刷用マーカー')
        pdf.setFont('Helvetica-Bold', 29 if marker_id == 'TUTORIAL' else 32)
        pdf.drawString(25*mm, 254*mm, marker_id)
        pdf.setFont(japanese, 10)
        pdf.drawString(25*mm, 242*mm, 'A4・縦・倍率100%で印刷 / マーカー画像は160 × 160 mm')
        pdf.drawImage(str(root / 'public' / 'markers' / f'{marker_id}.png'), 25*mm, 68*mm, 160*mm, 160*mm)
        pdf.setFont(japanese, 10)
        pdf.drawString(25*mm, 52*mm, usage(marker_id))
        pdf.drawString(25*mm, 43*mm, '白黒印刷も可。光沢を避け、画像全体をカメラに映してください。')
        pdf.setStrokeColorRGB(.3, .4, .5)
        pdf.line(25*mm, 29*mm, 75*mm, 29*mm)
        pdf.line(25*mm, 27*mm, 25*mm, 31*mm)
        pdf.line(75*mm, 27*mm, 75*mm, 31*mm)
        pdf.setFont('Helvetica', 9)
        pdf.drawString(26*mm, 22*mm, '50 mm / scale check')
        pdf.drawRightString(185*mm, 22*mm, f'tutorial-v1 / {index+1} of {total}')
        pdf.showPage()
    pdf.save()


make_pdf(root / 'public' / 'markers.pdf', all_ids, 'AR Obake - All Markers tutorial-v1')
make_pdf(root / 'public' / 'tutorial-marker.pdf', ['TUTORIAL'], 'AR Obake - Tutorial Marker')
print(root / 'public' / 'markers.pdf')
print(root / 'public' / 'tutorial-marker.pdf')
