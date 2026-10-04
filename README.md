# SHIORI

Codex を使って旅のしおりを作り、GitHub Pages で共有するためのツールです。管理画面はローカルで動き、公開されるのは生成した静的なしおりのみです。

## 使い方

必要なもの: Node.js 20 以上、認証済みの Codex CLI、Git / GitHub へのプッシュ権限。

```bash
npm start
```

ブラウザで <http://127.0.0.1:4173> を開きます。

1. 左の「新しい旅を作成」でタイトルを入力します。
2. 日程、行き・帰りの交通手段、旅の TODO、モデルと推論の深さを入力します。モデルを空欄にすると Codex CLI の既定設定が使われます。
3. 「しおりを作成」でローカルの Codex CLI が [`skills/shiori/SKILL.md`](skills/shiori/SKILL.md) を読み、日別タイムラインを作成します。入力データは `.shiori/projects.json` に保存され、Git の対象外です。
4. 生成後のプレビューを確認します。公開してよい内容であれば「GitHub Pages に公開」を押します。この操作は生成した HTML をコミットして `main` にプッシュします。
5. Pages の反映後、画面の URL からしおりを開きます。

生成時は Codex のライブ検索で往復と旅先の交通時刻表を調べ、すべての行程に具体的な時刻を提案します。入力済みの時刻は変更せず、時刻表を確認できた時刻と計画上の提案時刻を区別します。定期交通の時刻表リンクは各移動のタイムライン項目に載せます。旅行前に公式の時刻表と予約内容を再確認してください。

## GitHub Pages の初期設定

最初にこのリポジトリのコードを `main` にプッシュし、GitHub の **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。[`pages.yml`](.github/workflows/pages.yml) が `docs/` を公開します。公開 URL は通常 `https://takatakatakata.github.io/travel-itinerary/` です。公開反映には時間がかかることがあります。
初回プッシュ時に Pages がまだ無効だった場合は、設定後に **Actions → Deploy SHIORI to GitHub Pages → Run workflow** を実行してください。

GitHub Pages は静的ファイルの公開機能です。そのため、入力・Codex 生成・プロジェクト管理は Pages 上では動かず、このローカル管理画面で行います。生成されたページは `docs/trips/<プロジェクトID>/index.html` に作られます。

## 公開範囲と個人情報

通常の公開 Pages は、URL を知っているかどうかに関係なく、インターネットからアクセスできます。`noindex` は検索エンジンへの依頼であり、アクセス制限ではありません。宿泊先、行動予定、予約リンクなどの公開に注意してください。予約番号、氏名、電話番号などは入力しないか、公開前のプレビューで除いてください。

GitHub Free では Pages の公開元に public リポジトリが必要です。GitHub Pro などでは private リポジトリから Pages を公開できる場合がありますが、**リポジトリが private でも公開サイトが自動的に非公開になるわけではありません**。アクセス制限付き Pages は、GitHub Enterprise Cloud の組織所有プロジェクトなど、条件を満たす場合に利用できます。個人旅行の詳細を非公開で共有したい場合は、Pages 以外の認証付きホスティングを検討してください。

参考: [GitHub Pages の概要](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[Pages サイトの可視性](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)

## 開発

```bash
npm test
```

HTML は [`lib.js`](lib.js) でエスケープして作成します。外部 URL は `http:` または `https:` のみリンクにします。生成済みの公開サイトを削除すると、該当 HTML の削除コミットを `main` にプッシュします。
