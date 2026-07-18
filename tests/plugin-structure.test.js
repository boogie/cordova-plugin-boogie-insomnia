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
