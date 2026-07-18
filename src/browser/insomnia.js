// cordova-plugin-boogie-insomnia — browser implementation on the Screen Wake Lock
// API. The OS releases the lock every time the page is hidden, so while keep-awake
// is active the proxy re-acquires it on visibilitychange. Requires a secure
// context (HTTPS or localhost).

var active = false; // what the app asked for
var sentinel = null; // the currently held WakeLockSentinel, if any
var listening = false;

function wakeLock() {
  return (typeof navigator !== 'undefined' && navigator.wakeLock) || null;
}

function acquire() {
  return wakeLock().request('screen').then(function (lock) {
    sentinel = lock;
    // The OS fires this when it takes the lock away (tab hidden, battery saver).
    lock.addEventListener('release', function () {
      if (sentinel === lock) sentinel = null;
    });
  });
}

function ensureVisibilityListener() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', function () {
    if (active && !sentinel && document.visibilityState === 'visible') {
      acquire().catch(function () {}); // best-effort; keepAwake reported support already
    }
  });
}

module.exports = {
  keepAwake: function (success, error) {
    if (!wakeLock()) {
      error('boogieInsomnia: the Screen Wake Lock API is not available in this browser (secure context required)');
      return;
    }
    active = true;
    ensureVisibilityListener();
    acquire().then(function () {
      success();
    }, function (err) {
      active = false;
      error('boogieInsomnia: wake lock request failed: ' + ((err && err.message) || err));
    });
  },

  allowSleepAgain: function (success) {
    active = false;
    var held = sentinel;
    sentinel = null;
    if (held) {
      held.release().then(success, success);
    } else {
      success();
    }
  },

  isKeptAwake: function (success) {
    success(active ? 1 : 0);
  }
};

require('cordova/exec/proxy').add('InsomniaPlugin', module.exports);
