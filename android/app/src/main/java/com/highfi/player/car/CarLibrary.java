package com.highfi.player.car;

import android.net.Uri;
import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.session.MediaConstants;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The browse tree Android Auto shows. The web app builds the lists (it owns
 * the library) and this class only turns them into media items.
 *
 * Media IDs:
 *   root                         the tree root
 *   songs | albums | artists | playlists          the four tabs
 *   album/<id> | artist/<id> | playlist/<id> | favorites | recent   lists of songs
 *   track/<trackId>/<list id>    a song, played from within the list it was picked in
 */
public final class CarLibrary {

    public static final String ROOT = "root";
    static final String SONGS = "songs";
    static final String ALBUMS = "albums";
    static final String ARTISTS = "artists";
    static final String PLAYLISTS = "playlists";
    static final String FAVORITES = "favorites";
    static final String RECENT = "recent";
    static final String TRACK = "track/";

    static final class Track {
        final String id;
        final String title;
        final String artist;
        final String album;
        final long durationMs;

        Track(JSONObject o) {
            id = o.optString("id");
            title = o.optString("title");
            artist = o.optString("artist");
            album = o.optString("album");
            durationMs = o.optLong("durationMs");
        }
    }

    static final class Group {
        final String id;
        final String title;
        final String subtitle;
        final List<String> trackIds;

        Group(JSONObject o) {
            id = o.optString("id");
            title = o.optString("title");
            subtitle = o.optString("subtitle", "");
            trackIds = strings(o.optJSONArray("trackIds"));
        }
    }

    final Map<String, Track> tracks = new LinkedHashMap<>();
    final List<String> songs;
    final List<String> favorites;
    final List<String> recent;
    final List<Group> albums = new ArrayList<>();
    final List<Group> artists = new ArrayList<>();
    final List<Group> playlists = new ArrayList<>();

    public static final CarLibrary EMPTY = new CarLibrary(new JSONObject());

    public CarLibrary(JSONObject json) {
        JSONArray list = json.optJSONArray("tracks");
        if (list != null) {
            for (int i = 0; i < list.length(); i++) {
                JSONObject o = list.optJSONObject(i);
                if (o != null) {
                    Track t = new Track(o);
                    tracks.put(t.id, t);
                }
            }
        }
        songs = strings(json.optJSONArray("songs"));
        favorites = strings(json.optJSONArray("favorites"));
        recent = strings(json.optJSONArray("recent"));
        groups(json.optJSONArray("albums"), albums);
        groups(json.optJSONArray("artists"), artists);
        groups(json.optJSONArray("playlists"), playlists);
    }

    public MediaItem root() {
        return folder(ROOT, "HighFi", null, MediaMetadata.MEDIA_TYPE_FOLDER_MIXED, false);
    }

    /** Root hints: list rows for songs, a grid for albums. */
    public static Bundle rootExtras() {
        Bundle extras = new Bundle();
        extras.putBoolean("android.media.browse.SEARCH_SUPPORTED", true);
        extras.putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_BROWSABLE, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM);
        extras.putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_PLAYABLE, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_LIST_ITEM);
        return extras;
    }

    /** The children of a browsable node, or null when the node doesn't exist. */
    @Nullable
    public List<MediaItem> children(String parentId) {
        List<MediaItem> out = new ArrayList<>();
        switch (parentId) {
            case ROOT:
                out.add(folder(SONGS, "Songs", null, MediaMetadata.MEDIA_TYPE_FOLDER_MIXED, false));
                out.add(folder(ALBUMS, "Albums", null, MediaMetadata.MEDIA_TYPE_FOLDER_ALBUMS, true));
                out.add(folder(ARTISTS, "Artists", null, MediaMetadata.MEDIA_TYPE_FOLDER_ARTISTS, false));
                out.add(folder(PLAYLISTS, "Playlists", null, MediaMetadata.MEDIA_TYPE_FOLDER_PLAYLISTS, false));
                return out;
            case ALBUMS:
                for (Group g : albums) out.add(folder("album/" + Uri.encode(g.id), g.title, g.subtitle, MediaMetadata.MEDIA_TYPE_ALBUM, false));
                return out;
            case ARTISTS:
                for (Group g : artists) out.add(folder("artist/" + Uri.encode(g.id), g.title, g.subtitle, MediaMetadata.MEDIA_TYPE_ARTIST, false));
                return out;
            case PLAYLISTS:
                if (!favorites.isEmpty()) out.add(folder(FAVORITES, "Favorites", count(favorites.size()), MediaMetadata.MEDIA_TYPE_PLAYLIST, false));
                if (!recent.isEmpty()) out.add(folder(RECENT, "Recently added", count(recent.size()), MediaMetadata.MEDIA_TYPE_PLAYLIST, false));
                for (Group g : playlists) out.add(folder("playlist/" + Uri.encode(g.id), g.title, count(g.trackIds.size()), MediaMetadata.MEDIA_TYPE_PLAYLIST, false));
                return out;
            default:
                List<String> ids = trackIds(parentId);
                if (ids == null) return null;
                for (String id : ids) {
                    Track t = tracks.get(id);
                    if (t != null) out.add(track(t, parentId));
                }
                return out;
        }
    }

    /** The songs of a song list, in order. Null when the ID is not a song list. */
    @Nullable
    List<String> trackIds(String listId) {
        switch (listId) {
            case SONGS:
                return songs;
            case FAVORITES:
                return favorites;
            case RECENT:
                return recent;
        }
        int slash = listId.indexOf('/');
        if (slash < 0) return null;
        String kind = listId.substring(0, slash);
        String id = Uri.decode(listId.substring(slash + 1));
        List<Group> groups;
        switch (kind) {
            case "album":
                groups = albums;
                break;
            case "artist":
                groups = artists;
                break;
            case "playlist":
                groups = playlists;
                break;
            default:
                return null;
        }
        for (Group g : groups) if (g.id.equals(id)) return g.trackIds;
        return null;
    }

    @Nullable
    public MediaItem item(String mediaId) {
        if (mediaId.equals(ROOT)) return root();
        PlayRequest req = PlayRequest.parse(mediaId);
        if (req != null) {
            Track t = tracks.get(req.trackId);
            return t == null ? null : track(t, req.listId);
        }
        List<MediaItem> top = children(ROOT);
        for (String tab : new String[] {ROOT, ALBUMS, ARTISTS, PLAYLISTS}) {
            List<MediaItem> items = tab.equals(ROOT) ? top : children(tab);
            if (items == null) continue;
            for (MediaItem item : items) if (item.mediaId.equals(mediaId)) return item;
        }
        return null;
    }

    /** Songs whose title, artist or album contain every word of the query. */
    public List<MediaItem> search(String query) {
        String[] words = query.toLowerCase(Locale.ROOT).trim().split("\\s+");
        List<MediaItem> out = new ArrayList<>();
        for (String id : songs) {
            Track t = tracks.get(id);
            if (t == null) continue;
            String hay = (t.title + " " + t.artist + " " + t.album).toLowerCase(Locale.ROOT);
            boolean all = true;
            for (String w : words) {
                if (!w.isEmpty() && !hay.contains(w)) {
                    all = false;
                    break;
                }
            }
            if (all) out.add(track(t, SONGS));
        }
        return out;
    }

    public static <T> List<T> page(List<T> list, int page, int pageSize) {
        if (pageSize <= 0 || pageSize == Integer.MAX_VALUE) return list;
        int from = page * pageSize;
        if (from >= list.size() || from < 0) return Collections.emptyList();
        return list.subList(from, Math.min(list.size(), from + pageSize));
    }

    private static MediaItem folder(String id, String title, @Nullable String subtitle, int mediaType, boolean grid) {
        MediaMetadata.Builder meta = new MediaMetadata.Builder()
            .setTitle(title)
            .setIsBrowsable(true)
            .setIsPlayable(false)
            .setMediaType(mediaType);
        if (subtitle != null && !subtitle.isEmpty()) meta.setSubtitle(subtitle).setArtist(subtitle);
        if (grid) {
            Bundle extras = new Bundle();
            extras.putInt(MediaConstants.EXTRAS_KEY_CONTENT_STYLE_BROWSABLE, MediaConstants.EXTRAS_VALUE_CONTENT_STYLE_GRID_ITEM);
            meta.setExtras(extras);
        }
        return new MediaItem.Builder().setMediaId(id).setMediaMetadata(meta.build()).build();
    }

    private static MediaItem track(Track t, String listId) {
        MediaMetadata meta = new MediaMetadata.Builder()
            .setTitle(t.title)
            .setArtist(t.artist)
            .setAlbumTitle(t.album)
            .setSubtitle(t.artist)
            .setDurationMs(t.durationMs > 0 ? t.durationMs : null)
            .setIsBrowsable(false)
            .setIsPlayable(true)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
            .build();
        return new MediaItem.Builder().setMediaId(TRACK + Uri.encode(t.id) + "/" + listId).setMediaMetadata(meta).build();
    }

    private static String count(int n) {
        return n == 1 ? "1 song" : n + " songs";
    }

    private static List<String> strings(@Nullable JSONArray arr) {
        List<String> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) out.add(arr.optString(i));
        return out;
    }

    private static void groups(@Nullable JSONArray arr, List<Group> into) {
        if (arr == null) return;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null) into.add(new Group(o));
        }
    }

    /** A song picked in the car: which song, and which list it was picked from. */
    public static final class PlayRequest {
        public final String trackId;
        public final String listId;

        PlayRequest(String trackId, String listId) {
            this.trackId = trackId;
            this.listId = listId;
        }

        @Nullable
        public static PlayRequest parse(String mediaId) {
            if (!mediaId.startsWith(TRACK)) return null;
            String rest = mediaId.substring(TRACK.length());
            int slash = rest.indexOf('/');
            if (slash < 0) return new PlayRequest(Uri.decode(rest), SONGS);
            return new PlayRequest(Uri.decode(rest.substring(0, slash)), rest.substring(slash + 1));
        }
    }
}
