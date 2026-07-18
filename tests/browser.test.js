// Tests for the browser proxy (Screen Wake Lock API) against a faked
// navigator.wakeLock and document. Node 21+ ships a global `navigator`, so the
// fakes are installed with defineProperty instead of plain assignment.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadBrowserProxy, proxyRegistrations, flushAsync } = require('./cordova-mock.js');

function installFakeEnvironment({ supported = true, failRequest = false } = {}) {
  const releaseListeners = [];
  const sentinel = {
    released: false,
    addEventListener(name, fn) {
      if (name === 'release') releaseListeners.push(fn);
    },
    release() {
      this.released = true;
      releaseListeners.forEach((fn) => fn());
      return Promise.resolve();
    },
    // Simulates the OS taking the lock away (tab hidden, battery saver).
    systemRelease() {
      this.released = true;
      releaseListeners.forEach((fn) => fn());
    }
  };

  const wakeLock = {
    requests: 0,
    request(type) {
      assert.equal(type, 'screen');
      this.requests += 1;
      if (failRequest) return Promise.reject(new Error('denied'));
      sentinel.released = false;
      return Promise.resolve(sentinel);
    }
  };

  const documentFake = {
    visibilityState: 'visible',
    listeners: {},
    addEventListener(name, fn) {
      (this.listeners[name] = this.listeners[name] || []).push(fn);
    },
    fire(name) {
      (this.listeners[name] || []).forEach((fn) => fn());
    }
  };

  Object.defineProperty(globalThis, 'navigator', {
    value: supported ? { wakeLock } : {},
    configurable: true,
    writable: true
  });
  Object.defineProperty(globalThis, 'document', {
    value: documentFake,
    configurable: true,
    writable: true
  });

  return { sentinel, wakeLock, documentFake };
}

function callbacks() {
  const result = { successes: 0, errors: [] };
  result.success = () => { result.successes += 1; };
  result.error = (message) => { result.errors.push(message); };
  return result;
}

test('registers all bridge actions with the exec proxy', () => {
  installFakeEnvironment();
  loadBrowserProxy();

  assert.equal(proxyRegistrations.length, 1);
  assert.equal(proxyRegistrations[0].service, 'InsomniaPlugin');
  for (const action of ['keepAwake', 'allowSleepAgain', 'isKeptAwake']) {
    assert.equal(typeof proxyRegistrations[0].impl[action], 'function', `missing action: ${action}`);
  }
});

test('keepAwake() acquires a screen wake lock and succeeds', async () => {
  const { wakeLock } = installFakeEnvironment();
  const proxy = loadBrowserProxy();
  const cb = callbacks();

  proxy.keepAwake(cb.success, cb.error);
  await flushAsync();

  assert.equal(wakeLock.requests, 1);
  assert.equal(cb.successes, 1);
  assert.deepEqual(cb.errors, []);
});

test('keepAwake() errors when the Wake Lock API is unavailable', async () => {
  installFakeEnvironment({ supported: false });
  const proxy = loadBrowserProxy();
  const cb = callbacks();

  proxy.keepAwake(cb.success, cb.error);
  await flushAsync();

  assert.equal(cb.successes, 0);
  assert.match(cb.errors[0], /not available/);
});

test('keepAwake() errors when the request is denied and stays inactive', async () => {
  installFakeEnvironment({ failRequest: true });
  const proxy = loadBrowserProxy();
  const cb = callbacks();

  proxy.keepAwake(cb.success, cb.error);
  await flushAsync();
  assert.match(cb.errors[0], /denied/);

  let state;
  proxy.isKeptAwake((value) => { state = value; });
  assert.equal(state, 0);
});

test('allowSleepAgain() releases the held lock', async () => {
  const { sentinel } = installFakeEnvironment();
  const proxy = loadBrowserProxy();
  const cb = callbacks();

  proxy.keepAwake(cb.success, cb.error);
  await flushAsync();

  proxy.allowSleepAgain(cb.success, cb.error);
  await flushAsync();

  assert.equal(sentinel.released, true);
  assert.equal(cb.successes, 2);
});

test('allowSleepAgain() succeeds even when nothing is held', async () => {
  installFakeEnvironment();
  const proxy = loadBrowserProxy();
  const cb = callbacks();

  proxy.allowSleepAgain(cb.success, cb.error);
  await flushAsync();
  assert.equal(cb.successes, 1);
});

test('isKeptAwake() tracks the requested state', async () => {
  installFakeEnvironment();
  const proxy = loadBrowserProxy();
  const states = [];

  proxy.isKeptAwake((value) => states.push(value));
  proxy.keepAwake(() => {}, () => {});
  await flushAsync();
  proxy.isKeptAwake((value) => states.push(value));
  proxy.allowSleepAgain(() => {}, () => {});
  await flushAsync();
  proxy.isKeptAwake((value) => states.push(value));

  assert.deepEqual(states, [0, 1, 0]);
});

test('the lock is re-acquired on visibilitychange while active', async () => {
  const { sentinel, wakeLock, documentFake } = installFakeEnvironment();
  const proxy = loadBrowserProxy();

  proxy.keepAwake(() => {}, () => {});
  await flushAsync();
  assert.equal(wakeLock.requests, 1);

  // The OS drops the lock when the tab is hidden…
  sentinel.systemRelease();
  // …and the page becomes visible again.
  documentFake.fire('visibilitychange');
  await flushAsync();

  assert.equal(wakeLock.requests, 2);
});

test('no re-acquire on visibilitychange after allowSleepAgain()', async () => {
  const { sentinel, wakeLock, documentFake } = installFakeEnvironment();
  const proxy = loadBrowserProxy();

  proxy.keepAwake(() => {}, () => {});
  await flushAsync();
  proxy.allowSleepAgain(() => {}, () => {});
  await flushAsync();

  sentinel.systemRelease();
  documentFake.fire('visibilitychange');
  await flushAsync();

  assert.equal(wakeLock.requests, 1);
});
