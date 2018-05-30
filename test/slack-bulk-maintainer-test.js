import test from 'ava'
import fs from 'fs'
import SlackBulkMaintainer from '../slack-bulk-maintainer.js'

const { WebClient } = require('@slack/client')

global.td = require('testdouble')

test.beforeEach(t => {

})

test.afterEach(t => {
  td.reset()
})

test('Maintainer hold slack token', async t => {
  t.plan(1);
  const maintainer = new SlackBulkMaintainer('dummy-token');
  t.is(maintainer.webApi.token, 'dummy-token');
});

test('Update slack users profiles', async t => {
  t.plan(3); // FIXME include td assertions

  const maintainer = new SlackBulkMaintainer('dummy-token');

  td.replace(maintainer.webApi.users.profile, 'set');
  const profileSet = maintainer.webApi.users.profile.set;
  td.when(profileSet(td.matchers.anything()))
    .thenResolve({ok: true});

  const filePath = 'test/resoures/update-profiles.csv';
  const responses = await maintainer.updateProfilesFromCsv(filePath)

  t.is(responses.length, 2);
  t.is(responses[0].ok, true);
  t.is(responses[1].ok, true);

  // const explain = td.explain(maintainer.webApi.users.profile.set);
  // console.log(JSON.stringify(explain));
  /* FIXME
  td.verify(profileSet({
    'user': 'user1',
    'profile': {
      'status_emoji': ':sunglasses:'
    }
  }));
  td.verify(profileSet({
    'user': 'user2',
    'profile': {
      'status_emoji': ':sleepy:'
    }
  }));
  */
});

test('Fetch user list', async t => {
  t.plan(2); // FIXME include td assertions

  const maintainer = new SlackBulkMaintainer('dummy-token');
  td.replace(maintainer.webApi.users, 'list');
  const list = maintainer.webApi.users.list;
  td.when(list()).thenResolve(dummyUserList());

  const response = await maintainer.fetchUserList();

  t.is(response.ok, true);
  t.is(response.members.length, 4);
  // FIXME td.verify(list());
});

test('Find user info by email', t => {
  const maintainer = new SlackBulkMaintainer('dummy-token');
  const user = maintainer.findUserByMail('jiro@example.com', dummyUserList().members);
  t.is(user.id, 'USERID2');
});

function dummyUserList() {
  const fileContent = fs.readFileSync('test/resoures/user-list.json', 'utf8');
  return JSON.parse(fileContent);
}