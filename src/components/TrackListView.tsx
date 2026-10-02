import React, { useState } from "react";
import {
  Play,
  Shuffle,
  Search,
  Heart,
  Music2,
  Plus,
  ArrowDownWideNarrow,
  FolderDown,
  Trash2,
  AudioLines,
  Disc3,
  ArrowUpRight,
} from "lucide-react";
import { Track } from "../types/music";

interface TrackListViewProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onPlayAll: (tracks: Track[], shuffle: boolean) => void;
  onToggleFavorite: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onInspectTrack: (track: Track) => void;
  onFilesDropped: (files: FileList) => void;
  onTriggerFileInput: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatFilter: string;
  onFormatFilterChange: (fmt: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const TrackListView: React.FC<TrackListViewProps> = ({
  title,
  subtitle,
  tracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onPlayAll,
  onToggleFavorite,
  onRemoveTrack,
  onInspectTrack,
  onFilesDropped,
  onTriggerFileInput,
  searchQuery,
  onSearchChange,
  formatFilter,
  onFormatFilterChange,
  searchInputRef,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [sortField, setSortField] = useState("title");
  const sortedTracks = [...tracks].sort((a, b) =>
    sortField === "artist"
      ? a.artist.localeCompare(b.artist)
      : sortField === "dateAdded"
        ? b.dateAdded - a.dateAdded
        : a.title.localeCompare(b.title),
  );
  const minutes = Math.round(
    tracks.reduce((sum, track) => sum + track.duration, 0) / 60,
  );
  const featured = tracks.find((t) => t.isFavorite) || tracks[0];
  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const isAlbums = title === "Albums";
  const albums = [...new Set(sortedTracks.map((t) => t.album))];
  return (
    <div
      className="collection-view"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length) onFilesDropped(e.dataTransfer.files);
      }}
    >
      {isDragOver && (
        <div className="drop-overlay">
          <FolderDown size={48} />
          <h2>Good music belongs here.</h2>
          <p>Drop your audio or lyrics files to add them.</p>
        </div>
      )}
      <div className="collection-content">
        <section className="collection-hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="mint-dot" /> YOUR PERSONAL SOUNDTRACK
            </p>
            <h1>{title}</h1>
            <p className="hero-description">{subtitle}</p>
            <div className="collection-stats">
              <span>{tracks.length} tracks</span>
              <i />{" "}
              <span>
                {minutes < 60
                  ? `${minutes} minutes`
                  : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`}
              </span>
              <i />
              <span>Endless possibilities</span>
            </div>
            <div className="hero-actions">
              <button
                className="primary-button"
                disabled={!tracks.length}
                onClick={() => onPlayAll(sortedTracks, false)}
              >
                <Play size={17} fill="currentColor" /> Play collection
              </button>
              <button
                className="secondary-button"
                disabled={!tracks.length}
                onClick={() => onPlayAll(sortedTracks, true)}
              >
                <Shuffle size={17} /> Shuffle
              </button>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="record">
              <div className="record-label">
                <AudioLines size={32} />
                <span>HIGHFI SELECTS</span>
              </div>
            </div>
            <div className="record-sleeve">
              {featured?.coverArtUrl ? (
                <img src={featured.coverArtUrl} alt="" />
              ) : (
                <Disc3 size={72} />
              )}
              <span className="sleeve-label">IN GOOD COMPANY.</span>
            </div>
            <span className="hero-art-caption">SOUND GOOD. FEEL GOOD.</span>
          </div>
        </section>
        <section className="track-section" aria-label="Tracks">
          <div className="collection-toolbar">
            <div className="section-title">
              <h2>{isAlbums ? "Your albums" : "Your tracks"}</h2>
              <span>{isAlbums ? albums.length : tracks.length}</span>
            </div>
            <button className="text-button" onClick={onTriggerFileInput}>
              <Plus size={17} /> Import music <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="search-sort-row">
            <label className="search-box">
              <Search size={18} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search your collection"
                aria-label="Search your collection"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </label>
            <label className="sort-control">
              <ArrowDownWideNarrow size={17} />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                aria-label="Sort tracks"
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="dateAdded">Recently added</option>
              </select>
            </label>
          </div>
          <div className="format-filters" aria-label="Filter audio format">
            {["all", "hires", "FLAC", "WAV", "DSD", "ALAC", "MP3"].map(
              (fmt) => (
                <button
                  key={fmt}
                  className={formatFilter === fmt ? "selected" : ""}
                  onClick={() => onFormatFilterChange(fmt)}
                  aria-pressed={formatFilter === fmt}
                >
                  {fmt === "all"
                    ? "All formats"
                    : fmt === "hires"
                      ? "Hi-res"
                      : fmt}
                </button>
              ),
            )}
          </div>
          {!tracks.length ? (
            <div className="empty-collection">
              <Music2 size={38} />
              <h3>
                {searchQuery || formatFilter !== "all"
                  ? "No matches just yet."
                  : "Your next favorite is waiting."}
              </h3>
              <p>
                {searchQuery || formatFilter !== "all"
                  ? "Try another search or audio format."
                  : "Import music from your device to start listening."}
              </p>
              <button className="secondary-button" onClick={onTriggerFileInput}>
                <Plus size={17} /> Import music
              </button>
            </div>
          ) : isAlbums ? (
            <div className="album-grid">
              {albums.map((album) => {
                const albumTracks = sortedTracks.filter(
                  (t) => t.album === album,
                );
                return (
                  <button
                    key={album}
                    className="album-card"
                    onClick={() => onPlayAll(albumTracks, false)}
                  >
                    <div>
                      <img src={albumTracks[0].coverArtUrl} alt="" />
                      <span>
                        <Play size={22} fill="currentColor" />
                      </span>
                    </div>
                    <strong>{album}</strong>
                    <small>
                      {albumTracks[0].artist} · {albumTracks.length} tracks
                    </small>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="track-table-heading">
                <span>#</span>
                <span>TRACK</span>
                <span>ALBUM</span>
                <span>QUALITY</span>
                <span>TIME</span>
                <span />
              </div>
              <div className="track-list">
                {sortedTracks.map((track, index) => {
                  const current = track.id === currentTrackId;
                  return (
                    <div
                      key={track.id}
                      className={`track-row ${current ? "current" : ""}`}
                    >
                      <button
                        className="track-number"
                        onClick={() => onPlayTrack(track)}
                        aria-label={`Play ${track.title}`}
                      >
                        {current && isPlaying ? (
                          <AudioLines size={18} />
                        ) : (
                          <>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <Play size={15} fill="currentColor" />
                          </>
                        )}
                      </button>
                      <button
                        className="track-identity"
                        onClick={() => onPlayTrack(track)}
                        aria-label={`Play ${track.title} by ${track.artist}`}
                      >
                        <img src={track.coverArtUrl} alt="" />
                        <span>
                          <strong>{track.title}</strong>
                          <small>
                            {track.artist}
                            <span className="mobile-quality">
                              {" "}
                              · {track.format}
                            </span>
                          </small>
                        </span>
                      </button>
                      <span className="track-album">{track.album}</span>
                      <button
                        className="quality-badge"
                        onClick={() => onInspectTrack(track)}
                        aria-label={`Inspect ${track.title}`}
                      >
                        <span>{track.format}</span>
                        <small>
                          {track.bitDepth}-bit /{" "}
                          {Math.round(track.sampleRate / 1000)} kHz
                        </small>
                      </button>
                      <span className="track-duration">
                        {formatTime(track.duration)}
                      </span>
                      <div className="track-actions">
                        <button
                          className={`icon-button favorite-button ${track.isFavorite ? "favorited" : ""}`}
                          onClick={() => onToggleFavorite(track.id)}
                          aria-label={`${track.isFavorite ? "Unfavorite" : "Favorite"} ${track.title}`}
                          title={
                            track.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                          aria-pressed={!!track.isFavorite}
                        >
                          <Heart
                            size={17}
                            fill={track.isFavorite ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          className="icon-button delete-button"
                          onClick={() => onRemoveTrack(track.id)}
                          aria-label={`Remove ${track.title} from library`}
                          title="Remove from library"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="collection-end">
            Your collection. Your kind of listening.
          </p>
        </section>
      </div>
    </div>
  );
};
