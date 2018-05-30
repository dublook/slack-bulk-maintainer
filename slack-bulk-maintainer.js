const { WebClient } = require('@slack/client')
const fs = require('fs');
const csvParse = require('csv-parse/lib/sync');

function SlackBulkMaintainer(token) {
  this.webApi = new WebClient(token)
}

SlackBulkMaintainer.prototype.updateProfilesFromCsv = function (csvPath) {
  const csvRaw = fs.readFileSync(csvPath);
  const rows = csvParse(csvRaw, {
    skip_empty_line: true,
    columns: true
  });

  const webApiRequests = rows
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
            updateBody.profile[k] = row[k];
            break;
          default:
            break;
        }
      })
      return updateBody;
    })
    .map(updateBody => {
      return this.webApi.users.profile.set(updateBody);
    });
  return Promise.all(webApiRequests);
}

SlackBulkMaintainer.prototype.fetchUserList = function() {
  return this.webApi.users.list();
}

SlackBulkMaintainer.prototype.findUserByMail = function(email, userList) {
  return userList.find(user => user.profile.email === email);
}

SlackBulkMaintainer.prototype.buildUpdateQuery = function(csvParam, userList) {
  const query = {
    skipCallApi: true,
    skipReasons: [],
    skippedColumns: [],
    currentUserInfo: null,
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
  } else if (userInfo.is_admin == true) {
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

module.exports = SlackBulkMaintainer;