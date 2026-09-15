package com.swiftnote.app;

import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "FileBridge")
public class FileBridgePlugin extends Plugin {

    @PluginMethod
    public void saveFileToDevice(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        boolean shareAfterSave = Boolean.TRUE.equals(call.getBoolean("shareAfterSave", false));

        if (fileName == null || base64Data == null) {
            call.reject("fileName and base64Data are required");
            return;
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            String savedLocation = "";
            Uri publicUri = null;

            // 1. Android 10+ (API 29+): MediaStore to Downloads directory
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            os.write(bytes);
                            os.flush();
                        }
                    }
                    publicUri = uri;
                    savedLocation = "手機內部儲存空間 / Download (下載) / " + fileName;
                }
            }

            // 2. Fallback for pre-Android 10 or if MediaStore insert failed
            if (publicUri == null) {
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (downloadDir != null && !downloadDir.exists()) {
                    downloadDir.mkdirs();
                }
                File outFile = new File(downloadDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                    fos.write(bytes);
                    fos.flush();
                }
                MediaScannerConnection.scanFile(getContext(), new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                savedLocation = "手機內部儲存空間 / Download (下載) / " + fileName;
            }

            // 3. Save a cached copy for system share sheet
            File cacheDir = new File(getContext().getCacheDir(), "exports");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File cacheFile = new File(cacheDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(bytes);
                fos.flush();
            }

            if (shareAfterSave) {
                shareFileInternal(cacheFile, fileName, mimeType);
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("savedLocation", savedLocation);
            result.put("fileName", fileName);
            result.put("fileSize", bytes.length);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("儲存檔案失敗: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (fileName == null || base64Data == null) {
            call.reject("fileName and base64Data are required");
            return;
        }

        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

            File cacheDir = new File(getContext().getCacheDir(), "exports");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File cacheFile = new File(cacheDir, fileName);
            try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                fos.write(bytes);
                fos.flush();
            }

            shareFileInternal(cacheFile, fileName, mimeType);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("分享檔案失敗: " + e.getMessage(), e);
        }
    }

    private void shareFileInternal(File file, String fileName, String mimeType) {
        try {
            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, fileName);
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(shareIntent, "選擇儲存或分享備份");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);
        } catch (Exception ignored) {}
    }
}
