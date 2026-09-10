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
ids = [f'H{i:02}' for i in range(1,9)] + ['ANSWER']
out = root / 'public' / 'markers.pdf'
c = canvas.Canvas(str(out), pagesize=A4, pageCompression=1)
c.setTitle('AR Obake - Calibration Markers v1')
c.setAuthor('AR Obake project')
for index, marker_id in enumerate(ids):
    c.setFillColorRGB(.063,.11,.21)
    c.setFont(japanese,12)
    c.drawString(25*mm,273*mm,'ARおばけ探偵団 / 検証用マーカー')
    c.setFont('Helvetica-Bold',32)
    c.drawString(25*mm,254*mm,marker_id)
    c.setFont(japanese,10)
    c.drawString(25*mm,242*mm,'A4・縦・倍率100%で印刷 / マーカー画像は160 × 160 mm')
    c.drawImage(str(root/'public'/'markers'/f'{marker_id}.png'),25*mm,68*mm,160*mm,160*mm)
    c.setFont(japanese,10)
    text = '1枚・4枚・9枚セットで使用' if marker_id=='H01' else '4枚・9枚セットで使用' if marker_id in ['H02','H03','ANSWER'] else '9枚セットで使用'
    c.drawString(25*mm,52*mm,text)
    c.drawString(25*mm,43*mm,'白黒印刷も可。光沢を避け、画像全体をカメラに映してください。')
    c.setStrokeColorRGB(.3,.4,.5)
    c.line(25*mm,29*mm,75*mm,29*mm)
    c.line(25*mm,27*mm,25*mm,31*mm); c.line(75*mm,27*mm,75*mm,31*mm)
    c.setFont('Helvetica',9)
    c.drawString(26*mm,22*mm,'50 mm / scale check')
    c.drawRightString(185*mm,22*mm,f'calibration-v1 / {index+1} of 9')
    c.showPage()
c.save()
print(out)
