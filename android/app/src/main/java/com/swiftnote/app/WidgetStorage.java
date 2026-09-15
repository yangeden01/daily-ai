package com.swiftnote.app;

import android.content.Context;
import android.content.SharedPreferences;

public class WidgetStorage {
    private static final String PREF_NAME = "swiftnote_widget_prefs";
    private static final String KEY_SNAPSHOT_JSON = "snapshot_json";
    private static final String KEY_LAST_UPDATE_TIME = "last_update_time";

    private static SharedPreferences getPrefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
    }

    public static void saveSnapshot(Context context, String snapshotJson) {
        getPrefs(context).edit().putString(KEY_SNAPSHOT_JSON, snapshotJson).apply();
    }

    public static String getSnapshot(Context context) {
        return getPrefs(context).getString(KEY_SNAPSHOT_JSON, null);
    }

    public static void saveLastUpdateTime(Context context, String timeStr) {
        getPrefs(context).edit().putString(KEY_LAST_UPDATE_TIME, timeStr).apply();
    }

    public static String getLastUpdateTime(Context context) {
        return getPrefs(context).getString(KEY_LAST_UPDATE_TIME, null);
    }
}
