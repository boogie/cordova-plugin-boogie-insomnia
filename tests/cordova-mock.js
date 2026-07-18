// Test helper: intercepts require('cordova/exec') and require('cordova/exec/proxy')
// so the www/ bridge and the browser proxy can be unit tested under plain Node.
// Each recorded exec call exposes the success/error callbacks so tests can play the
// native side.
'use strict';

const Module = require('module');
const path = require('path');

const calls = [];
const proxyRegistrations = [];

function execMock(success, error, service, action, args) {
  calls.push({ success, error, service, action, args });
}

const execProxyMock = {
  add(service, impl) {
    proxyRegistrations.push({ service, impl });
  }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'cordova/exec') return execMock;
  if (request === 'cordova/exec/proxy') return execProxyMock;
  return originalLoad.apply(this, arguments);
};

const BRIDGE_PATH = path.join(__dirname, '..', 'www', 'insomnia.js');
const BROWSER_PATH = path.join(__dirname, '..', 'src', 'browser', 'insomnia.js');

// Returns a freshly loaded bridge module with an empty call log.
function loadPlugin() {
  delete require.cache[BRIDGE_PATH];
  calls.length = 0;
  return require(BRIDGE_PATH);
}

// Returns a freshly loaded browser proxy (module-level state reset by the reload).
function loadBrowserProxy() {
  delete require.cache[BROWSER_PATH];
  proxyRegistrations.length = 0;
  return require(BROWSER_PATH);
}

// Waits until promise reactions queued by the code under test have run.
function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = { loadPlugin, loadBrowserProxy, calls, proxyRegistrations, flushAsync };
