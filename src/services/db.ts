import { Track, Playlist, SmartPlaylistRule } from '../types/music';

// Keeps its original name on purpose. The database holds every imported
// track, so renaming it alongside the app would strand an existing library
// behind a name nothing reads any more.
const DB_NAME = 'AuraAudioDB';
const DB_VERSION = 2;

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

// Likewise unchanged: a new key would read as "never seeded" and push the
// demo tracks back into an established library.
const SEEDED_FLAG = 'aura.demoContentSeeded';

/**
 * Whether the bundled demo library has already been written once.
 *
 * Deliberately kept in localStorage rather than an IndexedDB store: it is one
 * boolean, and adding a store would mean a schema version bump, which another
 * open tab can block indefinitely. Losing the flag is harmless - the demo
 * content would simply be seeded once more.
 */
export function hasSeededDemoContent(): boolean {
  try {
    return localStorage.getItem(SEEDED_FLAG) === 'true';
  } catch {
    return false;
  }
}

export function markDemoContentSeeded(): void {
  try {
    localStorage.setItem(SEEDED_FLAG, 'true');
  } catch {
    // Private mode or blocked site data; seeding again is an acceptable cost.
  }
}

/**
 * Save track metadata into IndexedDB
 */
export async function saveTrack(track: Track): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['tracks', 'audioBlobs'], 'readwrite');
  const trackStore = tx.objectStore('tracks');
  const blobStore = tx.objectStore('audioBlobs');

  // Strip transient audioBuffer and audioUrl before saving to IDB
  const { audioBuffer, audioUrl, audioBlob, ...persistableTrack } = track;

  trackStore.put(persistableTrack);

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
    const { audioBuffer, audioUrl, audioBlob, ...persistableTrack } = track;
    trackStore.put(persistableTrack);
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
    request.onsuccess = () => resolve(request.result as Track[]);
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
        const updated = { ...request.result, ...partial };
        store.put(updated);
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
