package hu.barthazi.insomnia;

import android.app.Activity;
import android.view.WindowManager;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Arrays;

public class InsomniaPlugin extends CordovaPlugin {

  private static final String PLUGIN_ID = "cordova-plugin-boogie-insomnia";
  private static final String VERSION = "1.1.0"; // keep in sync with plugin.xml
  // Every action execute() dispatches, sorted — describe() reports this list.
  private static final String[] ACTIONS = { "allowSleepAgain", "describe", "isKeptAwake", "keepAwake" };

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

      case "describe":
        return describe(callbackContext);

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

  // Bridge contract v1: what this native half is and can do, from static facts
  // only — no permissions, no I/O, never fails.
  private boolean describe(CallbackContext callbackContext) {
    JSONObject envelope = new JSONObject();
    try {
      envelope.put("id", PLUGIN_ID);
      envelope.put("version", VERSION);
      envelope.put("platform", "android");
      envelope.put("api", 1);
      envelope.put("actions", new JSONArray(Arrays.asList(ACTIONS)));
      JSONObject features = new JSONObject();
      features.put("reassertOnResume", true); // onResume() re-applies FLAG_KEEP_SCREEN_ON
      envelope.put("features", features);
    } catch (JSONException e) {
      // Unreachable with these value types; whatever was built is still returned.
    }
    callbackContext.success(envelope);
    return true;
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
