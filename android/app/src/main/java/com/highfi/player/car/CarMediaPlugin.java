package com.highfi.player.car;

import android.content.ComponentName;
import android.util.Base64;
import androidx.annotation.Nullable;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONObject;

/** The web app's side of the car link: library and playback state in, commands out. */
@UnstableApi
@CapacitorPlugin(name = "CarMedia")
public class CarMediaPlugin extends Plugin {

    @Nullable
    private ListenableFuture<MediaController> controller;

    @Override
    public void load() {
        CarBridge.runOnMain(() -> {
            CarBridge.attachSink(this::dispatch);
            // Binding the service keeps the media notification and background
            // playback working on the phone, with or without a car.
            SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
            controller = new MediaController.Builder(getContext(), token).buildAsync();
        });
    }

    private void dispatch(JSONObject command) {
        try {
            notifyListeners("command", JSObject.fromJSONObject(command));
        } catch (Exception e) {
            // A malformed command is dropped rather than crashing playback.
        }
    }

    @PluginMethod
    public void setLibrary(PluginCall call) {
        JSObject data = call.getData();
        CarBridge.runOnMain(() -> {
            CarBridge.setLibrary(getContext(), data);
            call.resolve();
        });
    }

    @PluginMethod
    public void updateState(PluginCall call) {
        JSObject data = call.getData();
        String art = data.optString("artwork", "");
        data.remove("artwork");
        byte[] artwork = null;
        if (!art.isEmpty()) {
            try {
                artwork = Base64.decode(art, Base64.DEFAULT);
            } catch (IllegalArgumentException ignored) {
                // Bad artwork just means no artwork.
            }
        }
        byte[] finalArtwork = artwork;
        CarBridge.runOnMain(() -> {
            CarBridge.updateState(data, finalArtwork);
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        CarBridge.runOnMain(() -> {
            CarBridge.attachSink(null);
            if (controller != null) {
                MediaController.releaseFuture(controller);
                controller = null;
            }
        });
    }
}
