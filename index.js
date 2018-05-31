const SlackBulkMaintainer = require('./slack-bulk-maintainer.js');
const argv = require('argv');

const args = (function() {
  argv.option({
    name: 'dry-run',
    type: 'boolean',
    description: '[default: true] No POST method of Slack API will not be executed. '
      + 'To disable dry-run mode, specify "--dry-run=false" option expressly.',
    example: "'node index.js update-profile.csv --dry-run=false'"
  });
  argv.option({
    name: 'save-full-log',
    type: 'boolean',
    description: '[Optional] Save all update log with file name "log/{timestamp}.log',
    example: "'node index.js update-profile.csv --save-full-log'"
  });
  return argv.run();
})();

(function (slackToken, csvFilePath, options) {
  if (!slackToken || slackToken.length === 0) {
    console.error('slack token cannot be empty.');
    return;
  }
  const dryRun = !(options['dry-run'] === false);
  if (dryRun) {
    console.log('[DRY RUN] dry-run mode is ON. No slack POST method will be called. '
      + 'To disable dry-run mode, specify "--dry-run=false" option expressly.');
  } else {
    console.log('=============== YOU ARE IN PRODUCTION MODE ===============');
    console.log('This is NOT dry-run mode. Slack POST methods will be called.');
  }
  const saveFullLog = !!options['save-full-log'];
  const maintainer = new SlackBulkMaintainer(slackToken, dryRun);
  maintainer.fetchUserList().then(userList => {
    return maintainer.updateProfilesFromCsv(csvFilePath, userList.members)
      .then(res => {
        console.log(maintainer.summary);
        if (saveFullLog) {
          console.log(`${dryRun?'[DRY RUN] ':''}Try to save full log`);
          const logContent = JSON.stringify(res, null, 2);
          const logDir = `log/${Date.now()}.log`;
          require('fs').writeFileSync(logDir, logContent);
          console.log(`${dryRun?'[DRY RUN] ':''}See full log in ${logDir}`);
        }
        return res;
      });
  })
  .catch(error => {
    console.error('Some error happens');
    console.log(maintainer.summary);
    console.error(JSON.stringify(error, null, 2));
  })
})(process.env.SLACK_TOKEN, args.targets[0], args.options)