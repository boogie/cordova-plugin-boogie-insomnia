// cordova-plugin-boogie-insomnia — JS bridge to the native keep-awake plugin.
//
// Exposes a small Promise-based global `boogieInsomnia`. While keep-awake is active
// the native side re-asserts it every time the app returns to the foreground, so
// external UI (camera, photo picker) can't silently undo it.

var exec = require('cordova/exec');
var SERVICE = 'InsomniaPlugin';

function callNative(action) {
  return new Promise(function (resolve, reject) {
    exec(resolve, reject, SERVICE, action, []);
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
  }
};
