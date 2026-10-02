import { Track, Playlist, LinkedFolder } from '../types/music';

// Keeps its original name on purpose. The database holds every imported
// track, so renaming it alongside the app would strand an existing library
// behind a name nothing reads any more.
const DB_NAME = 'AuraAudioDB';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('tracks')) {
        const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
        trackStore.createIndex('format', 'format', { unique: false });
        trackStore.createIndex('genre', 'genre', { unique: false });
        trackStore.createIndex('isFavorite', 'isFavorite', { unique: false });
        trackStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      }

      if (!db.objectStoreNames.contains('playlists')) {
        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
        playlistStore.createIndex('isSmart', 'isSmart', { unique: false });
      }

      if (!db.objectStoreNames.contains('audioBlobs')) {
        db.createObjectStore('audioBlobs', { keyPath: 'trackId' });
      }

      // v3: directories linked through the File System Access API. Handles
      // are structured-cloneable, so they persist across sessions here.
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab later opens a newer schema version, release this
      // connection so its upgrade can proceed instead of blocking forever.
      db.onversionchange = () => db.close();
      resolve(db);
    };

    request.onerror = () => {
      reject(request.error);
    };

    // Another tab is holding an older connection open. Without this the open
    // request just hangs and the library silently comes up empty.
    request.onblocked = () => {
      reject(
        new Error(
          'AuraAudioDB upgrade is blocked by another open tab. Close other copies of the app and reload.'
        )
      );
    };
  });

  return dbPromise;
}

/**
 * Earlier builds seeded synthesized demo tracks and a few showcase smart
 * playlists. The library is now real files only, so they are removed once.
 */
const DEMO_PLAYLIST_IDS = [
  'smart-hires-masters',
  'smart-late-night-chill',
  'smart-high-energy-flow',
  'smart-audiophile-favorites',
];

export function isDemoTrack(track: Track): boolean {
  return track.id.startsWith('demo-');
}

export function isDemoPlaylist(playlist: Playlist): boolean {
  return DEMO_PLAYLIST_IDS.includes(playlist.id);
}

/**
 * Strips the runtime-only fields off a track before it is written. The cover
 * object URL dies with the page, so only the artwork blob is kept.
 */
function toRecord(track: Track) {
  const { audioUrl, audioBlob, coverArtUrl, ...record } = track;
  return {
    record: coverArtUrl && !coverArtUrl.startsWith('blob:') ? { ...record, coverArtUrl } : record,
    audioBlob,
  };
}

/** Gives a stored record a live artwork URL. */
function fromRecord(record: Track): Track {
  if (record.coverArtBlob) {
    return { ...record, coverArtUrl: URL.createObjectURL(record.coverArtBlob) };
  }
  // Object URLs saved by older builds are dead after a reload.
  if (record.coverArtUrl?.startsWith('blob:')) {
    const { coverArtUrl, ...rest } = record;
    return rest;
  }
  return record;
}

/**
 * Save track metadata into IndexedDB
 */
export async function saveTrack(track: Track): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  const trackStore = tx.objectStore('tracks');
  const blobStore = tx.objectStore('audioBlobs');

  const { record, audioBlob } = toRecord(track);
  trackStore.put(record);

  if (audioBlob) {
    blobStore.put({ trackId: track.id, blob: audioBlob });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save multiple tracks in one batch transaction
 */
export async function saveTracks(tracks: Track[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  const trackStore = tx.objectStore('tracks');
  const blobStore = tx.objectStore('audioBlobs');

  for (const track of tracks) {
    const { record, audioBlob } = toRecord(track);
    trackStore.put(record);
    if (audioBlob) {
      blobStore.put({ trackId: track.id, blob: audioBlob });
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieve all tracks from IDB
 */
export async function getAllTracks(): Promise<Track[]> {
  const db = await getDB();
  const tx = db.transaction(['tracks'], 'readonly');
  const store = tx.objectStore('tracks');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as Track[]).map(fromRecord));
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve audio Blob for a track
 */
export async function getTrackAudioBlob(trackId: string): Promise<Blob | null> {
  const db = await getDB();
  const tx = db.transaction(['audioBlobs'], 'readonly');
  const store = tx.objectStore('audioBlobs');
  const request = store.get(trackId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result ? request.result.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a track
 */
export async function deleteTrack(trackId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  tx.objectStore('tracks').delete(trackId);
  tx.objectStore('audioBlobs').delete(trackId);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete several tracks in one transaction (folder rescans, demo cleanup).
 */
export async function deleteTracks(trackIds: string[]): Promise<void> {
  if (trackIds.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  for (const id of trackIds) {
    tx.objectStore('tracks').delete(id);
    tx.objectStore('audioBlobs').delete(id);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Update track fields (e.g. lyrics, favorite, playCount)
 */
export async function updateTrack(trackId: string, partial: Partial<Track>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks'], 'readwrite');
  const store = tx.objectStore('tracks');
  const request = store.get(trackId);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      if (request.result) {
        const { coverArtUrl, audioBlob, audioUrl, ...persistable } = partial;
        store.put({ ...request.result, ...persistable });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Save playlist
 */
export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['playlists'], 'readwrite');
  tx.objectStore('playlists').put(playlist);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all playlists
 */
export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  const tx = db.transaction(['playlists'], 'readonly');
  const store = tx.objectStore('playlists');
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as Playlist[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete playlist
 */
export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['playlists'], 'readwrite');
  tx.objectStore('playlists').delete(playlistId);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Linked folders
 */
export async function getAllFolders(): Promise<LinkedFolder[]> {
  const db = await getDB();
  const request = db.transaction(['folders'], 'readonly').objectStore('folders').getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as LinkedFolder[]);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolder(folder: LinkedFolder): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['folders'], 'readwrite');
  tx.objectStore('folders').put(folder);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['folders'], 'readwrite');
  tx.objectStore('folders').delete(folderId);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
