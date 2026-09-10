# Safariのカメラ開始修正（0.1.1）

2026-09-10。iPad Air 2 / iPadOS 15.8.8 と申告された端末の検証記録を調査。

## 観測

0.1.0の8試行すべてがAR準備前に終了。AbortErrorが5回、NotAllowedErrorが3回で、映像寸法・AR準備完了は未記録。利用者はカメラを許可し、サイト設定を「許可」に変更して許可画面が出なくなっても停止することを確認した。

旧コードはgetUserMediaとvideo.playの両方が成功するまでカメラ開始を記録していなかった。この記録だけでは各試行のエラーがカメラ取得か映像再生のどちらで起きたか断定できない。端末の生ログはリポジトリに含めない。

## 修正

- DOMに接続したvideoに、muted・playsinlineなどを先に設定する。
- 映像の寸法が確定するまで待機してからplayを呼ぶ。autoplayで再生済みなら重ねて呼ばない。
- playのAbortErrorを1回再試行し、引き続き中断・再生制限がある場合は同じiframe内の「映像を表示」ボタンで直接再生する。getUserMediaを繰り返さず、許可済みのストリームを維持する。
- 準備待ちの中止・時間切れでカメラを解放。開始失敗は「カメラを開始できませんでした」と表示する。
- 取得・許可・接続・寸法・再生の段階と、各セッションのアプリ版を記録する。iframeにも版を付ける。

Safari 15.6ではMediaStreamの接続直後のplayに関するAbortError報告がある。ただし、今回の全試行と同じ原因だと確認されたわけではない。

- [WebKit Bug 243519](https://bugs.webkit.org/show_bug.cgi?id=243519)
- [WebKit: New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)

## 確認範囲

単体テストでは準備完了前のplay抑止、自動再生、AbortError再試行、再生制限後のタップ、権限拒否との区別、中止・遅延許可・時間切れの解放を検証する。Chromiumでは再生エラーを注入し、画面の復帰と実際のMindAR起動を検証する。試験結果はbrowser-error-test-results.jsonを参照。

追記：0.1.1のiPad実機でカメラ起動・H01認識・おばけ表示が成功したと利用者から報告され、JSONでも起動・認識を確認済み。残るモデルの揺れは[0.1.2の記録](tracking-stability-0.1.2.md)を参照。

当初の再試験手順：Safariを再読み込みし、アプリ0.1.1で「1枚 / 640 × 480」を試す。「映像を表示」があれば押す。失敗が続く場合は新しいJSONで停止段階を確認する。
