# slack-bulk-maintainer
[![Build Status](https://travis-ci.com/dublook/slack-bulk-maintainer.svg?branch=master)](https://travis-ci.com/dublook/slack-bulk-maintainer)

企業においてSlackを利用する時に便利な一括更新などの機能を提供する

## 使い方
### SlackのLegacy tokenを取得
SlackのAPIを実行するため、Legacy tokenを使用しています。取得には管理者の許可が必要になります。

https://api.slack.com/custom-integrations/legacy-tokens

### node.js準備
node.jsの環境が必要になります。
初期開発時の環境は以下の通りです。
ない場合は、 [この辺り](https://qiita.com/akakuro43/items/600e7e4695588ab2958d) を読みながら、同じ環境を作ってください。
```
$ node -v
v10.2.0
$ npm -v
6.1.0
```

説明不親切でごめんなさい！あとWindowsではまた違うセットアップになると思います。

### プロジェクトのセットアップ
node.jsのセットアップが完了したら、このプロジェクト自体が動くようにします。

```
$ git clone https://github.com/dublook/slack-bulk-maintainer
$ cd slack-bulk-maintainer
$ npm install
```

### CSVファイルの準備
ダウンロードされてきた中に `update-profiles.csv.sample` というファイルがあります。このツールでは、「表示名は『田中太郎』にする」のような内容をCSVファイルにあらかじめ書いておきます。ExcelやGoogle Spreadsheetなどに社員一覧があり、そこからCSVに変換して作るであろう、という想定です。

その内容に基づいて、SlackのAPIを経由して実際にプロフィールの更新を行います。


```
"user","status_emoji","real_name","display_name"
"UA06SS3R7",":zany_face:","鈴木 一郎","Suzuki Ichiro"
```

一行目はヘッダーであり、 [Slackのプロファイル更新API](https://api.slack.com/methods/users.profile.set) で定義されている項目名と対応しています。

Excelなどから、同一フォーマットのCSVを作成し、 `update-profiles.csv` のような名前で保存してください。

### スクリプトの実行
```
$ export SLACK_TOKEN=xoxp...... # 最初に取得したlegacy tokenを環境変数にセット
$ node index.js ./update-profiles-md.csv # 保存した場所に応じて、CSVファイルはパスは適宜書き換えてください
```