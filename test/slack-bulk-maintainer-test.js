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
  t.plan(6);

  const maintainer = new SlackBulkMaintainer('dummy-token');

  td.replace(maintainer.webApi.users.profile, 'set');
  const profileSet = maintainer.webApi.users.profile.set;
  const profileSetExplain = td.explain(profileSet);
  td.when(profileSet(td.matchers.anything()))
    .thenResolve({ok: true});

  const filePath = 'test/resoures/update-profiles.csv';
  const responses = await maintainer.updateProfilesFromCsv(filePath)

  t.is(responses.length, 2);
  t.is(responses[0].ok, true);
  t.is(responses[1].ok, true);

  
  t.is(profileSetExplain.calls.length, 2);
  t.deepEqual(profileSetExplain.calls[0].args, [{
    'user': 'user1',
    'profile': {
      'status_emoji': ':sunglasses:'
    }
  }]);
  t.deepEqual(profileSetExplain.calls[1].args, [{
    'user': 'user2',
    'profile': {
      'status_emoji': ':sleepy:'
    }
  }]);
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

test('Build update query', t => {
  t.plan(6);

  const maintainer = new SlackBulkMaintainer('dummy-token');
  const csvParam = {
    profile: {
      email: 'jiro@example.com',
      real_name: '田中 二郎',
      display_name: 'JIRO-T'
    }
  }
  const query = maintainer.buildUpdateQuery(csvParam, dummyUserList().members);
  t.is(query.skipCallApi, false);
  t.is(query.apiParam.user, 'USERID2');
  t.is(query.apiParam.profile.display_name, 'JIRO-T');
  t.is(query.apiParam.profile.real_name, undefined); // skiped
  t.deepEqual(query.skippedColumns, [{
    field: 'real_name',
    reason: 'same_with_exsiting'
  }]);
  t.not(query.currentUserInfo, null);
});

test('Build update query for admin user, it will be skipped', t => {
  t.plan(6);

  const maintainer = new SlackBulkMaintainer('dummy-token');
  const csvParam = {
    profile: {
      email: 'suzuki-ichiro1@example.com',
      display_name: 'ICHIRO'
    }
  }
  const query = maintainer.buildUpdateQuery(csvParam, dummyUserList().members);
  t.is(query.skipCallApi, true);
  t.deepEqual(query.skipReasons, [{
    reason: 'admin_user_cannot_be_updated',
    message: '管理者ユーザーのプロフィールを更新することはできません'
  }]);
  t.is(query.apiParam.user, null);
  t.is(query.apiParam.profile, null);
  t.deepEqual(query.skippedColumns, []);
  t.not(query.currentUserInfo, null);
});

test('Build update query for admin user, skipped due to all columns are updated', t => {
  t.plan(6);

  const maintainer = new SlackBulkMaintainer('dummy-token');
  const csvParam = {
    profile: {
      email: 'jiro@example.com',
      real_name: '田中 二郎',
      display_name: 'JIRO'
    }
  }
  const query = maintainer.buildUpdateQuery(csvParam, dummyUserList().members);
  t.is(query.skipCallApi, true);
  t.deepEqual(query.skipReasons, [{
    reason: 'all_fields_are_updated',
    message: '全ての項目が更新済みだったので、更新APIの呼び出しをスキップしました'
  }]);
  t.is(query.apiParam.user, null);
  t.is(query.apiParam.profile, null);
  t.deepEqual(query.skippedColumns, [{
    field: 'real_name',
    reason: 'same_with_exsiting'
  }, {
    field: 'display_name',
    reason: 'same_with_exsiting'
  }]);
  t.not(query.currentUserInfo, null);
});

test('Build update query for admin user, skipped due to no user found for email', t => {
  t.plan(6);

  const maintainer = new SlackBulkMaintainer('dummy-token');
  const csvParam = {
    profile: {
      email: 'noone@example.com',
      display_name: '名無し'
    }
  }
  const query = maintainer.buildUpdateQuery(csvParam, dummyUserList().members);
  t.is(query.skipCallApi, true);
  t.deepEqual(query.skipReasons, [{
    reason: 'no_user_found_for_email',
    message: '指定されたメールアドレスを持つSlackユーザーが見つかりませんでした'
  }]);
  t.is(query.apiParam.user, null);
  t.is(query.apiParam.profile, null);
  t.deepEqual(query.skippedColumns, []);
  t.is(query.currentUserInfo, null);
});

test('Parse update param from CSV', t => {
  t.plan(3);
  const maintainer = new SlackBulkMaintainer('dummy-token');
  const filePath = 'test/resoures/update-profiles.csv';
  const csvParams = maintainer.parseParamFromCsv(filePath);

  t.is(csvParams.length, 2);
  let i = 0;
  t.deepEqual(csvParams[i++].profile, {
    status_emoji: ':sunglasses:',
    email: 'user1@example.com'
  });
  t.deepEqual(csvParams[i++].profile, {
    status_emoji: ':sleepy:',
    email: 'user2@example.com'
  })
});

function dummyUserList() {
  const fileContent = fs.readFileSync('test/resoures/user-list.json', 'utf8');
  return JSON.parse(fileContent);
}