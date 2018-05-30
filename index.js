const SlackBulkMaintainer = require('./slack-bulk-maintainer.js');

(function (slackToken, csvFilePath) {
  if (!slackToken || slackToken.length === 0) {
    console.error('slack token cannot be empty.');
    return;
  }
  const maintainer = new SlackBulkMaintainer(slackToken);
  maintainer.fetchUserList().then(userList => {
    return maintainer.updateProfilesFromCsv(csvFilePath, userList.members)
      .then(res => {
        console.log(JSON.stringify(res, null, 2));
        return res;
      });
  })
  .catch(error => {
    console.error(JSON.stringify(error, null, 2));
  })
})(process.env.SLACK_TOKEN, process.argv[2])