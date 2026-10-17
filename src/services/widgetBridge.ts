import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Event } from '../models/Event'
import { createWidgetSnapshot, type WidgetSnapshot } from './widgetSnapshot'

export interface WidgetBridgePlugin {
  updateSnapshot(options: { snapshotJson: string }): Promise<{ success: boolean }>
  getSnapshot(): Promise<{ snapshotJson: string }>
  getLaunchRoute(): Promise<{ route: string }>
}

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

/**
 * Actively query the native Android plugin for any pending launch route from widget clicks.
 * Guarantees reliable deep linking on cold start even when JS events fired before React mounted.
 */
export const getPendingWidgetRoute = async (): Promise<string | null> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const res = await WidgetBridge.getLaunchRoute()
      if (res && res.route && res.route.trim()) {
        return res.route.trim()
      }
    }
  } catch (error) {
    console.warn('[WidgetBridge] Failed to get launch route:', error)
  }
  return null
}

const WIDGET_SNAPSHOT_LOCAL_KEY = 'swiftnote_widget_snapshot'

/**
 * Synchronize the current event list to the native Android widget snapshot.
 * Safe to call in browser, PWA, or native Android.
 * Catches all errors so widget sync failures will never block user operations.
 */
export const syncWidgetSnapshot = async (
  events: Event[],
  referenceDate = new Date()
): Promise<void> => {
  try {
    const snapshot: WidgetSnapshot = createWidgetSnapshot(events, referenceDate)
    const snapshotJson = JSON.stringify(snapshot)

    // Cache locally in localStorage for web/debug and quick fallback
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(WIDGET_SNAPSHOT_LOCAL_KEY, snapshotJson)
      }
    } catch {
      // Ignore localStorage errors (e.g. storage full or quota)
    }

    // Call native Android bridge if running in native app
    if (Capacitor.isNativePlatform()) {
      await WidgetBridge.updateSnapshot({ snapshotJson })
    }
  } catch (error) {
    // Fail silently: widget sync must never block or crash event operations
    console.warn('[WidgetBridge] Snapshot synchronization failed:', error)
  }
}
