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

(async function (slackToken, csvFilePath, options) {
  if (!slackToken || slackToken.length === 0) {
    console.error('slack token cannot be empty.');
    console.error('Set env variable like "export SLACK_TOKEN=xxxx" in bash.');
    return;
  }
  const dryRun = !(options['dry-run'] === false);
  const saveFullLog = !!options['save-full-log'];

  try {
    const maintainer = await initialize(slackToken, dryRun);
    const authUser = await maintainer.fetchAuthUser();
    console.log(`${dryRun?'[DRY RUN] ':''}Executed with legacy token of user ${authUser.user}`);
    const userList = await maintainer.fetchUserList();
    const updateResult = await maintainer.updateProfilesFromCsv(csvFilePath, userList.members);
    console.log(maintainer.summary);
    if (saveFullLog) {
      console.log(`${dryRun?'[DRY RUN] ':''}Try to save full log`);
      const logContent = JSON.stringify(updateResult, null, 2);
      const logDir = `log/${Date.now()}.log`;
      require('fs').writeFileSync(logDir, logContent);
      console.log(`${dryRun?'[DRY RUN] ':''}See full log in ${logDir}`);
    }
  } catch (error) {
    console.error('Some error happens');
    console.log(maintainer.summary);
    console.error(JSON.stringify(error, null, 2));
  }
})(process.env.SLACK_TOKEN, args.targets[0], args.options)

function initialize(slackToken, dryRun) {
  const maintainer = new SlackBulkMaintainer(slackToken, dryRun);
  if (dryRun) {
    console.log('[DRY RUN] dry-run mode is ON. No slack POST method will be called. '
      + 'To disable dry-run mode, specify "--dry-run=false" option expressly.');
    return Promise.resolve(maintainer);
  } else {
    const waitSecs = 5;
    console.log('=============== YOU ARE IN PRODUCTION MODE ===============');
    console.log('This is NOT dry-run mode. Slack POST methods will be called.');
    console.log(`Update will be began in ${waitSecs} sec. Type Ctrl-C to cancel.`);
    console.log();
    return countdown(waitSecs)
      .then(() => console.log('Update process has just begun.'))
      .then(() => maintainer);
  }
}

function wait(waitSecs) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(waitSecs);
    }, waitSecs * 1000)
  });
}

function countdown(sec) {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  process.stdout.write(sec.toString());
  const nextSec = sec - 1;
  if (nextSec < 0) {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    return Promise.resolve(sec);
  } else {
    return wait(1).then(() => countdown(nextSec));
  }
}

