package com.highfi.player.car;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import androidx.annotation.Nullable;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONObject;

/**
 * Links the web app (through {@link CarMediaPlugin}) and the car (through
 * {@link PlaybackService}). Both live in the app process; everything here runs
 * on the main thread.
 */
public final class CarBridge {

    private static final String TAG = "HighFiCar";
    private static final String LIBRARY_FILE = "car-library.json";

    /** Receives what the car asks for; implemented by the plugin while the web app runs. */
    public interface CommandSink {
        void send(JSONObject command);
    }

    private static final Handler main = new Handler(Looper.getMainLooper());
    private static CarLibrary library;
    @Nullable
    private static CommandSink sink;
    @Nullable
    private static BridgePlayer player;
    /** The latest playback state, replayed to a player created after it arrived. */
    @Nullable
    private static JSONObject state;
    @Nullable
    private static byte[] artwork;

    private CarBridge() {}

    public static void runOnMain(Runnable r) {
        if (Looper.myLooper() == Looper.getMainLooper()) r.run();
        else main.post(r);
    }

    /** The last library the web app sent, read back from disk after a restart. */
    public static CarLibrary library(Context context) {
        if (library == null) {
            library = CarLibrary.EMPTY;
            File file = new File(context.getFilesDir(), LIBRARY_FILE);
            if (file.exists()) {
                try {
                    library = new CarLibrary(new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)));
                } catch (Exception e) {
                    Log.w(TAG, "Couldn't read the saved car library", e);
                }
            }
        }
        return library;
    }

    public static void setLibrary(Context context, JSONObject json) {
        library = new CarLibrary(json);
        File file = new File(context.getFilesDir(), LIBRARY_FILE);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(json.toString().getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            Log.w(TAG, "Couldn't save the car library", e);
        }
        if (player != null) player.libraryChanged();
    }

    public static void attachSink(@Nullable CommandSink s) {
        sink = s;
        if (player != null) player.setAppRunning(s != null);
    }

    public static boolean appRunning() {
        return sink != null;
    }

    static void attachPlayer(@Nullable BridgePlayer p) {
        player = p;
        if (p != null && state != null) p.update(state, artwork);
    }

    public static void updateState(JSONObject s, @Nullable byte[] art) {
        String id = s.optString("trackId", "");
        if (art != null) artwork = art;
        else if (state == null || !id.equals(state.optString("trackId", ""))) artwork = null;
        state = s;
        if (player != null) player.update(s, art);
    }

    /** Sends a command to the web app. Returns false when the app isn't running. */
    static boolean send(String action, @Nullable JSONObject args) {
        if (sink == null) return false;
        try {
            JSONObject cmd = args == null ? new JSONObject() : args;
            cmd.put("action", action);
            sink.send(cmd);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Couldn't send " + action, e);
            return false;
        }
    }
}
