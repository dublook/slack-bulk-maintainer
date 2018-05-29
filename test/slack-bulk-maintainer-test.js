import test from 'ava'
import SlackBulkMaintainer from '../slack-bulk-maintainer.js'

test('Maintainer hold slack token', t => {
  t.plan(1);
  const maintainer = new SlackBulkMaintainer('dummy-token');
  t.is(maintainer.token, 'dummy-token');
});