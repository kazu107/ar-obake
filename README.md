# ARおばけ探偵団：MindAR実機検証版

段階0～1の実装。iPad Air 2向けに画像認識ARと軽量GLBの表示を確認するための静的Webアプリです。

- [実装計画](docs/implementation-plan.md)
- [実機試験の記録表](docs/air2-test-checklist.md)
- [実装と検証の状況](docs/phase-0-1-status.md)
- 配信URL：https://ar-obake-lab.kazu107.chatgpt.site

## 使う

HTTPSのURLをSafariで開き、マーカー印刷ページからH01を印刷して「1枚」「カメラを開始」で試します。Sitesの非公開配信では所有者のChatGPTサインインが必要です。参加者用の公開配信・ログイン不要化はまだ行っていません。

アプリ0.1.3では位置・回転を別々に補正し、描画フレームごとに滑らかに追従させます。小さな変化を抑え、再認識時は新しい位置へリセットします。おばけ自身のアニメーションは独立して切り替えられます。まず「640 × 480」「揺れを抑える（改良）」「静止」で試し、停止後に「前回の安定化（0.1.2）」で同じ条件と比較できます。「揺れを10秒記録」で数値を記録し、JSONを書き出せます。

0.1.1で修正したSafariの映像準備待ち・中断時の再試行も継続しています。「映像を表示」が出た場合は押してください。更新後はSafariを再読み込みして画面下部の版を確認します。

画面の「実機テストの手順」に開始、計測、4枚・9枚、復帰、記録の保存方法を記載しています。

## ローカル開発

検証した実行環境はNode.js 24.19.0、npm 11.6.1。`.node-version`を用意しています。

```powershell
npm ci
npm run dev
npm run build
npm test
npm run check:assets
npm run preview
```

このPCにある古いNode.js 24.11.0では、大きい依存を含むbuildがWindowsネイティブ例外で終了しました。Codexの同梱Node.js 24.19.0では成功しています。Windowsでは同梱版を選ぶ次の補助スクリプトも使えます。

```powershell
.\scripts\run.ps1 dev
.\scripts\run.ps1 build
.\scripts\run.ps1 test
```

実機からPCのlocalhostを開くことはできません。iPadでは配信済みのHTTPS URLを使います。

## 構成

- `src/main.ts`：検証画面、認識イベント、ログ、手動計測、JSON出力。
- `src/ar/pose-stabilizer.ts`：マーカー幅で正規化した位置、Quaternion回転の小変動抑制と時間ベースの描画補間。
- `src/lab/pose-recording.ts`：数値の姿勢記録の形式と件数・値の検証。
- `src/ar/tracking-config.ts`：MindAR内蔵フィルターの安定化・従来設定と、おばけの動きの比較条件。
- `src/ar/camera-preview.ts`：カメラ取得と映像再生を分離し、準備待ち・再試行・タップ再生を処理。
- `src/ar/frame.ts`：MindAR Controller＋Three.js、カメラ、投影行列、GLB表示。
- `ar.html`：AR処理専用の同一オリジンiframe。停止するとiframe全体を破棄し、カメラ・Worker・TensorFlow・WebGLの寿命をまとめて管理します。
- `src/data/sets.ts`：1枚・4枚・9枚の対応。
- `src/lab/measurements.ts`：計測の成功・未検出・中止・別マーカー検出。
- `public/targets/manifest.json`：画像ID・ハッシュ・コンパイル順。
- `public/markers.pdf`：160mm角、A4全9ページの印刷用PDF。
- `public/guide.html`：端末から読める実機手順。

同時追跡は1枚、描画のpixelRatioは1、影なし、単一の約44KBのGLBを共有します。カメラ解像度は要求値と実際の値を分けて記録します。Safari 15を対象にビルドし、import mapや外部CDNを実行時に使いません。

## 素材の再生成

```powershell
npm run assets
npx playwright install chromium
npm run compile:targets
python scripts/print-markers.py
npm run check:assets
```

PDF生成にはreportlabが必要です。Windowsの游ゴシックがある場合はサブセットを埋め込みます。画像生成は`@napi-rs/canvas`、GLBはThree.jsのGLTFExporterを使います。

マーカーは固定seedの非対称な幾何学パターンです。元画像9枚を一括コンパイルし、MindAR形式の各targetデータを順序を保って取り出し、1枚・4枚・9枚のセットを生成します。4枚セットのANSWERはindex 3、9枚セットではindex 8です。素材の編集後は.mindとPDFも作り直してください。

ブラウザ用のMindAR配布物を利用します。MindARが依存する開発用`canvas`は`@napi-rs/canvas`へのnpm overrideで置き換えています。アプリではNode用canvasを読み込みません。依存のinstall scriptは実行せず、lockfileを固定しています。esbuildは修正済み0.28.1へ固定しています。

## ブラウザ試験

production buildのpreviewをポート4173で起動してから実行します。

```powershell
npm run test:browser
node scripts/browser-errors.mjs
```

これはChromiumに合成映像をカメラ入力として渡し、実際のMindARが1枚・4枚・9枚の各IDを認識できるかを試す自動確認です。計測用のモデル出力や認識成功イベントを捏造していません。SwiftShaderを使うため、速度はAir 2の性能評価には使えません。中間のY4M・画像・書き出し記録はGit対象外の`.artifacts/`に保存します。

## 記録の読み方

`localStorage`には直近10セッションを保存し、JSONへ書き出せます。映像や静止画は保存・送信しません。

- セッションの`appVersion`／`lastStartupStage`：その試行のアプリ版と最後に通過した開始段階。0.1.0の過去記録にはありません。
- `events`の`開始確認`：カメラ要求、許可取得、映像接続、映像寸法確定、再生・再試行の経過。映像やデバイスIDは含めません。
- `tracking`：試行の追従モード、実際のフィルター設定、おばけのアニメーション設定。0.1.2以降で記録。
- `poseRecordings`：手動の10秒記録。1回最大110点、1セッション最大3回。`input`はMindAR出力、`displayed`は描画アンカーの位置3値＋Quaternion4値。位置の単位はマーカー幅。映像・特徴点・端末センサー生データは含めません。
- `trackingInitMs`：カメラ映像の準備完了からAR準備完了まで。必要素材の取得とGPU準備を含みます。
- `totalStartupMs`：開始ボタンからAR準備完了まで。許可操作やライブラリ取得時間も含みます。
- `elapsedSeconds`：認識開始から停止までの連続動作時間。中断からの再開は新しいセッションです。
- `fpsAverage`／`fpsMin`：描画頻度。画像認識の頻度ではありません。
- `trials`：手動の計測開始から発見まで。カードを提示する操作時間を含み、10秒で未検出を記録します。
- `reason: interrupted`：正常な停止記録のない前回セッション。クラッシュと再読み込みは区別できません。

## 現段階の範囲

捜査メモ、ヒント演算、代表回答、正誤判定、PWAオフライン起動は次の段階です。0.1.1のiPad Air 2で1枚セットのカメラ起動・H01認識・おばけ表示を実機確認済みです。0.1.2で揺れが残ることを確認済みです。0.1.3の揺れ改善、4枚・9枚と10分耐久は実機で未確認です。

## 出典

- [MindAR 1.2.5 / MIT](https://github.com/hiukim/mind-ar-js/tree/v1.2.5)
- [MindARの導入](https://hiukim.github.io/mind-ar-js-doc/installation/)
- [画像ターゲットのコンパイル](https://hiukim.github.io/mind-ar-js-doc/quick-start/compile/)
- [Three.js / MIT](https://github.com/mrdoob/three.js/tree/r160)

マーカーと検証用GLBは本プロジェクトで作成したオリジナルの仮素材です。生成元とCC0指定を`assets/source/provenance.json`に記録しています。
