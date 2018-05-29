const SlackBulkMaintainer = require('./slack-bulk-maintainer.js');

(function (slackToken, csvFilePath) {
  const maintainer = new SlackBulkMaintainer(slackToken);
  maintainer.updateProfilesFromCsv(csvFilePath)
    .then(console.log)
    .catch(error => {
      console.log('Error occurs on slack web API call');
      console.log(error);
    });
})(process.env.SLACK_TOKEN, process.argv[2])