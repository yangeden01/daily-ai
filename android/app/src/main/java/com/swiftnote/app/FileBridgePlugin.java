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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "FileBridge")
public class FileBridgePlugin extends Plugin {

    private static class TransferSession {
        final String transferId;
        final String fileName;
        final String mimeType;
        final File tempFile;
        final FileOutputStream fos;
        long bytesWritten = 0;

        TransferSession(String transferId, String fileName, String mimeType, File tempFile, FileOutputStream fos) {
            this.transferId = transferId;
            this.fileName = fileName;
            this.mimeType = mimeType;
            this.tempFile = tempFile;
            this.fos = fos;
        }
    }

    private final ConcurrentHashMap<String, TransferSession> activeSessions = new ConcurrentHashMap<>();

    @PluginMethod
    public void startSaveFile(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/octet-stream");

        if (fileName == null || fileName.trim().isEmpty()) {
            call.reject("fileName is required");
            return;
        }

        try {
            String transferId = UUID.randomUUID().toString();
            File transferDir = new File(getContext().getCacheDir(), "transfers");
            if (!transferDir.exists()) {
                transferDir.mkdirs();
            }
            File tempFile = new File(transferDir, "transfer_" + transferId + ".tmp");
            FileOutputStream fos = new FileOutputStream(tempFile);

            TransferSession session = new TransferSession(transferId, fileName, mimeType, tempFile, fos);
            activeSessions.put(transferId, session);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("transferId", transferId);
            call.resolve(result);
        } catch (Throwable t) {
            call.reject("初始化檔案寫入失敗: " + t.getMessage(), t);
        }
    }

    @PluginMethod
    public void appendFileChunk(PluginCall call) {
        String transferId = call.getString("transferId");
        String chunkBase64 = call.getString("chunkBase64");

        if (transferId == null || chunkBase64 == null) {
            call.reject("transferId and chunkBase64 are required");
            return;
        }

        TransferSession session = activeSessions.get(transferId);
        if (session == null) {
            call.reject("未找到寫入階段: " + transferId);
            return;
        }

        try {
            if (chunkBase64.contains(",")) {
                chunkBase64 = chunkBase64.substring(chunkBase64.indexOf(",") + 1);
            }
            byte[] chunk = Base64.decode(chunkBase64, Base64.DEFAULT);
            session.fos.write(chunk);
            session.bytesWritten += chunk.length;

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("bytesWritten", session.bytesWritten);
            call.resolve(result);
        } catch (Throwable t) {
            call.reject("寫入分塊失敗: " + t.getMessage(), t);
        }
    }

    @PluginMethod
    public void finishSaveFile(PluginCall call) {
        String transferId = call.getString("transferId");
        boolean shareAfterSave = Boolean.TRUE.equals(call.getBoolean("shareAfterSave", false));

        if (transferId == null) {
            call.reject("transferId is required");
            return;
        }

        TransferSession session = activeSessions.remove(transferId);
        if (session == null) {
            call.reject("未找到寫入階段: " + transferId);
            return;
        }

        try {
            session.fos.flush();
            session.fos.close();
        } catch (Throwable ignored) {}

        new Thread(() -> {
            try {
                String savedLocation = saveFileFromTemp(session.tempFile, session.fileName, session.mimeType);

                if (shareAfterSave) {
                    shareFileInternal(session.tempFile, session.fileName, session.mimeType);
                } else {
                    try {
                        session.tempFile.delete();
                    } catch (Throwable ignored) {}
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("savedLocation", savedLocation);
                result.put("fileName", session.fileName);
                result.put("fileSize", session.bytesWritten);
                call.resolve(result);
            } catch (Throwable t) {
                try {
                    session.tempFile.delete();
                } catch (Throwable ignored) {}
                call.reject("儲存檔案至裝置失敗: " + t.getMessage(), t);
            }
        }).start();
    }

    @PluginMethod
    public void cancelSaveFile(PluginCall call) {
        String transferId = call.getString("transferId");
        if (transferId != null) {
            TransferSession session = activeSessions.remove(transferId);
            if (session != null) {
                try {
                    session.fos.close();
                } catch (Throwable ignored) {}
                try {
                    session.tempFile.delete();
                } catch (Throwable ignored) {}
            }
        }
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

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

        new Thread(() -> {
            File tempFile = null;
            try {
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                File transferDir = new File(getContext().getCacheDir(), "transfers");
                if (!transferDir.exists()) {
                    transferDir.mkdirs();
                }
                tempFile = new File(transferDir, "direct_" + System.currentTimeMillis() + ".tmp");
                try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                String savedLocation = saveFileFromTemp(tempFile, fileName, mimeType);

                if (shareAfterSave) {
                    shareFileInternal(tempFile, fileName, mimeType);
                } else {
                    try {
                        tempFile.delete();
                    } catch (Throwable ignored) {}
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("savedLocation", savedLocation);
                result.put("fileName", fileName);
                result.put("fileSize", bytes.length);
                call.resolve(result);

            } catch (Throwable t) {
                if (tempFile != null) {
                    try {
                        tempFile.delete();
                    } catch (Throwable ignored) {}
                }
                call.reject("儲存檔案失敗: " + t.getMessage(), t);
            }
        }).start();
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

        new Thread(() -> {
            try {
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                byte[] bytes = Base64.decode(cleanBase64, Base64.DEFAULT);

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

            } catch (Throwable t) {
                call.reject("分享檔案失敗: " + t.getMessage(), t);
            }
        }).start();
    }

    private String saveFileFromTemp(File tempFile, String fileName, String mimeType) throws Exception {
        String savedLocation = "";
        Uri publicUri = null;

        // 1. Android 10+ (API 29+): MediaStore.Downloads with stream copy
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    try (InputStream is = new FileInputStream(tempFile);
                         OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                        if (os != null) {
                            byte[] buffer = new byte[65536];
                            int len;
                            while ((len = is.read(buffer)) > 0) {
                                os.write(buffer, 0, len);
                            }
                            os.flush();
                        }
                    }
                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    getContext().getContentResolver().update(uri, values, null, null);

                    publicUri = uri;
                    savedLocation = "手機內部儲存空間 / Download (下載) / " + fileName;
                }
            } catch (Throwable ignored) {}
        }

        // 2. Fallback for pre-Android 10 or if MediaStore insert failed
        if (publicUri == null) {
            try {
                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (downloadDir != null) {
                    if (!downloadDir.exists()) {
                        downloadDir.mkdirs();
                    }
                    File outFile = new File(downloadDir, fileName);
                    try (InputStream is = new FileInputStream(tempFile);
                         OutputStream os = new FileOutputStream(outFile)) {
                        byte[] buffer = new byte[65536];
                        int len;
                        while ((len = is.read(buffer)) > 0) {
                            os.write(buffer, 0, len);
                        }
                        os.flush();
                    }
                    MediaScannerConnection.scanFile(getContext(), new String[]{outFile.getAbsolutePath()}, new String[]{mimeType}, null);
                    savedLocation = "手機內部儲存空間 / Download (下載) / " + fileName;
                    return savedLocation;
                }
            } catch (Throwable ignored) {}

            // 3. Fallback to app external files dir if Downloads is inaccessible
            try {
                File appFilesDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (appFilesDir == null) {
                    appFilesDir = new File(getContext().getFilesDir(), "downloads");
                }
                if (!appFilesDir.exists()) {
                    appFilesDir.mkdirs();
                }
                File outFile = new File(appFilesDir, fileName);
                try (InputStream is = new FileInputStream(tempFile);
                     OutputStream os = new FileOutputStream(outFile)) {
                    byte[] buffer = new byte[65536];
                    int len;
                    while ((len = is.read(buffer)) > 0) {
                        os.write(buffer, 0, len);
                    }
                    os.flush();
                }
                savedLocation = "應用程式儲存空間 / " + fileName;
            } catch (Throwable t) {
                throw new Exception("無法將檔案寫入儲存空間: " + t.getMessage(), t);
            }
        }

        return savedLocation;
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
        } catch (Throwable ignored) {}
    }
}
