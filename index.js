const SlackBulkMaintainer = require('./slack-bulk-maintainer.js');
const argv = require('argv');

const args = (function() {
  argv.option({
    name: 'dry-run',
    type: 'boolean',
    description: '[Optional] No POST method of Slack API will not be executed.',
    example: "'node index.js update-profile.csv --dry-run'"
  });
  return argv.run();
})();

(function (slackToken, csvFilePath, dryRun) {
  if (!slackToken || slackToken.length === 0) {
    console.error('slack token cannot be empty.');
    return;
  }
  const maintainer = new SlackBulkMaintainer(slackToken, dryRun);
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
})(process.env.SLACK_TOKEN, args.targets[0], !!args.options['dry-run'])