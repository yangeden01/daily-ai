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

    private static final String KEY_COLLAPSED_PREFIX = "section_collapsed_";

    public static boolean isSectionCollapsed(Context context, int sectionType) {
        return getPrefs(context).getBoolean(KEY_COLLAPSED_PREFIX + sectionType, false);
    }

    public static void setSectionCollapsed(Context context, int sectionType, boolean collapsed) {
        getPrefs(context).edit().putBoolean(KEY_COLLAPSED_PREFIX + sectionType, collapsed).apply();
    }

    public static boolean toggleSectionCollapsed(Context context, int sectionType) {
        boolean nextState = !isSectionCollapsed(context, sectionType);
        setSectionCollapsed(context, sectionType, nextState);
        return nextState;
    }

    private static final String KEY_FONT_SIZE_LEVEL = "font_size_level";
    public static final int FONT_SIZE_SMALL = 0;
    public static final int FONT_SIZE_MEDIUM = 1;
    public static final int FONT_SIZE_LARGE = 2;
    public static final int FONT_SIZE_EXTRA_LARGE = 3;

    public static int getFontSizeLevel(Context context) {
        return getPrefs(context).getInt(KEY_FONT_SIZE_LEVEL, FONT_SIZE_MEDIUM);
    }

    public static void setFontSizeLevel(Context context, int level) {
        if (level < FONT_SIZE_SMALL) level = FONT_SIZE_SMALL;
        if (level > FONT_SIZE_EXTRA_LARGE) level = FONT_SIZE_EXTRA_LARGE;
        getPrefs(context).edit().putInt(KEY_FONT_SIZE_LEVEL, level).apply();
    }

    public static int cycleFontSizeLevel(Context context) {
        int current = getFontSizeLevel(context);
        int next = (current + 1) % 4;
        setFontSizeLevel(context, next);
        return next;
    }

    public static int adjustFontSizeLevel(Context context, int delta) {
        int current = getFontSizeLevel(context);
        int next = Math.max(FONT_SIZE_SMALL, Math.min(FONT_SIZE_EXTRA_LARGE, current + delta));
        setFontSizeLevel(context, next);
        return next;
    }

    public static String getFontSizeLabel(int level) {
        switch (level) {
            case FONT_SIZE_SMALL:
                return "字體:小";
            case FONT_SIZE_LARGE:
                return "字體:大";
            case FONT_SIZE_EXTRA_LARGE:
                return "字體:特大";
            case FONT_SIZE_MEDIUM:
            default:
                return "字體:中";
        }
    }
}
