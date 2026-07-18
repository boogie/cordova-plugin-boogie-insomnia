package hu.barthazi.insomnia;

import android.app.Activity;
import android.view.WindowManager;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;

public class InsomniaPlugin extends CordovaPlugin {

  private boolean keepAwakeActive = false;

  @Override
  public boolean execute(String action, JSONArray args, CallbackContext callbackContext) {
    switch (action) {
      case "keepAwake":
        keepAwakeActive = true;
        return applyKeepScreenOn(true, callbackContext);

      case "allowSleepAgain":
        keepAwakeActive = false;
        return applyKeepScreenOn(false, callbackContext);

      case "isKeptAwake":
        callbackContext.success(keepAwakeActive ? 1 : 0);
        return true;

      default:
        return false;
    }
  }

  // External UI (camera, photo picker) can drop the keep-awake while it is in the
  // foreground — re-assert it whenever the app comes back.
  @Override
  public void onResume(boolean multitasking) {
    if (keepAwakeActive) {
      applyKeepScreenOn(true, null);
    }
  }

  // A page navigation destroys the JS state that requested the keep-awake; don't
  // leave the screen forced on with nothing tracking it.
  @Override
  public void onReset() {
    if (keepAwakeActive) {
      keepAwakeActive = false;
      applyKeepScreenOn(false, null);
    }
  }

  private boolean applyKeepScreenOn(final boolean on, final CallbackContext callbackContext) {
    final Activity activity = cordova.getActivity();
    if (activity == null) {
      if (callbackContext != null) {
        callbackContext.error("InsomniaPlugin: no activity");
      }
      return true;
    }
    activity.runOnUiThread(new Runnable() {
      public void run() {
        if (on) {
          activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
          activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        if (callbackContext != null) {
          callbackContext.success();
        }
      }
    });
    return true;
  }
}
