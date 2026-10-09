package com.highfi.player.car;

import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.SimpleBasePlayer;
import androidx.media3.common.util.UnstableApi;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * A player that plays nothing itself. The web app does the playing (so the
 * equalizer and everything else keep working); this mirrors its state for the
 * car, the notification and the lock screen, and forwards their buttons back.
 */
@UnstableApi
final class BridgePlayer extends SimpleBasePlayer {

    static final String NOT_RUNNING = "Open HighFi on your phone to start playback.";

    private final android.content.Context context;

    @Nullable
    private String trackId;
    private MediaMetadata metadata = MediaMetadata.EMPTY;
    private long durationMs = C.TIME_UNSET;
    private long positionMs;
    private boolean playing;
    private float speed = 1f;
    private boolean shuffle;
    private int repeatMode = Player.REPEAT_MODE_OFF;
    @Nullable
    private String error;
    /** A song was just picked in the car; the play() that follows is part of that, not a toggle. */
    private boolean pickPending;

    BridgePlayer(android.content.Context context) {
        super(Looper.getMainLooper());
        this.context = context.getApplicationContext();
    }

    // ------------------------------------------------------------ from the app

    /** Applies a state update sent by the web app. */
    void update(JSONObject s, @Nullable byte[] artwork) {
        String id = s.optString("trackId", "");
        if (id.isEmpty()) {
            trackId = null;
            metadata = MediaMetadata.EMPTY;
        } else {
            boolean sameTrack = id.equals(trackId);
            trackId = id;
            MediaMetadata.Builder meta = new MediaMetadata.Builder()
                .setTitle(s.optString("title"))
                .setArtist(s.optString("artist"))
                .setAlbumTitle(s.optString("album"))
                .setDisplayTitle(s.optString("title"))
                .setSubtitle(s.optString("artist"))
                .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC);
            if (artwork != null) meta.setArtworkData(artwork, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
            else if (sameTrack && metadata.artworkData != null) meta.setArtworkData(metadata.artworkData, MediaMetadata.PICTURE_TYPE_FRONT_COVER);
            metadata = meta.build();
        }
        long d = s.optLong("durationMs", 0);
        durationMs = d > 0 ? d : C.TIME_UNSET;
        positionMs = Math.max(0, s.optLong("positionMs", 0));
        playing = s.optBoolean("playing", false);
        speed = (float) s.optDouble("speed", 1);
        if (!(speed > 0)) speed = 1f;
        shuffle = s.optBoolean("shuffle", false);
        switch (s.optString("repeat", "off")) {
            case "all":
                repeatMode = Player.REPEAT_MODE_ALL;
                break;
            case "one":
                repeatMode = Player.REPEAT_MODE_ONE;
                break;
            default:
                repeatMode = Player.REPEAT_MODE_OFF;
        }
        error = null;
        pickPending = false;
        invalidateState();
    }

    void setAppRunning(boolean running) {
        if (!running) playing = false;
        invalidateState();
    }

    void libraryChanged() {
        invalidateState();
    }

    // ----------------------------------------------------------------- state

    @Override
    protected State getState() {
        Commands commands = new Commands.Builder()
            .addAll(
                COMMAND_PLAY_PAUSE,
                COMMAND_PREPARE,
                COMMAND_STOP,
                COMMAND_SEEK_TO_NEXT,
                COMMAND_SEEK_TO_PREVIOUS,
                COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
                COMMAND_SET_SHUFFLE_MODE,
                COMMAND_SET_REPEAT_MODE,
                COMMAND_GET_CURRENT_MEDIA_ITEM,
                COMMAND_GET_TIMELINE,
                COMMAND_GET_METADATA,
                COMMAND_SET_MEDIA_ITEM,
                COMMAND_CHANGE_MEDIA_ITEMS)
            .build();

        State.Builder state = new State.Builder()
            .setAvailableCommands(commands)
            .setPlaybackParameters(new PlaybackParameters(speed))
            .setShuffleModeEnabled(shuffle)
            .setRepeatMode(repeatMode);

        if (error != null) {
            state.setPlayerError(new PlaybackException(error, null, PlaybackException.ERROR_CODE_FAILED_RUNTIME_CHECK));
        }

        if (trackId == null) {
            return state.setPlaybackState(STATE_IDLE).setPlayWhenReady(false, PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST).build();
        }

        MediaItem item = new MediaItem.Builder().setMediaId(trackId).setMediaMetadata(metadata).build();
        MediaItemData data = new MediaItemData.Builder(trackId)
            .setMediaItem(item)
            .setMediaMetadata(metadata)
            .setDurationUs(durationMs == C.TIME_UNSET ? C.TIME_UNSET : durationMs * 1000)
            .setIsSeekable(true)
            .build();

        return state
            .setPlaylist(ImmutableList.of(data))
            .setCurrentMediaItemIndex(0)
            .setPlaybackState(error != null ? STATE_IDLE : STATE_READY)
            .setPlayWhenReady(playing, PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
            .setContentPositionMs(
                playing ? PositionSupplier.getExtrapolating(positionMs, speed) : PositionSupplier.getConstant(positionMs))
            .build();
    }

    // ------------------------------------------------------------- from the car

    @Override
    protected ListenableFuture<?> handleSetPlayWhenReady(boolean playWhenReady) {
        if (playWhenReady && pickPending) {
            // The song picked in handleSetMediaItems is already starting.
            pickPending = false;
            return done();
        }
        if (!send(playWhenReady ? "play" : "pause", null)) return done();
        playing = playWhenReady;
        return done();
    }

    @Override
    protected ListenableFuture<?> handlePrepare() {
        return done();
    }

    @Override
    protected ListenableFuture<?> handleStop() {
        send("pause", null);
        playing = false;
        return done();
    }

    @Override
    protected ListenableFuture<?> handleRelease() {
        return done();
    }

    @Override
    protected ListenableFuture<?> handleSeek(int mediaItemIndex, long positionMs, @Player.Command int seekCommand) {
        switch (seekCommand) {
            case COMMAND_SEEK_TO_NEXT:
            case COMMAND_SEEK_TO_NEXT_MEDIA_ITEM:
                send("next", null);
                break;
            case COMMAND_SEEK_TO_PREVIOUS:
            case COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM:
                send("prev", null);
                break;
            default:
                if (positionMs != C.TIME_UNSET && send("seek", obj("positionMs", positionMs))) {
                    this.positionMs = positionMs;
                }
        }
        return done();
    }

    @Override
    protected ListenableFuture<?> handleSetShuffleModeEnabled(boolean enabled) {
        if (send("setShuffle", obj("enabled", enabled))) shuffle = enabled;
        return done();
    }

    @Override
    protected ListenableFuture<?> handleSetRepeatMode(@Player.RepeatMode int mode) {
        String value = mode == REPEAT_MODE_ALL ? "all" : mode == REPEAT_MODE_ONE ? "one" : "off";
        if (send("setRepeat", obj("mode", value))) repeatMode = mode;
        return done();
    }

    /** A song picked from the browse tree, or a voice search ("play ... on HighFi"). */
    @Override
    protected ListenableFuture<?> handleSetMediaItems(List<MediaItem> mediaItems, int startIndex, long startPositionMs) {
        if (mediaItems.isEmpty()) return done();
        MediaItem item = mediaItems.get(startIndex == C.INDEX_UNSET ? 0 : Math.max(0, Math.min(startIndex, mediaItems.size() - 1)));
        CarLibrary.PlayRequest pick = CarLibrary.PlayRequest.parse(item.mediaId);
        boolean sent;
        if (pick != null) {
            JSONObject args = new JSONObject();
            try {
                args.put("trackId", pick.trackId);
                List<String> ids = CarBridge.library(context).trackIds(pick.listId);
                args.put("trackIds", new JSONArray(ids != null ? ids : ImmutableList.of(pick.trackId)));
            } catch (Exception ignored) {
                // org.json only throws on non-finite numbers.
            }
            sent = send("playItem", args);
        } else {
            CharSequence query = item.requestMetadata.searchQuery;
            sent = send("playSearch", obj("query", query == null ? "" : query.toString()));
        }
        pickPending = sent;
        return done();
    }

    @Override
    protected ListenableFuture<?> handleAddMediaItems(int index, List<MediaItem> mediaItems) {
        return done();
    }

    @Override
    protected ListenableFuture<?> handleMoveMediaItems(int fromIndex, int toIndex, int newIndex) {
        return done();
    }

    @Override
    protected ListenableFuture<?> handleReplaceMediaItems(int fromIndex, int toIndex, List<MediaItem> mediaItems) {
        return handleSetMediaItems(mediaItems, 0, C.TIME_UNSET);
    }

    @Override
    protected ListenableFuture<?> handleRemoveMediaItems(int fromIndex, int toIndex) {
        return done();
    }

    // ------------------------------------------------------------------ util

    /** Forwards to the web app, or shows why nothing happens when it isn't running. */
    private boolean send(String action, @Nullable JSONObject args) {
        if (CarBridge.send(action, args)) {
            error = null;
            return true;
        }
        error = NOT_RUNNING;
        playing = false;
        return false;
    }

    private static JSONObject obj(String key, Object value) {
        JSONObject o = new JSONObject();
        try {
            o.put(key, value);
        } catch (Exception ignored) {
            // Only non-finite numbers throw.
        }
        return o;
    }

    private static ListenableFuture<?> done() {
        return Futures.immediateVoidFuture();
    }
}
