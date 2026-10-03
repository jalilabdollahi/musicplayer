import { LinkedFolder, Track } from '../types/music';
import { isAudioFileName, isLyricsFileName, parseAudioFile } from './audioMetadata';
import { getTrackAudioBlob } from './db';
import { parseLrc } from './lrcParser';

/**
 * Library sources.
 *
 * Linked folders (Chromium only) are read in place through the File System
 * Access API: nothing is copied, and each launch rescans for changes.
 * Everywhere else, files and folders are imported, i.e. copied into
 * IndexedDB, which is the only storage a PWA has there.
 */

type PermissionMode = { mode: 'read' };
type HandleWithPermission = FileSystemHandle & {
  queryPermission(d: PermissionMode): Promise<PermissionState>;
  requestPermission(d: PermissionMode): Promise<PermissionState>;
};
type DirectoryIterable = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
};

export const supportsFolderLinking =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export function newTrackId(): string {
  return `track-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Opens the system folder picker. Resolves null if the user cancels.
 * `startIn` opens it on a known folder (used to re-pick a linked one).
 */
export async function pickFolder(startIn?: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle | null> {
  try {
    const picker = (window as unknown as {
      showDirectoryPicker(o: { id?: string; mode?: 'read'; startIn?: FileSystemHandle }): Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    return await picker(startIn ? { mode: 'read', startIn } : { id: 'music', mode: 'read' });
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Whether the folder can be read right now. With `request`, asks the user
 * (requires a recent click); browsers forget the grant between sessions.
 */
export async function ensureFolderPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const h = handle as unknown as HandleWithPermission;
  try {
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
    if (!request) return false;
    // Two callers can ask at once (a click that both plays a song and
    // triggers the reconnect); share one prompt instead of racing two.
    let pending = pendingRequests.get(handle);
    if (!pending) {
      pending = h
        .requestPermission({ mode: 'read' })
        .then((state) => state === 'granted')
        .catch(() => false)
        .finally(() => pendingRequests.delete(handle));
      pendingRequests.set(handle, pending);
    }
    return await pending;
  } catch {
    return false;
  }
}

const pendingRequests = new WeakMap<FileSystemDirectoryHandle, Promise<boolean>>();

interface FoundFile {
  handle: FileSystemFileHandle;
  relPath: string;
}

/**
 * Collects audio and lyrics files below `dir`. A subfolder that can't be
 * read (system-protected, a cloud placeholder, removed mid-scan) is recorded
 * in `skipped` and passed over, so one bad folder can't fail the whole scan.
 * Errors on the linked folder itself still throw: that folder is unusable.
 */
async function walk(dir: FileSystemDirectoryHandle, prefix: string, out: FoundFile[], skipped: string[]): Promise<void> {
  try {
    for await (const entry of (dir as DirectoryIterable).values()) {
      if (entry.name.startsWith('.')) continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, relPath, out, skipped);
      } else if (isAudioFileName(entry.name) || isLyricsFileName(entry.name)) {
        out.push({ handle: entry as FileSystemFileHandle, relPath });
      }
    }
  } catch (err) {
    if (!prefix) throw err;
    console.warn('Skipping unreadable folder', prefix, err);
    skipped.push(prefix);
  }
}

/** Runs `fn` over `items` with a fixed number of workers. */
async function pool<T>(items: T[], workers: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    }),
  );
}

export interface ScanProgress {
  done: number;
  total: number;
}

export interface ScanResult {
  added: Track[];
  updated: Track[];
  removedIds: string[];
  /** Folders and files that couldn't be read this time. */
  skipped: string[];
}

/** Lyrics files sitting next to a track share its base name. */
function lrcKey(relPath: string): string {
  return relPath.replace(/\.[^/.]+$/, '').toLowerCase();
}

/**
 * Brings the library in line with a linked folder: new files are parsed and
 * added, changed files re-read, and tracks whose file is gone are dropped.
 * Favourites, play counts and edited lyrics survive a re-read.
 */
export async function scanFolder(
  folder: LinkedFolder,
  existing: Track[],
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult> {
  const found: FoundFile[] = [];
  const skippedDirs: string[] = [];
  const skipped: string[] = [];
  await walk(folder.handle, '', found, skippedDirs);

  const audio = found.filter((f) => isAudioFileName(f.relPath) && !folder.excluded?.includes(f.relPath));
  const lyrics = new Map(found.filter((f) => isLyricsFileName(f.relPath)).map((f) => [lrcKey(f.relPath), f.handle]));
  const known = new Map(existing.filter((t) => t.folderId === folder.id).map((t) => [t.relPath, t]));
  const seen = new Set<string>();

  const added: Track[] = [];
  const updated: Track[] = [];
  let done = 0;
  onProgress?.({ done, total: audio.length });

  await pool(audio, 4, async ({ handle, relPath }) => {
    seen.add(relPath);
    try {
      const file = await handle.getFile();
      const previous = known.get(relPath);
      if (previous && previous.fileModified === file.lastModified && previous.fileSize === file.size) return;

      // The folder's own name stands in for the album of loose files.
      const meta = await parseAudioFile(file, `${folder.name}/${relPath}`);
      const track: Track = {
        ...(meta as Track),
        filePath: relPath,
        id: previous?.id ?? newTrackId(),
        playCount: previous?.playCount ?? 0,
        isFavorite: previous?.isFavorite,
        dateAdded: previous?.dateAdded ?? Date.now(),
        source: 'folder',
        folderId: folder.id,
        relPath,
        fileModified: file.lastModified,
        lyrics: previous?.lyrics,
        rawLrc: previous?.rawLrc,
      };

      const lrc = lyrics.get(lrcKey(relPath));
      if (lrc && !track.rawLrc) {
        const text = await (await lrc.getFile()).text();
        track.lyrics = parseLrc(text).lyrics;
        track.rawLrc = text;
      }

      (previous ? updated : added).push(track);
    } catch (err) {
      console.warn('Skipping unreadable file', relPath, err);
      skipped.push(relPath);
    } finally {
      done++;
      onProgress?.({ done, total: audio.length });
    }
  });

  // Songs inside a folder that couldn't be read are kept: the folder is
  // more likely unavailable for now than deleted.
  const inSkippedDir = (path: string) => skippedDirs.some((dir) => path.startsWith(`${dir}/`));
  const removedIds = [...known.entries()]
    .filter(([path]) => !seen.has(path!) && !inSkippedDir(path!))
    .map(([, t]) => t.id);
  return { added, updated, removedIds, skipped: [...skippedDirs, ...skipped] };
}

/**
 * Imports loose files (picker, drag and drop, folder input, OS "Open with").
 * Audio is copied into the track record; matching .lrc files are attached.
 */
export async function importFiles(
  files: { file: File; relPath?: string }[],
  onProgress?: (p: ScanProgress) => void,
): Promise<Track[]> {
  const audio = files.filter((f) => isAudioFileName(f.file.name));
  const lyrics = new Map(
    files.filter((f) => isLyricsFileName(f.file.name)).map((f) => [lrcKey(f.relPath ?? f.file.name), f.file]),
  );

  const tracks: Track[] = [];
  let done = 0;
  onProgress?.({ done, total: audio.length });

  await pool(audio, 4, async ({ file, relPath }) => {
    try {
      const meta = await parseAudioFile(file, relPath);
      const track: Track = {
        ...(meta as Track),
        id: newTrackId(),
        playCount: 0,
        dateAdded: Date.now(),
        source: 'imported',
        audioBlob: file,
      };
      const lrc = lyrics.get(lrcKey(relPath ?? file.name));
      if (lrc) {
        const text = await lrc.text();
        track.lyrics = parseLrc(text).lyrics;
        track.rawLrc = text;
      }
      tracks.push(track);
    } catch (err) {
      console.warn('Skipping unreadable file', file.name, err);
    } finally {
      done++;
      onProgress?.({ done, total: audio.length });
    }
  });

  return tracks;
}

export class FolderPermissionError extends Error {
  constructor(public folder: LinkedFolder) {
    super(`Access to "${folder.name}" needs to be granted again.`);
  }
}

/**
 * Resolves the playable audio for a track: the stored blob for imports, or
 * the file read live from its linked folder.
 */
export async function getTrackAudio(track: Track, folders: LinkedFolder[]): Promise<Blob | null> {
  if (track.audioBlob) return track.audioBlob;

  if (track.source === 'folder' && track.folderId && track.relPath) {
    const folder = folders.find((f) => f.id === track.folderId);
    if (!folder) return null;
    if (!(await ensureFolderPermission(folder.handle, true))) throw new FolderPermissionError(folder);

    const parts = track.relPath.split('/');
    let dir = folder.handle;
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    const handle = await dir.getFileHandle(parts[parts.length - 1]);
    return handle.getFile();
  }

  return getTrackAudioBlob(track.id);
}

/**
 * Grabs the entries of a drop. Must run synchronously inside the drop event:
 * the DataTransfer is emptied as soon as the handler yields.
 */
export function entriesFromDataTransfer(dt: DataTransfer): FileSystemEntry[] {
  return Array.from(dt.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
}

/** Reads dropped entries, walking into folders. */
export async function filesFromEntries(entries: FileSystemEntry[]): Promise<{ file: File; relPath?: string }[]> {
  const out: { file: File; relPath?: string }[] = [];
  const visit = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
      if (!isAudioFileName(entry.name) && !isLyricsFileName(entry.name)) return;
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, relPath });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns results in batches until it yields an empty one.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await visit(child, relPath);
      }
    }
  };
  for (const entry of entries) await visit(entry, '');
  return out;
}

/** Asks the browser not to evict the library under storage pressure. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Not supported; storage stays best-effort.
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}
