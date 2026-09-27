# ARおばけ探偵団：チュートリアル＋9枚ゲーム

0.7.0で全10枚をハロウィン仕様のマーカーへ更新したWebARゲームです。カボチャ、コウモリ、おばけ、クモの巣などを使いながら、色とアイテムから「青い帽子」を推理するゲーム内容、スタッフ画面、オフライン準備は維持しています。

- [実装計画](docs/implementation-plan.md)
- [実機試験の記録表](docs/air2-test-checklist.md)
- [実装と検証の状況](docs/phase-0-1-status.md)
- 配信URL：https://ar-obake-lab.kazu107.chatgpt.site

## ゲームで遊ぶ

トップページから開始し、最初にTUTORIALを映して読み取りを練習します。その後、H01〜H08をしばらく映すと、おばけと3D吹き出しが現れ、ヒントが自動でメモに入ります。探索中はカメラを全面表示し、色とアイテムの小さいメモだけを下部へ重ねます。「相談する」→代表者がANSWERを読む→色・アイテムを回答します。誤答は再回答でき、メモは各iPad内に保存します。

- [9枚ミッションの設計・検証・確認手順](docs/nine-mission-0.3.0.md)
- [自動記録・AR吹き出しの実装と確認手順](docs/auto-record-ar-speech-0.4.0.md)
- [全画面AR・3D吹き出し・チュートリアルの実装と確認手順](docs/fullscreen-tutorial-0.5.0.md)
- [色・アイテム更新／スタッフ運用／オフラインの確認手順](docs/staff-offline-0.6.0.md)
- [利用者向け両面マーカーPDF](docs/duplex-marker-pdf-0.6.2.md)
- [ハロウィンマーカー0.7.0](docs/halloween-markers-0.7.0.md)
- [4枚試作の記録](docs/game-prototype-0.2.0.md)
- チュートリアル＋9枚ゲーム：トップページ
- 4枚ゲーム：`/?mission=practice`（従来のメモを保持）
- カメラの検証：`lab.html`（旧トップページ。既存の記録は保持）
- スタッフ画面：`/?staff=1`（進行確認、オフライン準備、次グループへのリセット）

## カメラを検証する

検証画面 `lab.html` をSafariで開き、マーカー印刷ページからH01を印刷して「1枚」「カメラを開始」で試します。Sitesの非公開配信では所有者のChatGPTサインインが必要です。参加者用の公開配信・ログイン不要化はまだ行っていません。

アプリ0.1.5では静止を検出して姿勢を保持し、持続する動きを検出すると追従へ戻ります。小さな動きは抑えられ、動き始めに遅れがあります。おばけ自身のアニメーションは独立して切り替えられます。「揺れを抑える（静止保持）」「静止」で試し、「奥行き補正（0.1.4）」と同じ解像度で比較できます。「揺れを10秒記録」のJSONに保持状態も保存します。白い紙のような表示になる場合は、手順ページのSafariリーダーの説明を確認してください。

0.1.1で修正したSafariの映像準備待ち・中断時の再試行も継続しています。「映像を表示」が出た場合は押してください。更新後はSafariを再読み込みして画面下部の版を確認します。

画面の「実機テストの手順」に開始、計測、4枚・9枚・10枚、復帰、記録の保存方法を記載しています。

## ローカル開発

検証した実行環境はNode.js 24.19.0、npm 11.6.1。`.node-version`を用意しています。

```powershell
npm ci
npm run dev
npm run build
npm test
npm run check:assets
npm run check:mission
npm run preview
```

このPCにある古いNode.js 24.11.0では、大きい依存を含むbuildがWindowsネイティブ例外で終了しました。Codexの同梱Node.js 24.19.0では成功しています。Windowsでは同梱版を選ぶ次の補助スクリプトも使えます。

```powershell
.\scripts\run.ps1 dev
.\scripts\run.ps1 build
.\scripts\run.ps1 test
.\scripts\run.ps1 check:mission
```

実機からPCのlocalhostを開くことはできません。iPadでは配信済みのHTTPS URLを使います。

## 構成

- `src/game/`：Mission検証、ヒント演算、メモ、認識待機、相談・回答の画面。
- `src/storage/game-storage.ts`：端末内のゲーム保存・検証。
- `public/missions/main.json`：8ヒント＋ANSWERのMission。
- `public/missions/prototype.json`：4枚の試作用Mission。
- `src/game/balance.ts`：全256通りの取得集合を分析する開発用の問題検証。

- `src/main.ts`：検証画面、認識イベント、ログ、手動計測、JSON出力。
- `src/ar/stationary-pose-stabilizer.ts`：観測窓で静止を判定し、外れ値を除き、持続する動きで保持を解除。
- `src/ar/projected-pose-stabilizer.ts`：画面中心と対数奥行きを独立に補正し、投影上の中心を保って3D位置を再構成。
- `src/ar/pose-stabilizer.ts`：マーカー幅で正規化した位置、Quaternion回転の小変動抑制と時間ベースの描画補間。
- `src/lab/pose-recording.ts`：数値の姿勢記録の形式と件数・値の検証。
- `src/ar/tracking-config.ts`：MindAR内蔵フィルターの安定化・従来設定と、おばけの動きの比較条件。
- `src/ar/camera-preview.ts`：カメラ取得と映像再生を分離し、準備待ち・再試行・タップ再生を処理。
- `src/ar/frame.ts`：MindAR Controller＋Three.js、カメラ、投影行列、GLB表示。
- `ar.html`：AR処理専用の同一オリジンiframe。停止するとiframe全体を破棄し、カメラ・Worker・TensorFlow・WebGLの寿命をまとめて管理します。
- `src/data/sets.ts`：1枚・4枚・9枚・10枚の対応。
- `src/lab/measurements.ts`：計測の成功・未検出・中止・別マーカー検出。
- `public/targets/manifest.json`：画像ID・ハッシュ・コンパイル順。
- `public/markers.pdf`：160mm角、A4両面用20ページの全10枚PDF。奇数ページがマーカー、偶数ページが対応する案内面。
- `public/tutorial-marker.pdf`：既存9枚へ追加できるA4両面用2ページのTUTORIAL単独PDF。
- `public/guide.html`：端末から読める実機手順。

9枚版のメモは`ar-obake-game-v1:obake-mission-01`、4枚版は従来の`ar-obake-game-v1`へ保存し、それぞれ独立して復元・リセットします。

同時追跡は1枚、描画のpixelRatioは1、影なし、単一の約44KBのGLBを共有します。カメラ解像度は要求値と実際の値を分けて記録します。Safari 15を対象にビルドし、import mapや外部CDNを実行時に使いません。

## 素材の再生成

```powershell
npm run assets
npx playwright install chromium
npm run compile:targets
python scripts/print-markers.py
npm run check:assets
```

PDF生成にはreportlabが必要です。Windowsの游ゴシックがある場合はサブセットを埋め込みます。`scripts/print-markers.py`は配布用PDFを`output/pdf/`へ生成し、同じ内容を公開用の`public/`へコピーします。画像生成は`@napi-rs/canvas`、GLBはThree.jsのGLTFExporterを使います。

マーカーは固定seedで生成する非対称なハロウィン柄です。カボチャ、コウモリ、おばけ、クモの巣、キャンディ、三日月、墓石、星を組み合わせます。H01〜H08、ANSWER、TUTORIALの認識順を維持し、1枚・4枚・9枚・10枚のセットを生成します。4枚セットのANSWERはindex 3、9枚セットではindex 8、10枚セットのTUTORIALはindex 9です。素材の編集後は.mindとPDFも作り直してください。

ブラウザ用のMindAR配布物を利用します。MindARが依存する開発用`canvas`は`@napi-rs/canvas`へのnpm overrideで置き換えています。アプリではNode用canvasを読み込みません。依存のinstall scriptは実行せず、lockfileを固定しています。esbuildは修正済み0.28.1へ固定しています。

## ゲームの確認

開発サーバー5173で `/?simulate=1` を開くと、カメラなしで認識を再現できます。操作部は本番ビルドに含めません。

```powershell
node scripts/nine-game-browser.mjs
node scripts/game-browser.mjs
node scripts/game-real-ar.mjs
node scripts/offline-browser.mjs
```

先頭2つは開発サーバー5173で9枚版・4枚版を確認します。`game-real-ar.mjs`はproduction preview 4173で実際のMindAR処理を確認し、`--practice`を付けると4枚版を確認します。`offline-browser.mjs`は準備後に通信を切って再読み込みします。

## ブラウザ試験

production buildのpreviewをポート4173で起動してから実行します。

```powershell
npm run test:browser
node scripts/browser-errors.mjs
```

これはChromiumに合成映像をカメラ入力として渡し、実際のMindARが1枚・4枚・9枚・10枚の各IDを認識できるかを試す自動確認です。計測用のモデル出力や認識成功イベントを捏造していません。SwiftShaderを使うため、速度はAir 2の性能評価には使えません。中間のY4M・画像・書き出し記録はGit対象外の`.artifacts/`に保存します。

## 記録の読み方

`localStorage`には直近10セッションを保存し、JSONへ書き出せます。映像や静止画は保存・送信しません。

- セッションの`appVersion`／`lastStartupStage`：その試行のアプリ版と最後に通過した開始段階。0.1.0の過去記録にはありません。
- `events`の`開始確認`：カメラ要求、許可取得、映像接続、映像寸法確定、再生・再試行の経過。映像やデバイスIDは含めません。
- `tracking`：試行の追従モード、実際のフィルター設定、おばけのアニメーション設定。0.1.2以降で記録。
- `poseRecordings`：手動の10秒記録。1回最大110点、1セッション最大3回。`stabilizationState`は0.1.5の保持・追従状態。`input`はMindAR出力、`displayed`は描画アンカーの位置3値＋Quaternion4値。位置の単位はマーカー幅。映像・特徴点・端末センサー生データは含めません。
- `trackingInitMs`：カメラ映像の準備完了からAR準備完了まで。必要素材の取得とGPU準備を含みます。
- `totalStartupMs`：開始ボタンからAR準備完了まで。許可操作やライブラリ取得時間も含みます。
- `elapsedSeconds`：認識開始から停止までの連続動作時間。中断からの再開は新しいセッションです。
- `fpsAverage`／`fpsMin`：描画頻度。画像認識の頻度ではありません。
- `trials`：手動の計測開始から発見まで。カードを提示する操作時間を含み、10秒で未検出を記録します。
- `reason: interrupted`：正常な停止記録のない前回セッション。クラッシュと再読み込みは区別できません。

## 姿勢記録の再生比較

`node scripts/replay-pose-recording.mjs INPUT_JSON`で、保存した姿勢を旧方式と新方式で再生し、集計値だけを`docs/depth-replay-summary.json`に出力します。元ログや姿勢列を配信・Git保存しません。間引かれた中間の認識更新を復元できないため、実機の見え方の確認とは区別します。

## 現段階の範囲

0.1.5の揺れ改善・9種類の読み取り、0.2.0の4枚ゲーム、0.3.0の9枚ゲームを利用者が実機確認し、受け入れ済みです。0.3.0ではH01〜H08から正解までの通し操作、H04を除いた7枚での正解、再読み込み後のメモ復元まで確認しています。答えの一意性と取り逃しは全256通りを検証し、どの1枚を取り逃しても残り7枚で解け、6枚では28通り中24通りで一意になります。

0.5.0まで利用者がiPadで確認し、複数台の会場リハーサルも問題なしと報告済みです。0.6.0でMission v2、スタッフ画面、確認付きリセット、PWAとオフライン準備を実装しました。2026-09-21、オンラインでカメラ映像を開始してからWi-Fiを切る手順はiPad実機で問題なしと報告されています。0.7.0のハロウィンマーカーはPCの実際のMindAR処理で検証し、iPad実機では未確認です。タイトル画面からの完全オフラインAR起動、最終3D素材と実物アイテムとの整合、読取時間の反復測定も未完了です。

## 出典

- [MindAR 1.2.5 / MIT](https://github.com/hiukim/mind-ar-js/tree/v1.2.5)
- [MindARの導入](https://hiukim.github.io/mind-ar-js-doc/installation/)
- [画像ターゲットのコンパイル](https://hiukim.github.io/mind-ar-js-doc/quick-start/compile/)
- [Three.js / MIT](https://github.com/mrdoob/three.js/tree/r160)

ハロウィンマーカーと検証用GLBは本プロジェクトで作成したオリジナル素材です。生成元とCC0指定を`assets/source/provenance.json`に記録しています。
