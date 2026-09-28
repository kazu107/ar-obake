# ハロウィンマーカー 0.7.0

更新日：2026-09-27

## 変更内容

- TUTORIAL、H01〜H08、ANSWERの全10枚をハロウィン仕様へ変更。
- カボチャ、コウモリ、おばけ、クモの巣、キャンディ、三日月、墓石、星を固定seedで非対称に配置。
- 白に近い背景、濃紺の外枠、紫・オレンジ・緑を使い、印刷時の高コントラストを維持。
- markerId、1枚・4枚・9枚・10枚セット内の順序、targetIndexは変更していない。
- 素材版を`halloween-v1`へ更新。

## 再生成物

- `public/markers/*.png`
- `public/targets/one.mind`
- `public/targets/four.mind`
- `public/targets/nine.mind`
- `public/targets/ten.mind`
- `public/markers.pdf`
- `public/tutorial-marker.pdf`
- `output/pdf/ar-obake-markers-duplex.pdf`
- `output/pdf/ar-obake-tutorial-duplex.pdf`

両面PDFは奇数ページがマーカー面、次の偶数ページがスタッフ用情報。0.7.1では裏面をカードID、用途、設置場所、設置・回収確認、印刷設定だけに整理した。A4、倍率100%、両面、長辺とじで印刷する。ヒント本文と正解は裏面に載せない。

0.7.3では表面の「うらめんは スタッフ用です」を外し、印刷余白10mmを残してマーカーを160mm角から190mm角へ拡大した。裏面には`https://kazu107.github.io/ar-obake/`の文字とQRを追加した。マーカーPNGとMindAR認識データは変更していない。

## 検証範囲

- マーカーPNGのハッシュと4種類の`.mind`内target順序を検査する。
- 全20ページとTUTORIAL単独2ページを画像化し、表裏対応、文字切れ、50mm目盛りを確認する。
- production buildへ合成カメラ映像を入力し、実際のMindARで全10 IDを認識する。
- iPad Air 2、実際の印刷物、会場照明での認識速度と安定性は未確認。
