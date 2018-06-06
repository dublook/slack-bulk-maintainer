const { WebClient } = require('@slack/client')
const fs = require('fs');
const csvParse = require('csv-parse/lib/sync');

class SlackBulkMaintainer {
  constructor(token, dryRun, logger){
    this.webApi = new WebClient(token);
    this.dryRun = !!dryRun;
    this.makeDryRunMode();
    const summaryTemplate = {
      try: 0,
      skip: 0,
      success: 0,
      error: 0
    };
    this.summary = {
      profileSet: Object.assign({}, summaryTemplate),
      postMessage: Object.assign({}, summaryTemplate)
    }
    this.authUser = null;
    this.logger = logger || { log: () => undefined, error: () => undefined };
  }

  makeDryRunMode() {
    if (this.dryRun) {
      const dryRunResponse = Promise.resolve({
        ok: true,
        dryRun: true
      });
      this.webApi.users.profile.set = () => dryRunResponse;
      this.webApi.chat.postMessage = () => dryRunResponse;
    }
  }

  parseParamFromCsv(csvPath) {
    const csvRaw = fs.readFileSync(csvPath);
    const rows = csvParse(csvRaw, {
      skip_empty_line: true,
      columns: true
    });

    const csvParams = rows
      .map(row => {
        const updateBody = {
          profile: {}
        };
        Object.keys(row).forEach(k => {
          switch (k) {
            case 'user':
              updateBody.user = row['user'];
              break;
            case 'real_name':
            case 'display_name':
            case 'status_emoji':
            case 'status_text':
            case 'email':
              updateBody.profile[k] = row[k];
              break;
            default:
              break;
          }
        })
        return updateBody;
      });
    return csvParams;
  }

  updateProfilesFromCsv (csvPath, userList) {
    const webApiRequests = this.parseParamFromCsv(csvPath)
      .map((csvParam) => {
        return this.buildUpdateQuery(csvParam, userList);
      })
      .map((updateQuery) => {
        return this.updateProfileByQuery(updateQuery)
          .then(updateResponse => this.leaveUpdateProfileLog(updateResponse))
          .then(updateResponse => this.notifyUpdatedUser(updateResponse));
      });
    return Promise.all(webApiRequests);
  }

  async updateProfileByQuery(updateQuery) {
    this.summary.profileSet.try++;
    if (updateQuery.skipCallApi) {
      this.summary.profileSet.skip++;
      return {
        apiCallResponse: {},
        updateQuery: updateQuery
      };
    }
    try {
      const response = await this.webApi.users.profile.set(updateQuery.apiParam);
      this.summary.profileSet.success++;
      return {
        apiCallResponse: response,
        updateQuery: updateQuery
      }
    } catch (error) {
      // TODO switch handling based on error type
      this.summary.profileSet.error++;
      return {
        apiCallResponse: error,
        updateQuery: updateQuery
      }
    }
  }

  leaveUpdateProfileLog(updateResult) {
    const updateQuery = updateResult.updateQuery;
    const email = updateQuery.csvParam.profile.email;
    const apiCallResponse = updateResult.apiCallResponse;
    if (updateQuery.skipCallApi) {
      this.logger.log(`${email} の更新をスキップしました。` +
        `${updateResult.updateQuery.skipReasons[0].message}`);
    } else if (!apiCallResponse.ok) {
      this.logger.log(`${email} の更新時にエラーが発生しました, code=${apiCallResponse.code}, error=${apiCallResponse.data.error}`);
    } else if (apiCallResponse.ok) {
      this.logger.log(`${email} のプロフィールを更新しました, ${JSON.stringify(updateQuery.apiParam)}`);
    }
    return Promise.resolve(updateResult);
  }

  notifyUpdatedUser(updateResult) {
    const email = updateResult.updateQuery.csvParam.profile.email;

    if (updateResult.apiCallResponse
      && updateResult.apiCallResponse.ok) {
      this.summary.postMessage.try++;
      // TODO pass message part via parameter or something like that
      const attachments = Object.keys(updateResult.updateQuery.apiParam.profile)
        .map(updatedKey => {
          const newValue = updateResult.updateQuery.apiParam.profile[updatedKey];
          const oldValue = updateResult.updateQuery.currentUserInfo.profile[updatedKey];
          const fieldNameJa = {
            'real_name': '氏名',
            'display_name': '表示名'
          }
          let fieldName = fieldNameJa[updatedKey] || updatedKey;
          const attachment = {
              "color": '#81C784',
              "fields":[
                {
                  title: fieldName,
                  value: `変更前: ${oldValue}\n変更後: ${newValue}`,
                  "short":false
                }
              ]
            };
          return attachment;
        });
      attachments.push({
        "title": "Slackの運用改善に関する周知",
        'title_link': 'https://mediado.slack.com/archives/C03TWFV95/p1527578576000324'
      });
      attachments.push({
        "title": "Slack運用に関する問い合わせ（TODO)",
      })
      const message = {
        'channel': `${updateResult.updateQuery.apiParam.user}`,
        'text': '\n\n\n' +
          'おつかれさまです、MDHD情報システムチームです！\n' +
          'このメッセージは情シスチームが作成したプログラムから自動送信されています。\n\n\n' +
          '先日お知らせさせていただいたSlackの運用ルールに従った形で、Slackのユーザー名を自動更新させていただきました。\n' +
          '細心の注意を払ってプログラムを実行しましたが、もし間違いがあれば、お手数ですが、以下までお問合せください。\n' +
          '\n\n'+
          '今後も情シスチームでは「粘り強い調整での泥臭い問題解決」だけでなく、\nこのような「エンジニアリングでのスマートな問題解決」も' +
          '加え、両立していきたいと考えております。',
        'as_user': false,
        'attachments': attachments,
        'username': 'MDHD情報システムチーム',
        'icon_url':'https://slack-files2.s3-us-west-2.amazonaws.com/avatars/2016-04-18/35486615538_c9bc6670992704e477bd_88.png'
      };
      return this.webApi.chat.postMessage(message)
        .then(response => {
          this.summary.postMessage.success++;
          this.logger.log(`${email} に更新完了通知を送信しました`);
          updateResult.notification = {
            response: response,
            request: message
          };
          return Promise.resolve(updateResult)
        })
        .catch(error => {
          this.summary.postMessage.error++;
          this.logger.log(`${email} への更新完了通知送信時にエラーが発生しました`);
          // TODO switch handling based on error type
          updateResult.notification = {
            response: error,
            request: message
          };
          return Promise.resolve(updateResult)
        });
    } else {
      this.logger.log(`${email} のプロフィール更新が行なわれなかったため、通知未送信です`);
      updateResult.notification = {};
      return Promise.resolve(updateResult);
    }
  }

  fetchUserList() {
    return this.webApi.users.list();
  }

  fetchAuthUser() {
    return this.webApi.auth.test().then(authUser => {
      if (authUser.ok) {
        this.authUser = authUser;
        return Promise.resolve(authUser);
      } else {
        return Promise.reject(authUser);
      }
    });
  }

  findUserByMail(email, userList) {
    return userList.find(user => user.profile.email === email);
  }

  isAuthUser(userName) {
    return !!this.authUser && this.authUser.user === userName;
  }

  buildUpdateQuery(csvParam, userList) {
    const query = {
      skipCallApi: true,
      skipReasons: [],
      skippedColumns: [],
      currentUserInfo: null,
      csvParam: csvParam,
      apiParam: {
        user: null,
        profile: null
      }
    }
    const userInfo = this.findUserByMail(csvParam.profile.email, userList);
    if (!userInfo) {
      return Object.assign(query, {
        skipReasons: [{
          reason: 'no_user_found_for_email',
          message: '指定されたメールアドレスを持つSlackユーザーが見つかりませんでした'
        }]
      });
    } else if (!this.isAuthUser(userInfo.name) && userInfo.is_admin == true) {
      return Object.assign(query, {
        skipReasons: [{
          reason: 'admin_user_cannot_be_updated',
          message: '管理者ユーザーのプロフィールを更新することはできません'
        }],
        currentUserInfo: userInfo
      });
    }
    const apiParamProfile = {};
    const skippedColumns = [];

    Object.keys(csvParam.profile).forEach(k => {
      if (k === 'email') {
        // does not support email update
        return;
      }
      if (userInfo.profile[k] === csvParam.profile[k]) {
        skippedColumns.push({
          field: k,
          reason: 'same_with_exsiting'
        })
      } else {
        apiParamProfile[k] = csvParam.profile[k];
      }
    });

    if (Object.keys(apiParamProfile).length === 0) {
      return Object.assign(query, {
        skipReasons: [{
          reason: 'all_fields_are_updated',
          message: '全ての項目が更新済みだったので、更新APIの呼び出しをスキップしました'
        }],
        skippedColumns: skippedColumns,
        currentUserInfo: userInfo
      });
    }

    const callApiQuery = Object.assign(query, {
      skipCallApi: false,
      currentUserInfo: userInfo,
      skippedColumns: skippedColumns,
      apiParam: {
        user: userInfo.id,
        profile: apiParamProfile
      }
    });
    return callApiQuery;
}

}

module.exports = SlackBulkMaintainer;