import json
import shutil
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


root = Path(__file__).resolve().parents[1]
regular_path = Path('C:/Windows/Fonts/YuGothR.ttc')
bold_path = Path('C:/Windows/Fonts/YuGothB.ttc')
if regular_path.exists():
    pdfmetrics.registerFont(TTFont('Japanese', str(regular_path), subfontIndex=0))
    japanese = 'Japanese'
else:
    pdfmetrics.registerFont(UnicodeCIDFont('HeiseiKakuGo-W5'))
    japanese = 'HeiseiKakuGo-W5'
if bold_path.exists():
    pdfmetrics.registerFont(TTFont('JapaneseBold', str(bold_path), subfontIndex=0))
    japanese_bold = 'JapaneseBold'
else:
    japanese_bold = japanese

mission = json.loads((root / 'public' / 'missions' / 'main.json').read_text(encoding='utf-8'))
hint_by_marker = {hint['markerId']: hint for hint in mission['hints']}
all_ids = ['TUTORIAL'] + [f'H{i:02}' for i in range(1, 9)] + ['ANSWER']

INK = HexColor('#17142F')
MUTED = HexColor('#5C5870')
PALE = HexColor('#FFF8EF')
LINE = HexColor('#DED2E8')
GREEN = HexColor('#31A46C')
BLUE = HexColor('#6A3FB4')
YELLOW = HexColor('#F07824')


def marker_info(marker_id: str) -> dict:
    if marker_id == 'TUTORIAL':
        return {
            'kind': 'れんしゅう',
            'title': 'れんしゅうカード',
            'name': mission['tutorialMarker']['speaker'],
            'accent': GREEN,
            'staff_use': 'ゲーム開始時の練習用',
        }
    if marker_id == 'ANSWER':
        return {
            'kind': 'こたえ',
            'title': 'こたえカード',
            'name': 'ANSWERの おばけ',
            'accent': YELLOW,
            'staff_use': '相談後の回答用',
        }
    hint = hint_by_marker[marker_id]
    return {
        'kind': 'ヒント',
        'title': 'ヒントカード',
        'name': hint['speaker'],
        'accent': BLUE,
        'staff_use': '探索中のヒント用',
    }


def draw_front(pdf: canvas.Canvas, marker_id: str) -> None:
    info = marker_info(marker_id)
    width, height = A4
    pdf.setFillColor(white)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    pdf.setFillColor(info['accent'])
    pdf.roundRect(18 * mm, 270 * mm, 46 * mm, 11 * mm, 5.5 * mm, fill=1, stroke=0)
    pdf.setFillColor(white if marker_id != 'ANSWER' else INK)
    pdf.setFont(japanese_bold, 12)
    pdf.drawCentredString(41 * mm, 273.5 * mm, info['kind'])

    pdf.setFillColor(INK)
    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawRightString(192 * mm, 273.5 * mm, marker_id)
    pdf.drawImage(
        str(root / 'public' / 'markers' / f'{marker_id}.png'),
        25 * mm,
        67 * mm,
        160 * mm,
        160 * mm,
        preserveAspectRatio=True,
        mask='auto',
    )
    pdf.setFont(japanese_bold, 15)
    pdf.drawCentredString(width / 2, 48 * mm, 'カードぜんたいを カメラに うつそう')
    pdf.setFillColor(MUTED)
    pdf.setFont(japanese, 9)
    pdf.drawCentredString(width / 2, 39 * mm, 'うらめんは スタッフ用です')


def draw_back(pdf: canvas.Canvas, marker_id: str) -> None:
    info = marker_info(marker_id)
    width, height = A4
    pdf.setFillColor(PALE)
    pdf.rect(0, 0, width, height, fill=1, stroke=0)

    pdf.setFillColor(white)
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(1)
    pdf.roundRect(17 * mm, 29 * mm, 176 * mm, 243 * mm, 7 * mm, fill=1, stroke=1)
    pdf.setFillColor(info['accent'])
    pdf.roundRect(17 * mm, 238 * mm, 176 * mm, 34 * mm, 7 * mm, fill=1, stroke=0)
    pdf.rect(17 * mm, 238 * mm, 176 * mm, 10 * mm, fill=1, stroke=0)

    pdf.setFillColor(white if marker_id != 'ANSWER' else INK)
    pdf.setFont(japanese_bold, 11)
    pdf.drawString(29 * mm, 257 * mm, 'ARおばけ探偵団')
    pdf.setFont('Helvetica-Bold', 17)
    pdf.drawRightString(181 * mm, 255.5 * mm, marker_id)

    pdf.setFillColor(INK)
    pdf.setFont(japanese_bold, 13)
    pdf.drawString(29 * mm, 218 * mm, 'スタッフ用')
    pdf.setFont('Helvetica-Bold', 46)
    pdf.drawString(29 * mm, 191 * mm, marker_id)
    pdf.setFont(japanese_bold, 18)
    pdf.drawString(29 * mm, 171 * mm, info['title'])
    pdf.setFont(japanese, 13)
    pdf.setFillColor(MUTED)
    pdf.drawRightString(181 * mm, 171 * mm, info['name'])

    pdf.setStrokeColor(info['accent'])
    pdf.setLineWidth(2)
    pdf.line(29 * mm, 164 * mm, 181 * mm, 164 * mm)

    pdf.setFillColor(INK)
    pdf.setFont(japanese_bold, 14)
    pdf.drawString(29 * mm, 143 * mm, '用途')
    pdf.setFont(japanese, 14)
    pdf.drawString(55 * mm, 143 * mm, info['staff_use'])

    pdf.setFont(japanese_bold, 14)
    pdf.drawString(29 * mm, 118 * mm, '設置場所')
    pdf.setStrokeColor(MUTED)
    pdf.setLineWidth(.8)
    pdf.line(58 * mm, 116 * mm, 181 * mm, 116 * mm)

    pdf.setFont(japanese_bold, 14)
    pdf.setFillColor(INK)
    pdf.drawString(29 * mm, 91 * mm, '確認')
    pdf.setFont(japanese, 13)
    pdf.drawString(55 * mm, 91 * mm, '□ 設置済み　　□ 回収済み')

    pdf.setFillColor(MUTED)
    pdf.setFont(japanese, 9)
    pdf.drawString(29 * mm, 66 * mm, '表面と同じIDか確認してください。')

    pdf.setStrokeColor(MUTED)
    pdf.setLineWidth(.7)
    pdf.line(29 * mm, 48 * mm, 79 * mm, 48 * mm)
    pdf.line(29 * mm, 46 * mm, 29 * mm, 50 * mm)
    pdf.line(79 * mm, 46 * mm, 79 * mm, 50 * mm)
    pdf.setFillColor(MUTED)
    pdf.setFont(japanese, 8)
    pdf.drawString(29 * mm, 40 * mm, '50 mm / 印刷倍率の確認')
    pdf.drawRightString(181 * mm, 40 * mm, 'A4・100%・両面印刷（長辺とじ）')


def make_pdf(output: Path, marker_ids: list[str], title: str) -> None:
    pdf = canvas.Canvas(str(output), pagesize=A4, pageCompression=1)
    pdf.setTitle(title)
    pdf.setAuthor('ARおばけ探偵団')
    pdf.setSubject('ハロウィン仕様の両面印刷カード。奇数ページがマーカー、偶数ページがスタッフ用情報。')
    for marker_id in marker_ids:
        draw_front(pdf, marker_id)
        pdf.showPage()
        draw_back(pdf, marker_id)
        pdf.showPage()
    pdf.save()


output_dir = root / 'output' / 'pdf'
output_dir.mkdir(parents=True, exist_ok=True)
all_output = output_dir / 'ar-obake-markers-duplex.pdf'
tutorial_output = output_dir / 'ar-obake-tutorial-duplex.pdf'
make_pdf(all_output, all_ids, 'ARおばけ探偵団 - ハロウィン両面マーカー全10枚')
make_pdf(tutorial_output, ['TUTORIAL'], 'ARおばけ探偵団 - ハロウィン両面TUTORIAL')
shutil.copyfile(all_output, root / 'public' / 'markers.pdf')
shutil.copyfile(tutorial_output, root / 'public' / 'tutorial-marker.pdf')
print(all_output)
print(tutorial_output)
