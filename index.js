const SlackBulkMaintainer = require('./slack-bulk-maintainer.js');
const argv = require('argv');
require('dotenv').config();

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
  const dryRun = !(options['dry-run'] === false);
  const saveFullLog = !!options['save-full-log'];

  const logger = provideLogger(dryRun);
  if (!slackToken || slackToken.length === 0) {
    logger.error('slack token cannot be empty.');
    logger.error('Set env variable like "export SLACK_TOKEN=xxxx" in bash.');
    return;
  }

  try {
    await cliPrologue(dryRun, logger);
    const maintainer = new SlackBulkMaintainer(slackToken, dryRun, logger);
    const authUser = await maintainer.fetchAuthUser();
    logger.log(`Executed with legacy token of user ${authUser.user}`);
    const userList = await maintainer.fetchUserList();
    const updateResult = await maintainer.updateProfilesFromCsv(csvFilePath, userList.members);
    leaveResultLog(maintainer, saveFullLog, updateResult, logger);
  } catch (error) {
    logger.error(error);
  }
})(process.env.SLACK_TOKEN, args.targets[0], args.options)

function leaveResultLog(maintainer, saveFullLog, updateResult, logger) {
  logger.log(maintainer.summary);
  if (saveFullLog) {
    const dryRun = maintainer.dryRun;
    logger.log('Try to save full log');
    const logContent = JSON.stringify(updateResult, null, 2);
    const logDir = `log/${Date.now()}.log`;
    require('fs').writeFileSync(logDir, logContent);
    logger.log(`See full log in ${logDir}`);
  }
}

function cliPrologue(dryRun, logger) {
  if (dryRun) {
    logger.log('dry-run mode is ON. No slack POST method will be called. '
      + 'To disable dry-run mode, specify "--dry-run=false" option expressly.');
    return Promise.resolve();
  } else {
    const waitSecs = 5;
    logger.log('=============== YOU ARE IN PRODUCTION MODE ===============');
    logger.log('This is NOT dry-run mode. Slack POST methods will be called.');
    logger.log(`Update will be began in ${waitSecs} sec. Type Ctrl-C to cancel.`);
    logger.log();
    return countdown(waitSecs)
      .then(() => logger.log('Update process has just begun.'));
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

function provideLogger(dryRun) {
  if (dryRun) {
    const prefix = '[DRY RUN]';
    return {
      log: (content) => console.log(prefix, content),
      error: (content) => console.error(prefix, content),
      dryRun: true
    }
  } else {
    return {
      log: console.log,
      error: console.error,
      dryRun: false
    }
  }
}
