// cordova-plugin-boogie-insomnia — JS bridge to the native keep-awake plugin.
//
// Exposes a small Promise-based global `boogieInsomnia`. While keep-awake is active
// the native side re-asserts it every time the app returns to the foreground, so
// external UI (camera, photo picker) can't silently undo it.

var exec = require('cordova/exec');
var ID = 'cordova-plugin-boogie-insomnia';
var VERSION = '1.1.0'; // keep in sync with plugin.xml (the structure test checks)
var SERVICE = 'InsomniaPlugin';

function callNative(action) {
  return new Promise(function (resolve, reject) {
    exec(resolve, reject, SERVICE, action, []);
  });
}

// Wraps whatever the native side reported in an Error; the raw payload stays on
// error.native.
function nativeError(err) {
  var message = typeof err === 'string' ? err
    : (err && typeof err.message === 'string') ? err.message
    : JSON.stringify(err);
  var error = new Error(message === undefined ? String(err) : message);
  error.native = err;
  return error;
}

// Raw passthrough to cordova.exec — no argument normalisation, no bookkeeping. With
// an onProgress function every native success callback is forwarded to it
// (keepCallback streams); the Promise resolves with the first result either way.
function execRaw(action, args, onProgress) {
  return new Promise(function (resolve, reject) {
    var first = true;
    exec(function (result) {
      if (typeof onProgress === 'function') onProgress(result);
      if (first) {
        first = false;
        resolve(result);
      }
    }, function (err) {
      reject(nativeError(err));
    }, SERVICE, action, args || []);
  });
}

module.exports = {
  // Keep the screen on until allowSleepAgain() (or a page reload). Idempotent.
  keepAwake: function () {
    return callNative('keepAwake');
  },

  // Let the screen sleep on its normal schedule again. Idempotent.
  allowSleepAgain: function () {
    return callNative('allowSleepAgain');
  },

  // Resolves whether keep-awake is currently requested.
  isKeptAwake: function () {
    return callNative('isKeptAwake').then(function (value) {
      return !!value;
    });
  },

  // Resolves what the native half is and can do: { id, version, platform, api,
  // actions, features }. Cheap and side-effect free; never rejects natively.
  describe: function () {
    return execRaw('describe', []);
  },

  // Escape hatch: reach a native action this bridge does not expose. The bridge
  // ships frozen with the native half, so app code updated over the air may know
  // actions this file does not. Bypasses every check above.
  exec: function (action, args, onProgress) {
    return execRaw(action, args, onProgress);
  }
};

// Bridge identity — read-only, so app code can't accidentally re-point the bridge.
Object.defineProperties(module.exports, {
  ID: { value: ID, enumerable: true },
  VERSION: { value: VERSION, enumerable: true },
  SERVICE: { value: SERVICE, enumerable: true }
});
