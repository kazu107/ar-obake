# GitHub Pagesへの移行

このアプリはViteの静的ビルドで動作します。`vite.config.ts`の`base: './'`により、GitHub PagesのプロジェクトURL `https://kazu107.github.io/ar-obake/` でも、HTML、AR用iframe、マーカー、PDF、Service Workerのパスを同じサイト内で解決します。ソースの公開先は[`kazu107/ar-obake`](https://github.com/kazu107/ar-obake)です。

## 公開と実機確認

リポジトリはPublicで作成済みで、**Settings → Pages → Build and deployment → Source** は **GitHub Actions** に設定済みです。`.github/workflows/pages.yml`が`main`へのpush時に検証、ビルド、公開を実行します。

**Actions**で`Publish GitHub Pages`が成功したら、`https://kazu107.github.io/ar-obake/`をiPadのSafariで開きます。カメラを許可し、TUTORIALとH01を読み取ってください。Safariの「ホーム画面に追加」は新しいURLでやり直します。

## 移行時の注意

- GitHub PagesのURLはHTTPSなので、Safariのカメラ使用に必要な安全な接続になります。既存の`kazu107.github.io`リポジトリには手を加えず、今回のアプリは`/ar-obake/`に公開します。
- GitHub Pagesは公開サイトです。参加者がログインなしで使える一方、アプリ内のヒントや答えも配信されます。Publicリポジトリではソースコードや履歴も公開されます。
- Safariでは配信元が変わるため、旧サイトのカメラ許可、オフラインキャッシュ、ホーム画面アイコンは引き継がれません。通信がある状態で新URLを開き、スタッフ画面で「オフライン準備」を行ってください。カメラ映像が出てからWi-Fiを切る運用は同じです。
- 旧Sitesの非公開URLは、この移行準備だけでは消えません。GitHub PagesのiPad確認後に旧URLの扱いを決められます。
- このリポジトリの`.openai/hosting.json`は旧SitesのプロジェクトIDを含みますが、認証情報は含みません。GitHub Pagesのワークフローはこのファイルを使いません。

## ローカルでの確認

```powershell
npm ci
npm run check:assets
npm run check:mission
npm test
npm run build
```

生成された`dist/`だけがPagesへ公開されます。マーカーPDFは`/print.html`からダウンロードできます。公開後は新URLでのiPad実機確認を受け入れ条件とします。
