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

module.exports = SlackBulkMaintainer;