// Consistency checks between plugin.xml, package.json, the JS bridge, and the
// native sources — the things that silently break a Cordova plugin when they
// drift apart.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pluginXml = fs.readFileSync(path.join(root, 'plugin.xml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bridgeJs = fs.readFileSync(path.join(root, 'www', 'insomnia.js'), 'utf8');

const pluginTag = pluginXml.match(/<plugin\b([^>]*)>/)[1];
const pluginId = pluginTag.match(/\bid="([^"]+)"/)[1];
const pluginVersion = pluginTag.match(/\bversion="([^"]+)"/)[1];

test('plugin id matches package.json name and cordova id', () => {
  assert.equal(pluginId, pkg.name);
  assert.equal(pluginId, pkg.cordova.id);
});

test('plugin.xml and package.json versions match', () => {
  assert.equal(pluginVersion, pkg.version);
});

test('plugin.xml platforms match package.json cordova platforms', () => {
  const platforms = [...pluginXml.matchAll(/<platform name="([^"]+)">/g)].map((m) => m[1]);
  assert.deepEqual(platforms.sort(), [...pkg.cordova.platforms].sort());
});

test('every file referenced by plugin.xml exists', () => {
  const refs = [...pluginXml.matchAll(/<(?:js-module|source-file|header-file)\s[^>]*src="([^"]+)"/g)]
    .map((m) => m[1]);
  assert.ok(refs.length >= 5, `expected at least 5 file references, got ${refs.length}`);
  for (const ref of refs) {
    assert.ok(fs.existsSync(path.join(root, ref)), `missing file referenced by plugin.xml: ${ref}`);
  }
});

test('native feature names match the SERVICE used by the JS bridge', () => {
  const service = bridgeJs.match(/var SERVICE = '([^']+)'/)[1];
  const features = [...pluginXml.matchAll(/<feature name="([^"]+)">/g)].map((m) => m[1]);
  assert.equal(features.length, 2, 'expected one <feature> per native platform');
  for (const feature of features) {
    assert.equal(feature, service);
  }
});

test('the browser proxy registers under the same SERVICE name', () => {
  const service = bridgeJs.match(/var SERVICE = '([^']+)'/)[1];
  const browserJs = fs.readFileSync(path.join(root, 'src', 'browser', 'insomnia.js'), 'utf8');
  assert.equal(browserJs.match(/proxy'\)\.add\('([^']+)'/)[1], service);
});

test('the JS module clobbers the boogieInsomnia global', () => {
  assert.equal(pluginXml.match(/<clobbers target="([^"]+)"/)[1], 'boogieInsomnia');
});

test('every platform implements the actions the JS bridge calls', () => {
  const java = fs.readFileSync(path.join(root, 'src', 'android', 'InsomniaPlugin.java'), 'utf8');
  const objc = fs.readFileSync(path.join(root, 'src', 'ios', 'InsomniaPlugin.m'), 'utf8');
  const browser = fs.readFileSync(path.join(root, 'src', 'browser', 'insomnia.js'), 'utf8');

  const actions = [...bridgeJs.matchAll(/callNative\('(\w+)'/g)].map((m) => m[1]);
  assert.ok(actions.includes('keepAwake') && actions.includes('allowSleepAgain'), 'sanity: actions extracted');

  for (const action of actions) {
    assert.ok(java.includes(`case "${action}"`), `Android is missing action: ${action}`);
    assert.ok(objc.includes(`- (void)${action}:`), `iOS is missing action: ${action}`);
    assert.ok(browser.includes(`${action}:`), `browser proxy is missing action: ${action}`);
  }
});

test('index.d.ts declares every bridge method', () => {
  const dts = fs.readFileSync(path.join(root, 'index.d.ts'), 'utf8');
  const methods = [...bridgeJs.matchAll(/^  (\w+): function/gm)].map((m) => m[1]);
  assert.ok(methods.length >= 3, 'sanity: methods extracted');
  for (const method of methods) {
    assert.ok(dts.includes(`${method}(`), `index.d.ts is missing: ${method}`);
  }
  assert.ok(dts.includes('declare var boogieInsomnia'), 'index.d.ts must declare the global');
});

// ---- Bridge contract v1: describe + raw exec --------------------------------
// The same invariants every boogie* plugin keeps: one version literal that agrees
// with plugin.xml wherever it lives, "describe" dispatched on every platform, and
// the action list describe reports equal to what that platform really dispatches.

const javaSrc = fs.readFileSync(path.join(root, 'src', 'android', 'InsomniaPlugin.java'), 'utf8');
const objcSrc = fs.readFileSync(path.join(root, 'src', 'ios', 'InsomniaPlugin.m'), 'utf8');
const objcHeader = fs.readFileSync(path.join(root, 'src', 'ios', 'InsomniaPlugin.h'), 'utf8');
const browserJs = fs.readFileSync(path.join(root, 'src', 'browser', 'insomnia.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

test('the version literal agrees with plugin.xml everywhere it lives', () => {
  const literals = {
    'www/insomnia.js': bridgeJs.match(/var VERSION = '([^']+)'/)[1],
    'src/browser/insomnia.js': browserJs.match(/var VERSION = '([^']+)'/)[1],
    'src/android/InsomniaPlugin.java': javaSrc.match(/String VERSION = "([^"]+)"/)[1],
    'src/ios/InsomniaPlugin.m': objcSrc.match(/kInsomniaPluginVersion = @"([^"]+)"/)[1],
    'README.md': readme.match(/"version": "([^"]+)"/)[1]
  };
  for (const [file, version] of Object.entries(literals)) {
    assert.equal(version, pluginVersion, `${file} states ${version}, plugin.xml says ${pluginVersion}`);
  }
});

test('the ID literal agrees with plugin.xml everywhere it lives', () => {
  assert.equal(bridgeJs.match(/var ID = '([^']+)'/)[1], pluginId);
  assert.equal(browserJs.match(/var ID = '([^']+)'/)[1], pluginId);
  assert.equal(javaSrc.match(/String PLUGIN_ID = "([^"]+)"/)[1], pluginId);
  assert.equal(objcSrc.match(/kInsomniaPluginId = @"([^"]+)"/)[1], pluginId);
});

test('"describe" is dispatched on every platform', () => {
  assert.ok(javaSrc.includes('case "describe"'), 'Android is missing describe');
  assert.ok(objcSrc.includes('- (void)describe:(CDVInvokedUrlCommand'), 'iOS is missing describe');
  assert.ok(objcHeader.includes('- (void)describe:(CDVInvokedUrlCommand'), 'iOS header is missing describe');
  assert.ok(/^  describe: function/m.test(browserJs), 'browser proxy is missing describe');
});

test('each platform reports exactly the actions it dispatches, sorted', () => {
  const sorted = (list) => [...list].sort();

  const javaDispatched = [...javaSrc.matchAll(/case "(\w+)":/g)].map((m) => m[1]);
  const javaReported = [...javaSrc.match(/String\[\] ACTIONS = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(javaReported, sorted(javaDispatched), 'Android ACTIONS drifted from execute()');

  const objcDispatched = [...objcSrc.matchAll(/^- \(void\)(\w+):\(CDVInvokedUrlCommand/gm)].map((m) => m[1]);
  const objcReported = [...objcSrc.match(/@"actions": @\[([^\]]*)\]/)[1].matchAll(/@"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(objcReported, sorted(objcDispatched), 'iOS actions drifted from the selectors');

  const browserDispatched = [...browserJs.matchAll(/^  (\w+): function/gm)].map((m) => m[1]);
  const browserReported = [...browserJs.match(/actions: \[([^\]]*)\]/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(browserReported, sorted(browserDispatched), 'browser actions drifted from the proxy');

  for (const list of [javaReported, objcReported, browserReported]) {
    assert.ok(list.includes('describe'));
  }
});

test('exec() forwards its action verbatim — exempt from the closed action set', () => {
  // The named methods go through callNative('literal'), which the platform check
  // above enforces; the raw passthrough must reach cordova.exec with the caller's
  // action untouched and args defaulting to [].
  assert.match(bridgeJs, /SERVICE, action, args \|\| \[\]\)/);
  assert.ok(!/callNative\('describe'\)/.test(bridgeJs), 'describe() should use the raw path');
});
