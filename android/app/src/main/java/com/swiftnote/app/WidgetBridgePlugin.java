package com.swiftnote.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateSnapshot(PluginCall call) {
        String snapshotJson = call.getString("snapshotJson");
        if (snapshotJson == null) {
            snapshotJson = "{}";
        }

        WidgetStorage.saveSnapshot(getContext(), snapshotJson);

        SimpleDateFormat sdf = new SimpleDateFormat("HH:mm", Locale.getDefault());
        WidgetStorage.saveLastUpdateTime(getContext(), sdf.format(new Date()));

        SwiftNoteWidgetProvider.updateAllWidgets(getContext());

        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        String snapshotJson = WidgetStorage.getSnapshot(getContext());
        JSObject result = new JSObject();
        result.put("snapshotJson", snapshotJson != null ? snapshotJson : "{}");
        call.resolve(result);
    }
}
