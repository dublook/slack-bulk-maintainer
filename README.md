# slack-bulk-maintainer
[![Build Status](https://travis-ci.com/dublook/slack-bulk-maintainer.svg?branch=master)](https://travis-ci.com/dublook/slack-bulk-maintainer)

企業においてSlackを利用する時に便利な一括更新などの機能を提供する

## 機能
- CSVファイルで指定された表示名などのプロフィール情報にしたがって、Slackのプロフィール情報を更新する
- 更新されたユーザーに通知する (@slackbot宛てに届く)
- CSVの内容と同じ場合は、更新・通知をスキップする
- dry-runオプションが標準でONになっており、副作用がある操作をする前に十分な検証ができる

## 通知イメージ
![](https://i.imgur.com/OWcqOX8.png)

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
"email","status_emoji","real_name","display_name"
"suzuki-ichiro1@example.com",":zany_face:","鈴木 一郎","Suzuki Ichiro"
```

一行目はヘッダーであり、 [Slackのプロファイル更新API](https://api.slack.com/methods/users.profile.set) で定義されている項目名と対応しています。

Excelなどから、同一フォーマットのCSVを作成し、 `update-profiles.csv` のような名前で保存してください。

### プロフィール一括更新スクリプトの実行
#### legacy tokenを環境変数にセット
tokenはスクリプト上に残さないように、環境変数経由で渡します
```
$ export SLACK_TOKEN=xoxp...... # 最初に取得したlegacy token
```

#### helpを確認
指定可能なオプションの情報が出てくるので、確認しておいてください。
```
$ node index.js -h
Usage: index.js [options]

        --help, -h
                Displays help information about this script
                'index.js -h' or 'index.js --help'

        --dry-run
                [default: true] No POST method of Slack API will not be executed. To disable dry-run mode, specify "--dry-run=false" option expressly.
                'node index.js update-profile.csv --dry-run=false'

        --save-full-log
                [Optional] Save all update log with file name "log/{timestamp}.log
                'node index.js update-profile.csv --save-full-log'
```

#### dry-runで実行
このスクリプトでは、
- ユーザーのプロフィール情報の書き換え
- 書き換えられたユーザーへの通知

を行います。そのため、安易に実行して、意図しない結果を生むことを避ける必要があります。
そのため、dry-runオプションが用意されています。デフォルトではONになっています。
dry-runが有効な場合、書き換えと通知は実際には行われません。
しかし、ログは本番同様に出力されるため、どのような変更がなされるかを事前確認することが可能です。
dry-runでログを確認し、csvファイルに間違いがないかなどを慎重にチェックしてください。
詳細なログの確認のため、 `--save-full-log` を指定するのが良いでしょう。

```
$ node index.js ./update-profiles.csv --save-full-log # 保存した場所に応じて、CSVファイルはパスは適宜書き換えてください
[DRY RUN] taro@example.com の更新をスキップしました。全ての項目が更新済みだったので、更新APIの呼び出しをスキップしました
[DRY RUN] foobar@example.com の更新をスキップしました。指定されたメールアドレスを持つSlackユーザーが見つかりませんでした
[DRY RUN] kanako@example.com のプロフィールを更新しました, {"user":"XXXX","profile":{"real_name":"高橋かなこ","display_name":"Kanako Takahashi"}}
[DRY RUN] kanako@example.com に更新完了通知を送信しました
[DRY RUN] See full log in log/1527780900741.log
```

#### 本番モードでの実行
繰り返しになりますが、dry-runモードで意図した変更・通知がなされることを事前に確認してから実行してください。
`--dry-run=false` オプションを明示的につけることで、本番モードでの実行、つまり、実際にSlackのプロフィールの更新、ユーザーへの通知が行われます。
```
$ node index.js ./update-profiles.csv --save-full-log　--dry-run=false
=============== YOU ARE IN PRODUCTION MODE ===============
This is NOT dry-run mode. Slack POST methods will be called.
log continue......
```
