package com.swiftnote.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(FileBridgePlugin.class);
        super.onCreate(savedInstanceState);
        handleRouteIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRouteIntent(intent);
    }

    private void handleRouteIntent(Intent intent) {
        if (intent == null) return;
        final String route = intent.getStringExtra("route");
        if (route == null || route.isEmpty()) return;

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                String js = "window.__SWIFTNOTE_PENDING_ROUTE__ = '" + route + "';" +
                        "window.dispatchEvent(new CustomEvent('swiftnote:navigate', { detail: { route: '" + route + "' } }));" +
                        "if (window.history && window.history.pushState) {" +
                        "  window.history.pushState({}, '', '" + route + "');" +
                        "  window.dispatchEvent(new PopStateEvent('popstate'));" +
                        "}";
                getBridge().getWebView().evaluateJavascript(js, null);
            });
        }
    }
}

