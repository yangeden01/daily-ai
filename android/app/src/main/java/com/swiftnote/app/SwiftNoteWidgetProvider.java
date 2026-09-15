package com.swiftnote.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class SwiftNoteWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_REFRESH_WIDGET = "com.swiftnote.app.ACTION_REFRESH_WIDGET";
    public static final String ACTION_TOGGLE_SECTION = "com.swiftnote.app.ACTION_TOGGLE_SECTION";
    public static final String ACTION_ADD_ITEM = "com.swiftnote.app.ACTION_ADD_ITEM";
    public static final String ACTION_OPEN_ITEM = "com.swiftnote.app.ACTION_OPEN_ITEM";

    public static final String EXTRA_SECTION_TYPE = "extra_section_type";
    public static final String EXTRA_ROUTE = "route";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        // 1. Handle toggle collapse/expand for a section
        if (ACTION_TOGGLE_SECTION.equals(action)) {
            int sectionType = intent.getIntExtra(EXTRA_SECTION_TYPE, 1);
            WidgetStorage.toggleSectionCollapsed(context, sectionType);
            updateAllWidgets(context);
            return;
        }

        // 2. Handle add item (+) button
        if (ACTION_ADD_ITEM.equals(action)) {
            int sectionType = intent.getIntExtra(EXTRA_SECTION_TYPE, 1);
            String route;
            if (sectionType == 1) {
                route = "/daily?mode=notes&action=new&category=%E5%BE%85%E5%81%9A%E4%BA%8B%E9%A0%85";
            } else if (sectionType == 2) {
                route = "/daily?mode=daily&action=new";
            } else {
                route = "/daily?mode=anniversary&action=new";
            }
            openAppWithRoute(context, route);
            return;
        }

        // 3. Handle opening item from list
        if (ACTION_OPEN_ITEM.equals(action)) {
            String route = intent.getStringExtra(EXTRA_ROUTE);
            if (route != null && !route.isEmpty()) {
                openAppWithRoute(context, route);
            }
            return;
        }

        // 4. Handle refresh and system clock/timezone changes
        if (ACTION_REFRESH_WIDGET.equals(action) ||
            Intent.ACTION_DATE_CHANGED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
            Intent.ACTION_BOOT_COMPLETED.equals(action)) {

            if (ACTION_REFRESH_WIDGET.equals(action)) {
                SimpleDateFormat sdf = new SimpleDateFormat("HH:mm", Locale.getDefault());
                WidgetStorage.saveLastUpdateTime(context, sdf.format(new Date()));
            }

            updateAllWidgets(context);
        }
    }

    private static void openAppWithRoute(Context context, String route) {
        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        appIntent.putExtra(EXTRA_ROUTE, route);
        context.startActivity(appIntent);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, SwiftNoteWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

        if (appWidgetIds != null && appWidgetIds.length > 0) {
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.widget_list);
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_layout);

        // Update header timestamp
        String lastTime = WidgetStorage.getLastUpdateTime(context);
        if (lastTime == null || lastTime.isEmpty()) {
            SimpleDateFormat sdf = new SimpleDateFormat("HH:mm", Locale.getDefault());
            lastTime = sdf.format(new Date());
        }
        views.setTextViewText(R.id.widget_updated_time, "更新於 " + lastTime);

        // Launch main app when tapping title area
        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent appPendingIntent = PendingIntent.getActivity(
                context,
                0,
                appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_title_area, appPendingIntent);

        // Manual refresh button intent
        Intent refreshIntent = new Intent(context, SwiftNoteWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH_WIDGET);
        PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                1,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPendingIntent);

        // Set up the RemoteViewsService collection adapter for ListView
        Intent serviceIntent = new Intent(context, SwiftNoteWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse(serviceIntent.toUri(Intent.URI_INTENT_SCHEME)));
        views.setRemoteAdapter(R.id.widget_list, serviceIntent);
        views.setEmptyView(R.id.widget_list, R.id.widget_empty_view);

        // Set up item click pending intent template (Broadcast to SwiftNoteWidgetProvider)
        Intent clickIntent = new Intent(context, SwiftNoteWidgetProvider.class);
        PendingIntent clickPendingIntent = PendingIntent.getBroadcast(
                context,
                2,
                clickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_list, clickPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
