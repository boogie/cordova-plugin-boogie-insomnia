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
