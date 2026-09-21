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

INK = HexColor('#14213B')
MUTED = HexColor('#53627A')
PALE = HexColor('#F4F7FB')
LINE = HexColor('#D7DFEA')
GREEN = HexColor('#31A46C')
BLUE = HexColor('#337CCE')
YELLOW = HexColor('#F1BF31')


def marker_info(marker_id: str) -> dict:
    if marker_id == 'TUTORIAL':
        return {
            'kind': 'れんしゅう',
            'title': 'れんしゅうカード',
            'name': mission['tutorialMarker']['speaker'],
            'accent': GREEN,
            'steps': [
                'ゲームの さいしょに、',
                'このカードを カメラに うつそう。',
                '',
                'おばけと ふきだしが 見えたら、',
                'れんしゅう せいこう！',
            ],
        }
    if marker_id == 'ANSWER':
        return {
            'kind': 'こたえ',
            'title': 'こたえカード',
            'name': 'ANSWERの おばけ',
            'accent': YELLOW,
            'steps': [
                'みんなの そうさメモを 見せあおう。',
                '',
                'こたえが きまったら、だいひょうの 人が',
                'このカードを カメラに うつそう。',
            ],
        }
    hint = hint_by_marker[marker_id]
    return {
        'kind': 'ヒント',
        'title': 'ヒントカード',
        'name': hint['speaker'],
        'accent': BLUE,
        'steps': [
            'このカードを カメラに うつそう。',
            '',
            'おばけの ことばは、じどうで',
            '「そうさメモ」に 入るよ。',
        ],
    }


def draw_ghost(pdf: canvas.Canvas, x: float, y: float, scale: float, accent) -> None:
    pdf.saveState()
    pdf.translate(x, y)
    pdf.scale(scale, scale)
    pdf.setFillColor(accent)
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(2.2)
    path = pdf.beginPath()
    path.moveTo(-27, -28)
    path.curveTo(-34, 3, -27, 31, 0, 35)
    path.curveTo(27, 31, 34, 3, 27, -28)
    path.curveTo(18, -18, 10, -35, 0, -24)
    path.curveTo(-10, -35, -18, -18, -27, -28)
    path.close()
    pdf.drawPath(path, fill=1, stroke=1)
    pdf.setFillColor(INK)
    pdf.circle(-9, 7, 3.2, fill=1, stroke=0)
    pdf.circle(9, 7, 3.2, fill=1, stroke=0)
    pdf.setLineWidth(2)
    pdf.arc(-8, -10, 8, 3, startAng=200, extent=140)
    pdf.restoreState()


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
    pdf.drawCentredString(width / 2, 39 * mm, 'うらには、このカードの つかいかたが かいてあるよ')


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

    draw_ghost(pdf, 160 * mm, 210 * mm, 1.0, info['accent'])
    pdf.setFillColor(INK)
    pdf.setFont(japanese_bold, 28)
    pdf.drawString(29 * mm, 214 * mm, info['title'])
    pdf.setFont(japanese_bold, 15)
    pdf.setFillColor(info['accent'] if marker_id != 'ANSWER' else HexColor('#A66F00'))
    pdf.drawString(29 * mm, 197 * mm, info['name'])

    pdf.setFillColor(INK)
    pdf.setFont(japanese_bold, 17)
    pdf.drawString(29 * mm, 171 * mm, 'このカードの つかいかた')
    pdf.setStrokeColor(info['accent'])
    pdf.setLineWidth(2)
    pdf.line(29 * mm, 166 * mm, 181 * mm, 166 * mm)

    pdf.setFont(japanese, 15)
    y = 148 * mm
    for line in info['steps']:
        if line:
            pdf.drawString(31 * mm, y, line)
        y -= 10 * mm

    pdf.setFillColor(HexColor('#EAF0F8'))
    pdf.roundRect(29 * mm, 68 * mm, 152 * mm, 33 * mm, 5 * mm, fill=1, stroke=0)
    pdf.setFillColor(INK)
    pdf.setFont(japanese_bold, 12)
    pdf.drawCentredString(width / 2, 87 * mm, 'ヒントや こたえは、ARの おばけが おしえてくれるよ。')
    pdf.setFont(japanese, 10)
    pdf.setFillColor(MUTED)
    pdf.drawCentredString(width / 2, 76 * mm, 'カードの うらを見ただけでは、なぞの こたえは わかりません。')

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
    pdf.setSubject('利用者向け両面印刷カード。奇数ページがマーカー、偶数ページが案内面。')
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
make_pdf(all_output, all_ids, 'ARおばけ探偵団 - 両面印刷用マーカー全10枚')
make_pdf(tutorial_output, ['TUTORIAL'], 'ARおばけ探偵団 - 両面印刷用TUTORIAL')
shutil.copyfile(all_output, root / 'public' / 'markers.pdf')
shutil.copyfile(tutorial_output, root / 'public' / 'tutorial-marker.pdf')
print(all_output)
print(tutorial_output)
