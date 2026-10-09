package com.highfi.player.car;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.MediaSession;
import androidx.media3.session.SessionError;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.highfi.player.MainActivity;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The media service Android Auto connects to. It also gives the phone a media
 * notification and lock-screen controls, and keeps the app alive in the
 * background while music plays.
 */
@UnstableApi
public final class PlaybackService extends MediaLibraryService {

    @Nullable
    private MediaLibrarySession session;
    private final Map<String, List<MediaItem>> searches = new HashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        BridgePlayer player = new BridgePlayer(this);
        CarBridge.attachPlayer(player);

        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent activity = PendingIntent.getActivity(
            this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        session = new MediaLibrarySession.Builder(this, player, new Callback()).setSessionActivity(activity).build();
        addSession(session);
    }

    @Nullable
    @Override
    public MediaLibrarySession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onDestroy() {
        CarBridge.attachPlayer(null);
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    private CarLibrary library() {
        return CarBridge.library(this);
    }

    private final class Callback implements MediaLibrarySession.Callback {

        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
            MediaLibrarySession session, MediaSession.ControllerInfo browser, @Nullable LibraryParams params) {
            LibraryParams rootParams = new LibraryParams.Builder().setExtras(CarLibrary.rootExtras()).build();
            return Futures.immediateFuture(LibraryResult.ofItem(library().root(), rootParams));
        }

        @Override
        public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
            MediaLibrarySession session, MediaSession.ControllerInfo browser, String mediaId) {
            MediaItem item = library().item(mediaId);
            return Futures.immediateFuture(
                item != null ? LibraryResult.ofItem(item, null) : LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
        }

        @Override
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
            MediaLibrarySession session,
            MediaSession.ControllerInfo browser,
            String parentId,
            int page,
            int pageSize,
            @Nullable LibraryParams params) {
            List<MediaItem> children = library().children(parentId);
            if (children == null) return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
            return Futures.immediateFuture(
                LibraryResult.ofItemList(ImmutableList.copyOf(CarLibrary.page(children, page, pageSize)), params));
        }

        @Override
        public ListenableFuture<LibraryResult<Void>> onSearch(
            MediaLibrarySession session, MediaSession.ControllerInfo browser, String query, @Nullable LibraryParams params) {
            List<MediaItem> results = library().search(query);
            searches.put(query, results);
            session.notifySearchResultChanged(browser, query, results.size(), params);
            return Futures.immediateFuture(LibraryResult.ofVoid());
        }

        @Override
        public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetSearchResult(
            MediaLibrarySession session,
            MediaSession.ControllerInfo browser,
            String query,
            int page,
            int pageSize,
            @Nullable LibraryParams params) {
            List<MediaItem> results = searches.get(query);
            if (results == null) results = library().search(query);
            return Futures.immediateFuture(
                LibraryResult.ofItemList(ImmutableList.copyOf(CarLibrary.page(results, page, pageSize)), params));
        }

        /**
         * Items picked in the car carry only an ID (or a voice query), no URI.
         * The default would reject them; pass them on to the player as they are.
         */
        @Override
        public ListenableFuture<List<MediaItem>> onAddMediaItems(
            MediaSession mediaSession, MediaSession.ControllerInfo controller, List<MediaItem> mediaItems) {
            return Futures.immediateFuture(mediaItems);
        }
    }
}
