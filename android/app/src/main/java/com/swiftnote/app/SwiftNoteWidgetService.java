package com.swiftnote.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class SwiftNoteWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new SwiftNoteRemoteViewsFactory(this.getApplicationContext());
    }

    static class SwiftNoteRemoteViewsFactory implements RemoteViewsFactory {
        private final Context mContext;
        private final List<WidgetItem> mItems = new ArrayList<>();

        enum ItemType {
            SECTION_HEADER,
            TODO_ITEM,
            DAILY_ITEM,
            ANNIVERSARY_ITEM,
            EMPTY_MESSAGE
        }

        static class WidgetItem {
            ItemType type;
            String sectionTitle;
            int sectionCount;
            int sectionType; // 1: todo, 2: daily, 3: anniversary
            boolean isCollapsed;

            String id;
            String title;
            String date;
            String category;
            String anniversaryLabel;
            String relativeDay;
            String route;
            String emptyMessage;
        }

        public SwiftNoteRemoteViewsFactory(Context context) {
            this.mContext = context;
        }

        @Override
        public void onCreate() {}

        @Override
        public void onDataSetChanged() {
            mItems.clear();

            String jsonString = WidgetStorage.getSnapshot(mContext);
            if (jsonString == null || jsonString.isEmpty()) {
                // Empty state across all
                addSection("待做事項", 1, Collections.emptyList(), "目前沒有待做事項");
                addSection("未來7日", 2, Collections.emptyList(), "未來7日沒有事件");
                addSection("未來3日紀念日", 3, Collections.emptyList(), "未來3日沒有紀念日");
                return;
            }

            try {
                JSONObject root = new JSONObject(jsonString);

                // Calculate date thresholds
                SimpleDateFormat ymdFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                Calendar cal = Calendar.getInstance();
                String todayStr = ymdFormat.format(cal.getTime());

                cal.add(Calendar.DAY_OF_YEAR, 1);
                String tomorrowStr = ymdFormat.format(cal.getTime());

                cal.add(Calendar.DAY_OF_YEAR, 1);
                String todayPlus2Str = ymdFormat.format(cal.getTime());

                cal.add(Calendar.DAY_OF_YEAR, 4); // total +6 days from today
                String todayPlus6Str = ymdFormat.format(cal.getTime());

                // 1. Process Todos
                JSONArray todosArray = root.optJSONArray("todos");
                List<WidgetItem> todoItems = new ArrayList<>();
                if (todosArray != null) {
                    for (int i = 0; i < todosArray.length(); i++) {
                        JSONObject obj = todosArray.getJSONObject(i);
                        String category = obj.optString("category", "").trim();
                        String recordType = obj.optString("recordType", "");
                        if (!"待做事項".equals(category) || !"note".equals(recordType)) {
                            continue;
                        }

                        WidgetItem item = new WidgetItem();
                        item.type = ItemType.TODO_ITEM;
                        item.id = obj.optString("id", "");
                        item.title = obj.optString("title", "");
                        String editTime = obj.optString("lastEditedAt", obj.optString("updatedAt", ""));
                        item.date = formatShortTime(editTime);
                        item.route = obj.optString("route", "/daily/" + item.id + "?mode=notes");
                        todoItems.add(item);
                    }
                }

                // 2. Process Daily events (today to today + 6)
                JSONArray dailyArray = root.optJSONArray("dailyEvents");
                List<WidgetItem> dailyItems = new ArrayList<>();
                if (dailyArray != null) {
                    for (int i = 0; i < dailyArray.length(); i++) {
                        JSONObject obj = dailyArray.getJSONObject(i);
                        String date = obj.optString("date", "");
                        String recordType = obj.optString("recordType", "daily");
                        if (!recordType.isEmpty() && !"daily".equals(recordType)) {
                            continue;
                        }

                        if (date.compareTo(todayStr) >= 0 && date.compareTo(todayPlus6Str) <= 0) {
                            WidgetItem item = new WidgetItem();
                            item.type = ItemType.DAILY_ITEM;
                            item.id = obj.optString("id", "");
                            item.title = obj.optString("title", "");
                            item.date = formatDateWithWeekday(date);
                            item.category = obj.optString("category", "").trim();
                            item.route = obj.optString("route", "/daily/" + item.id);
                            item.emptyMessage = date; // temporary for sorting
                            dailyItems.add(item);
                        }
                    }

                    // Sort daily by date asc
                    Collections.sort(dailyItems, new Comparator<WidgetItem>() {
                        @Override
                        public int compare(WidgetItem a, WidgetItem b) {
                            return a.emptyMessage.compareTo(b.emptyMessage);
                        }
                    });
                }

                // 3. Process Anniversaries (today to today + 2)
                JSONArray anniArray = root.optJSONArray("anniversaries");
                List<WidgetItem> anniItems = new ArrayList<>();
                if (anniArray != null) {
                    for (int i = 0; i < anniArray.length(); i++) {
                        JSONObject obj = anniArray.getJSONObject(i);
                        String solarDate = obj.optString("solarDate", "");
                        if (solarDate.compareTo(todayStr) >= 0 && solarDate.compareTo(todayPlus2Str) <= 0) {
                            WidgetItem item = new WidgetItem();
                            item.type = ItemType.ANNIVERSARY_ITEM;
                            item.id = obj.optString("eventId", obj.optString("id", ""));
                            item.title = obj.optString("title", "");
                            item.date = solarDate;
                            item.anniversaryLabel = obj.optString("anniversaryLabel", "");
                            item.route = obj.optString("route", "/daily/" + item.id + "?mode=anniversary");

                            if (solarDate.equals(todayStr)) {
                                item.relativeDay = "今天";
                            } else if (solarDate.equals(tomorrowStr)) {
                                item.relativeDay = "明天";
                            } else {
                                item.relativeDay = formatMonthDay(solarDate);
                            }
                            anniItems.add(item);
                        }
                    }

                    // Sort by solarDate asc, then title
                    Collections.sort(anniItems, new Comparator<WidgetItem>() {
                        @Override
                        public int compare(WidgetItem a, WidgetItem b) {
                            int cmp = a.date.compareTo(b.date);
                            if (cmp != 0) return cmp;
                            return a.title.compareTo(b.title);
                        }
                    });
                }

                // Assemble sections
                addSection("待做事項", 1, todoItems, "目前沒有待做事項");
                addSection("未來7日", 2, dailyItems, "未來7日沒有事件");
                addSection("未來3日紀念日", 3, anniItems, "未來3日沒有紀念日");

            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        private void addSection(String title, int sectionType, List<WidgetItem> items, String emptyMessage) {
            boolean isCollapsed = WidgetStorage.isSectionCollapsed(mContext, sectionType);

            WidgetItem header = new WidgetItem();
            header.type = ItemType.SECTION_HEADER;
            header.sectionTitle = title;
            header.sectionCount = items.size();
            header.sectionType = sectionType;
            header.isCollapsed = isCollapsed;
            mItems.add(header);

            if (!isCollapsed) {
                if (items.isEmpty()) {
                    WidgetItem empty = new WidgetItem();
                    empty.type = ItemType.EMPTY_MESSAGE;
                    empty.emptyMessage = emptyMessage;
                    mItems.add(empty);
                } else {
                    mItems.addAll(items);
                }
            }
        }

        @Override
        public void onDestroy() {
            mItems.clear();
        }

        @Override
        public int getCount() {
            return mItems.size();
        }

        @Override
        public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= mItems.size()) {
                return null;
            }

            WidgetItem item = mItems.get(position);

            switch (item.type) {
                case SECTION_HEADER: {
                    RemoteViews views = new RemoteViews(mContext.getPackageName(), R.layout.widget_section_header);
                    views.setTextViewText(R.id.header_count, "(" + item.sectionCount + ")");

                    if (item.sectionType == 1) { // Todo
                        views.setViewVisibility(R.id.header_badge_todo, View.VISIBLE);
                        views.setViewVisibility(R.id.header_badge_daily, View.GONE);
                        views.setViewVisibility(R.id.header_badge_anniversary, View.GONE);
                    } else if (item.sectionType == 2) { // Daily
                        views.setViewVisibility(R.id.header_badge_todo, View.GONE);
                        views.setViewVisibility(R.id.header_badge_daily, View.VISIBLE);
                        views.setViewVisibility(R.id.header_badge_anniversary, View.GONE);
                    } else { // Anniversary
                        views.setViewVisibility(R.id.header_badge_todo, View.GONE);
                        views.setViewVisibility(R.id.header_badge_daily, View.GONE);
                        views.setViewVisibility(R.id.header_badge_anniversary, View.VISIBLE);
                    }

                    // Toggle collapse icon & text
                    if (item.isCollapsed) {
                        views.setImageViewResource(R.id.header_icon_collapse, R.drawable.ic_widget_expand);
                        views.setTextViewText(R.id.header_text_collapse, "展開");
                    } else {
                        views.setImageViewResource(R.id.header_icon_collapse, R.drawable.ic_widget_collapse);
                        views.setTextViewText(R.id.header_text_collapse, "折疊");
                    }

                    // 1. Collapse toggle fill-in intent (both collapse button and title badge area)
                    Intent collapseIntent = new Intent();
                    collapseIntent.setAction(SwiftNoteWidgetProvider.ACTION_TOGGLE_SECTION);
                    collapseIntent.putExtra(SwiftNoteWidgetProvider.EXTRA_SECTION_TYPE, item.sectionType);
                    views.setOnClickFillInIntent(R.id.header_btn_collapse, collapseIntent);
                    views.setOnClickFillInIntent(R.id.header_title_area, collapseIntent);

                    // 2. Add event fill-in intent (+)
                    Intent addIntent = new Intent();
                    addIntent.setAction(SwiftNoteWidgetProvider.ACTION_ADD_ITEM);
                    addIntent.putExtra(SwiftNoteWidgetProvider.EXTRA_SECTION_TYPE, item.sectionType);
                    views.setOnClickFillInIntent(R.id.header_btn_add, addIntent);

                    return views;
                }

                case TODO_ITEM: {
                    RemoteViews views = new RemoteViews(mContext.getPackageName(), R.layout.widget_item_todo);
                    views.setTextViewText(R.id.todo_title, item.title);
                    if (item.date != null && !item.date.isEmpty()) {
                        views.setTextViewText(R.id.todo_date, item.date);
                        views.setViewVisibility(R.id.todo_date, View.VISIBLE);
                    } else {
                        views.setViewVisibility(R.id.todo_date, View.GONE);
                    }

                    Intent fillInIntent = new Intent();
                    fillInIntent.setAction(SwiftNoteWidgetProvider.ACTION_OPEN_ITEM);
                    fillInIntent.putExtra(SwiftNoteWidgetProvider.EXTRA_ROUTE, item.route);
                    views.setOnClickFillInIntent(R.id.todo_item_root, fillInIntent);
                    return views;
                }

                case DAILY_ITEM: {
                    RemoteViews views = new RemoteViews(mContext.getPackageName(), R.layout.widget_item_daily);
                    views.setTextViewText(R.id.daily_date, item.date);
                    views.setTextViewText(R.id.daily_title, item.title);

                    if (item.category != null && !item.category.isEmpty()) {
                        views.setTextViewText(R.id.daily_category, item.category);
                        views.setViewVisibility(R.id.daily_category, View.VISIBLE);
                    } else {
                        views.setViewVisibility(R.id.daily_category, View.GONE);
                    }

                    Intent fillInIntent = new Intent();
                    fillInIntent.setAction(SwiftNoteWidgetProvider.ACTION_OPEN_ITEM);
                    fillInIntent.putExtra(SwiftNoteWidgetProvider.EXTRA_ROUTE, item.route);
                    views.setOnClickFillInIntent(R.id.daily_item_root, fillInIntent);
                    return views;
                }

                case ANNIVERSARY_ITEM: {
                    RemoteViews views = new RemoteViews(mContext.getPackageName(), R.layout.widget_item_anniversary);
                    views.setTextViewText(R.id.anniversary_day, item.relativeDay);
                    views.setTextViewText(R.id.anniversary_title, item.title);

                    if (item.anniversaryLabel != null && !item.anniversaryLabel.isEmpty()) {
                        views.setTextViewText(R.id.anniversary_label, item.anniversaryLabel);
                        views.setViewVisibility(R.id.anniversary_label, View.VISIBLE);
                    } else {
                        views.setViewVisibility(R.id.anniversary_label, View.GONE);
                    }

                    Intent fillInIntent = new Intent();
                    fillInIntent.setAction(SwiftNoteWidgetProvider.ACTION_OPEN_ITEM);
                    fillInIntent.putExtra(SwiftNoteWidgetProvider.EXTRA_ROUTE, item.route);
                    views.setOnClickFillInIntent(R.id.anniversary_item_root, fillInIntent);
                    return views;
                }

                case EMPTY_MESSAGE:
                default: {
                    RemoteViews views = new RemoteViews(mContext.getPackageName(), R.layout.widget_item_empty);
                    views.setTextViewText(R.id.empty_text, item.emptyMessage);
                    return views;
                }
            }
        }

        @Override
        public RemoteViews getLoadingView() {
            return null;
        }

        @Override
        public int getViewTypeCount() {
            return 5;
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public boolean hasStableIds() {
            return false;
        }

        private String formatDateWithWeekday(String ymd) {
            try {
                SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                Date d = in.parse(ymd);
                if (d != null) {
                    SimpleDateFormat out = new SimpleDateFormat("MM/dd (E)", Locale.TAIWAN);
                    return out.format(d);
                }
            } catch (Exception ignored) {}
            return ymd;
        }

        private String formatMonthDay(String ymd) {
            try {
                SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
                Date d = in.parse(ymd);
                if (d != null) {
                    SimpleDateFormat out = new SimpleDateFormat("MM/dd", Locale.US);
                    return out.format(d);
                }
            } catch (Exception ignored) {}
            return ymd;
        }

        private String formatShortTime(String isoTime) {
            if (isoTime == null || isoTime.isEmpty()) return "";
            try {
                if (isoTime.length() >= 10) {
                    return isoTime.substring(0, 10);
                }
            } catch (Exception ignored) {}
            return isoTime;
        }
    }
}
