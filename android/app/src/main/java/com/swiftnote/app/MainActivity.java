package com.swiftnote.app;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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

    private void handleRouteIntent(Intent intent) {
        if (intent == null) return;
        final String route = intent.getStringExtra("route");
        if (route == null || route.isEmpty()) return;

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

