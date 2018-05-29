import SlackBulkMaintainer from '../slack-bulk-maintainer.js'

((slackToken, csvFilePath) => {
  const maintainer = new SlackBulkMaintainer(slackToken);
  maintainer.updateProfilesFromCsv(csvFilePath);
})(process.env.SLACK_TOKEN, process.argv[2])