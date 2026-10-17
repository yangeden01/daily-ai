package com.swiftnote.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static volatile String sPendingRoute = null;
    private final Handler mHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(FileBridgePlugin.class);
        super.onCreate(savedInstanceState);
        setupWindowInsets();
        handleRouteIntent(getIntent());
    }

    private void setupWindowInsets() {
        if (getWindow() != null && getWindow().getDecorView() != null) {
            ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
                Insets insets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                float density = getResources().getDisplayMetrics().density;
                int topPx = (int) Math.ceil(insets.top / density);
                int bottomPx = (int) Math.ceil(insets.bottom / density);
                int leftPx = (int) Math.ceil(insets.left / density);
                int rightPx = (int) Math.ceil(insets.right / density);

                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        try {
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                String js = String.format(
                                    java.util.Locale.US,
                                    "document.documentElement.style.setProperty('--safe-area-inset-top', '%dpx');" +
                                    "document.documentElement.style.setProperty('--safe-area-inset-bottom', '%dpx');" +
                                    "document.documentElement.style.setProperty('--safe-area-inset-left', '%dpx');" +
                                    "document.documentElement.style.setProperty('--safe-area-inset-right', '%dpx');",
                                    topPx, bottomPx, leftPx, rightPx
                                );
                                getBridge().getWebView().evaluateJavascript(js, null);
                            }
                        } catch (Throwable ignored) {}
                    });
                }
                return windowInsets;
            });
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleRouteIntent(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        String route = extractRoute(getIntent());
        if (route == null || route.isEmpty()) {
            route = sPendingRoute;
        }
        if (route == null || route.isEmpty()) {
            route = WidgetStorage.getPendingRoute(this);
        }
        if (route != null && !route.isEmpty()) {
            scheduleRouteDispatch(route);
        }
    }

    private String extractRoute(Intent intent) {
        if (intent == null) return null;
        String route = intent.getStringExtra("route");
        if (route != null && !route.isEmpty()) {
            return route;
        }
        Uri data = intent.getData();
        if (data != null) {
            String path = data.getPath();
            String query = data.getQuery();
            if (path != null && !path.isEmpty()) {
                if (query != null && !query.isEmpty()) {
                    return path + "?" + query;
                }
                return path;
            }
        }
        return null;
    }

    private void handleRouteIntent(Intent intent) {
        final String route = extractRoute(intent);
        if (route == null || route.isEmpty()) return;

        sPendingRoute = route;
        WidgetStorage.savePendingRoute(this, route);
        scheduleRouteDispatch(route);
    }

    private void scheduleRouteDispatch(final String route) {
        // Dispatch immediately and at staggered intervals to guarantee delivery across cold & warm starts
        long[] delays = {50, 300, 800, 1500};
        for (long delay : delays) {
            mHandler.postDelayed(() -> dispatchRouteToWebView(route), delay);
        }
    }

    private void dispatchRouteToWebView(final String route) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = "window.__SWIFTNOTE_PENDING_ROUTE__ = '" + route + "';" +
                                "window.dispatchEvent(new CustomEvent('swiftnote:navigate', { detail: { route: '" + route + "' } }));" +
                                "if (window.history && window.history.pushState) {" +
                                "  window.history.pushState({}, '', '" + route + "');" +
                                "  window.dispatchEvent(new PopStateEvent('popstate'));" +
                                "}";
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Throwable ignored) {}
            });
        }
    }
}

