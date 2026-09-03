'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadPlugin, calls } = require('./cordova-mock.js');

const SERVICE = 'InsomniaPlugin';

test('keepAwake() calls the native side and resolves', async () => {
  const insomnia = loadPlugin();
  const promise = insomnia.keepAwake();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, SERVICE);
  assert.equal(calls[0].action, 'keepAwake');
  assert.deepEqual(calls[0].args, []);

  calls[0].success();
  assert.equal(await promise, undefined);
});

test('keepAwake() rejects on native error', async () => {
  const insomnia = loadPlugin();
  const promise = insomnia.keepAwake();
  calls[0].error('InsomniaPlugin: no activity');
  await assert.rejects(promise, /no activity/);
});

test('allowSleepAgain() calls the native side and resolves', async () => {
  const insomnia = loadPlugin();
  const promise = insomnia.allowSleepAgain();

  assert.equal(calls[0].action, 'allowSleepAgain');
  assert.deepEqual(calls[0].args, []);

  calls[0].success();
  await promise;
});

test('isKeptAwake() coerces the native result to boolean', async () => {
  const insomnia = loadPlugin();

  const awakePromise = insomnia.isKeptAwake();
  assert.equal(calls[0].action, 'isKeptAwake');
  calls[0].success(1);
  assert.equal(await awakePromise, true);

  const asleepPromise = insomnia.isKeptAwake();
  calls[1].success(0);
  assert.equal(await asleepPromise, false);

  const boolPromise = insomnia.isKeptAwake();
  calls[2].success(true);
  assert.equal(await boolPromise, true);
});

test('repeated keepAwake() calls each reach the native side', async () => {
  const insomnia = loadPlugin();
  insomnia.keepAwake();
  insomnia.keepAwake();
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.action === 'keepAwake'));
});

// ---- Bridge contract v1: describe + raw exec --------------------------------

// Resolves to the rejection reason (fails the test if the promise resolves).
function rejectionOf(promise) {
  return promise.then(() => assert.fail('expected a rejection'), (err) => err);
}

test('ID, VERSION and SERVICE are read-only constants on the global', () => {
  const insomnia = loadPlugin();
  assert.equal(insomnia.ID, 'cordova-plugin-boogie-insomnia');
  assert.equal(insomnia.SERVICE, SERVICE);
  assert.match(insomnia.VERSION, /^\d+\.\d+\.\d+$/);

  const version = insomnia.VERSION;
  assert.throws(() => { insomnia.VERSION = '0.0.0'; }, TypeError);
  assert.equal(insomnia.VERSION, version);
});

test('describe() calls the native describe and resolves the envelope', async () => {
  const insomnia = loadPlugin();
  const promise = insomnia.describe();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, SERVICE);
  assert.equal(calls[0].action, 'describe');
  assert.deepEqual(calls[0].args, []);

  const envelope = {
    id: insomnia.ID,
    version: insomnia.VERSION,
    platform: 'android',
    api: 1,
    actions: ['allowSleepAgain', 'describe', 'isKeptAwake', 'keepAwake'],
    features: { reassertOnResume: true }
  };
  calls[0].success(envelope);
  const described = await promise;

  assert.deepEqual(described, envelope);
  assert.deepEqual(Object.keys(described).sort(), ['actions', 'api', 'features', 'id', 'platform', 'version']);
  assert.ok(described.actions.includes('describe'));
});

test('exec() passes action and args through untouched and resolves with the result', async () => {
  const insomnia = loadPlugin();
  const args = [1, 'two', { three: 3 }];
  const promise = insomnia.exec('futureAction', args);

  assert.equal(calls[0].service, SERVICE);
  assert.equal(calls[0].action, 'futureAction');
  assert.equal(calls[0].args, args);

  calls[0].success({ ok: true });
  assert.deepEqual(await promise, { ok: true });
});

test('exec() defaults missing args to an empty array', () => {
  const insomnia = loadPlugin();
  insomnia.exec('futureAction');
  assert.deepEqual(calls[0].args, []);
});

test('exec() rejects with an Error carrying the raw native payload', async () => {
  const insomnia = loadPlugin();

  const fromString = insomnia.exec('x');
  calls[0].error('InsomniaPlugin: no activity');
  const e1 = await rejectionOf(fromString);
  assert.ok(e1 instanceof Error);
  assert.equal(e1.message, 'InsomniaPlugin: no activity');
  assert.equal(e1.native, 'InsomniaPlugin: no activity');

  const fromMessageObject = insomnia.exec('x');
  const payload = { code: 3, message: 'denied' };
  calls[1].error(payload);
  const e2 = await rejectionOf(fromMessageObject);
  assert.equal(e2.message, 'denied');
  assert.equal(e2.native, payload);

  const fromPlainObject = insomnia.exec('x');
  calls[2].error({ code: 7 });
  const e3 = await rejectionOf(fromPlainObject);
  assert.equal(e3.message, '{"code":7}');
  assert.deepEqual(e3.native, { code: 7 });

  const fromNothing = insomnia.exec('x');
  calls[3].error();
  const e4 = await rejectionOf(fromNothing);
  assert.ok(e4 instanceof Error);
  assert.equal(e4.native, undefined);
});

test('exec() streams every native result to onProgress and resolves with the first', async () => {
  const insomnia = loadPlugin();
  const seen = [];
  const promise = insomnia.exec('stream', [], (result) => seen.push(result));

  calls[0].success('a');
  calls[0].success('b');
  calls[0].success('c');

  assert.equal(await promise, 'a');
  assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('exec() without onProgress ignores results after the first', async () => {
  const insomnia = loadPlugin();
  const promise = insomnia.exec('stream');
  calls[0].success('first');
  calls[0].success('second');
  assert.equal(await promise, 'first');
});
