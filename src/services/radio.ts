import { AudioFormat, Track } from '../types/music';

/**
 * Live radio. Stations play straight from the broadcaster's own stream: nothing
 * is proxied or stored by this app. Stations are never saved to the library
 * (they have no file, no duration and no play count); they only exist as Track
 * objects in the play queue.
 */

export type RadioCategory = 'news' | 'culture' | 'classical' | 'pop' | 'rock' | 'oldies' | 'electronic' | 'chill';

export const RADIO_CATEGORIES: { id: RadioCategory; label: string }[] = [
  { id: 'pop', label: 'Pop & hits' },
  { id: 'news', label: 'News & talk' },
  { id: 'culture', label: 'Culture' },
  { id: 'classical', label: 'Classical' },
  { id: 'rock', label: 'Rock & indie' },
  { id: 'oldies', label: 'Oldies & Schlager' },
  { id: 'electronic', label: 'Electronic' },
  { id: 'chill', label: 'Jazz & chill' },
];

export interface RadioStation {
  id: string;
  name: string;
  /** Short description shown under the name. */
  subtitle: string;
  url: string;
  format: AudioFormat;
  /** kbps; 0 when the broadcaster doesn't say. */
  bitrate: number;
  category?: RadioCategory;
}

const RADIO_ID_PREFIX = 'radio:';
/** Stations from the Radio Browser directory carry its uuid after this prefix. */
const DIRECTORY_ID_PREFIX = `${RADIO_ID_PREFIX}rb:`;

export const isRadioId = (id: string): boolean => id.startsWith(RADIO_ID_PREFIX);

function station(
  slug: string,
  name: string,
  category: RadioCategory,
  subtitle: string,
  url: string,
  bitrate = 128,
  format: AudioFormat = 'MP3',
): RadioStation {
  return { id: `${RADIO_ID_PREFIX}${slug}`, name, category, subtitle, url, bitrate, format };
}

export const GERMAN_STATIONS: RadioStation[] = [
  // Pop & hits
  station('swr3', 'SWR3', 'pop', 'Pop · Baden-Württemberg, Rheinland-Pfalz', 'https://liveradio.swr.de/sw282p3/swr3/play.mp3'),
  station('bayern3', 'Bayern 3', 'pop', 'Pop · Bavaria', 'https://dispatcher.rndfnk.com/br/br3/live/mp3/mid'),
  station('1live', '1LIVE', 'pop', 'Young hits · North Rhine-Westphalia', 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3'),
  station('wdr2', 'WDR 2', 'pop', 'Pop & news · North Rhine-Westphalia', 'https://wdr-wdr2-rheinland.icecastssl.wdr.de/wdr/wdr2/rheinland/mp3/128/stream.mp3'),
  station('ndr2', 'NDR 2', 'pop', 'Pop · Northern Germany', 'https://icecast.ndr.de/ndr/ndr2/niedersachsen/mp3/128/stream.mp3'),
  station('njoy', 'N-JOY', 'pop', 'Young hits · Northern Germany', 'https://icecast.ndr.de/ndr/njoy/live/mp3/128/stream.mp3'),
  station('hr3', 'hr3', 'pop', 'Pop · Hesse', 'https://dispatcher.rndfnk.com/hr/hr3/live/mp3/high'),
  station('dasding', 'DASDING', 'pop', 'Young hits · Southwest Germany', 'https://liveradio.swr.de/sw282p3/dasding/play.mp3'),
  station('bremenvier', 'Bremen Vier', 'pop', 'Pop · Bremen', 'https://icecast.radiobremen.de/rb/bremenvier/live/mp3/128/stream.mp3'),
  station('antennebayern', 'ANTENNE BAYERN', 'pop', 'Hits · Bavaria', 'https://stream.antenne.de/antenne/stream/mp3'),
  station('ffn', 'radio ffn', 'pop', 'Hits · Lower Saxony', 'https://player.ffn.de/radioffn.mp3', 192),
  station('bigfm', 'bigFM', 'pop', 'Hip-hop & dance · Nationwide', 'https://stream.bigfm.de/deutschland/mp3-128/radio-browser'),

  // News & talk
  station('dlf', 'Deutschlandfunk', 'news', 'News & information · Nationwide', 'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3?aggregator=web'),
  station('br24', 'BR24', 'news', 'News · Bavaria', 'https://dispatcher.rndfnk.com/br/br24/live/mp3/mid'),
  station('ndrinfo', 'NDR Info', 'news', 'News · Northern Germany', 'https://icecast.ndr.de/ndr/ndrinfo/niedersachsen/mp3/128/stream.mp3'),
  station('wdr5', 'WDR 5', 'news', 'Talk & information · North Rhine-Westphalia', 'https://wdr-wdr5-live.icecastssl.wdr.de/wdr/wdr5/live/mp3/128/stream.mp3'),
  station('hrinfo', 'hr-iNFO', 'news', 'News · Hesse', 'https://dispatcher.rndfnk.com/hr/hrinfo/live/mp3/high'),
  station('rbb888', 'rbb 88.8', 'news', 'City radio · Berlin', 'https://dispatcher.rndfnk.com/rbb/rbb888/live/mp3/mid'),

  // Culture
  station('dlfkultur', 'Deutschlandfunk Kultur', 'culture', 'Culture · Nationwide', 'https://st02.sslstream.dlf.de/dlf/02/128/mp3/stream.mp3?aggregator=web'),
  station('dlfnova', 'Deutschlandfunk Nova', 'culture', 'Knowledge & music · Nationwide', 'https://st03.sslstream.dlf.de/dlf/03/128/mp3/stream.mp3?aggregator=web'),
  station('bayern2', 'Bayern 2', 'culture', 'Culture · Bavaria', 'https://dispatcher.rndfnk.com/br/br2/live/mp3/mid'),
  station('swrkultur', 'SWR Kultur', 'culture', 'Culture · Southwest Germany', 'https://liveradio.swr.de/sw282p3/swrkultur/play.mp3'),

  // Classical
  station('brklassik', 'BR-KLASSIK', 'classical', 'Classical · Bavaria', 'https://dispatcher.rndfnk.com/br/brklassik/live/mp3/high', 256),
  station('wdr3', 'WDR 3', 'classical', 'Classical & culture · North Rhine-Westphalia', 'https://wdr-wdr3-live.icecastssl.wdr.de/wdr/wdr3/live/mp3/256/stream.mp3', 256),
  station('ndrkultur', 'NDR Kultur', 'classical', 'Classical & culture · Northern Germany', 'https://icecast.ndr.de/ndr/ndrkultur/live/mp3/128/stream.mp3'),
  station('klassikradio', 'Klassik Radio', 'classical', 'Classical & film music · Nationwide', 'https://live.streams.klassikradio.de/klassikradio-deutschland/stream/mp3', 0),

  // Rock & indie
  station('rockantenne', 'ROCK ANTENNE', 'rock', 'Rock · Nationwide', 'https://stream.rockantenne.de/rockantenne/stream/mp3'),
  station('bytefm', 'ByteFM', 'rock', 'Indie & alternative · Hamburg', 'https://bytefm.cast.addradio.de/bytefm/main/high/stream', 192),
  station('radioeins', 'radioeins', 'rock', 'Adult alternative · Berlin', 'https://dispatcher.rndfnk.com/rbb/radioeins/live/mp3/mid'),
  station('fritz', 'Fritz', 'rock', 'Young alternative · Berlin', 'https://dispatcher.rndfnk.com/rbb/fritz/live/mp3/mid'),

  // Oldies & Schlager
  station('wdr4', 'WDR 4', 'oldies', 'Oldies · North Rhine-Westphalia', 'https://wdr-wdr4-live.icecastssl.wdr.de/wdr/wdr4/live/mp3/128/stream.mp3'),
  station('oldieantenne', 'OLDIE ANTENNE', 'oldies', 'Oldies · Nationwide', 'https://s1-webradio.oldie-antenne.de/oldie-antenne'),
  station('schlagerparadies', 'Schlagerparadies', 'oldies', 'Schlager · Nationwide', 'https://webstream.schlagerparadies.de/schlager30842', 192),

  // Electronic
  station('technobase', 'TechnoBase.FM', 'electronic', 'Techno & hard dance', 'https://listener3.mp3.tb-group.fm/tb.mp3', 192),
  station('sunshinemelodic', 'sunshine live · Melodic Techno', 'electronic', 'Melodic techno', 'https://stream.sunshine-live.de/melodic-techno/mp3-128/stream.sunshine-live.de/'),

  // Jazz & chill
  station('smoothjazz', '0N Smooth Jazz', 'chill', 'Smooth jazz', 'https://0n-smoothjazz.radionetz.de/0n-smoothjazz.aac', 64, 'AAC'),
  station('lofifocus', 'bigFM LoFi Focus', 'chill', 'Lo-fi beats', 'https://stream.bigfm.de/lofifocus/mp3-128/radiobrowser'),
];

export function stationToTrack(s: RadioStation, isFavorite: boolean): Track {
  return {
    id: s.id,
    title: s.name,
    artist: s.subtitle,
    // Artwork colours are seeded from the album, so each station gets its own.
    album: s.name,
    duration: 0,
    format: s.format,
    sampleRate: 0,
    bitDepth: 0,
    channels: 0,
    bitrate: s.bitrate,
    genre: '',
    audioUrl: s.url,
    isFavorite,
    playCount: 0,
    dateAdded: 0,
    isHiRes: false,
    source: 'radio',
  };
}

export function trackToStation(t: Track): RadioStation {
  return {
    id: t.id,
    name: t.title,
    subtitle: t.artist,
    url: t.audioUrl ?? '',
    format: t.format,
    bitrate: t.bitrate,
  };
}

// ---------------------------------------------------------------- Favorites

const FAVORITES_KEY = 'highfi.radioFavorites';

export function loadFavoriteStations(): RadioStation[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s: RadioStation) => isRadioId(s?.id ?? '') && isSecureUrl(s?.url));
  } catch {
    return [];
  }
}

export function saveFavoriteStations(stations: RadioStation[]): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(stations));
  } catch {
    // Storage full or blocked; favorites last until the app closes.
  }
}

// ---------------------------------------------------------------- Directory search

/** Radio Browser is a community directory; any of its mirrors can answer. */
const DIRECTORY_HOSTS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'all.api.radio-browser.info'];

const SEARCH_LIMIT = 40;

const CODEC_FORMATS: Record<string, AudioFormat> = {
  MP3: 'MP3',
  AAC: 'AAC',
  'AAC+': 'AAC',
  OGG: 'OGG',
  OPUS: 'OPUS',
};

interface DirectoryStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  tags: string;
  state: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  clickcount: number;
}

/** The app is served over HTTPS, where browsers refuse plain-HTTP audio. */
function isSecureUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith('https://');
}

function directorySubtitle(s: DirectoryStation): string {
  const tags = s.tags
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag && tag.length <= 24)
    .slice(0, 2);
  const label = tags.map((tag) => tag[0].toUpperCase() + tag.slice(1)).join(', ');
  return [label, s.state.trim()].filter(Boolean).join(' · ') || 'Germany';
}

function fromDirectory(s: DirectoryStation): RadioStation | null {
  const format = CODEC_FORMATS[s.codec?.toUpperCase()];
  const name = s.name?.trim();
  // HLS needs a player library outside Safari, so those streams are left out.
  if (!format || !name || s.hls || !s.lastcheckok || !isSecureUrl(s.url_resolved)) return null;
  return {
    id: `${DIRECTORY_ID_PREFIX}${s.stationuuid}`,
    name,
    subtitle: directorySubtitle(s),
    url: s.url_resolved,
    format,
    bitrate: s.bitrate || 0,
  };
}

async function fetchDirectory(path: string, signal?: AbortSignal): Promise<Response> {
  let lastError: unknown;
  for (const host of DIRECTORY_HOSTS) {
    try {
      const response = await fetch(`https://${host}/json/${path}`, { signal });
      if (response.ok) return response;
      lastError = new Error(`${host} answered ${response.status}`);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/** German stations whose name or genre tag matches, most listened first. */
export async function searchGermanStations(query: string, signal?: AbortSignal): Promise<RadioStation[]> {
  const search = async (field: 'name' | 'tag'): Promise<DirectoryStation[]> => {
    const params = new URLSearchParams({
      [field]: query,
      countrycode: 'DE',
      hidebroken: 'true',
      is_https: 'true',
      order: 'clickcount',
      reverse: 'true',
      limit: String(SEARCH_LIMIT),
    });
    const response = await fetchDirectory(`stations/search?${params}`, signal);
    return (await response.json()) as DirectoryStation[];
  };

  const [byName, byTag] = await Promise.all([search('name'), search('tag')]);
  const ranked = [...byName, ...byTag].sort((a, b) => b.clickcount - a.clickcount);

  // The directory lists one station many times, once per listener-submitted entry.
  const seen = new Set<string>();
  const stations: RadioStation[] = [];
  for (const entry of ranked) {
    const found = fromDirectory(entry);
    if (!found) continue;
    const key = found.name.toLowerCase();
    if (seen.has(key) || seen.has(found.url)) continue;
    seen.add(key);
    seen.add(found.url);
    stations.push(found);
  }
  return stations.slice(0, SEARCH_LIMIT);
}

/** The directory ranks stations by plays and asks clients to report them. */
export function reportStationPlay(s: RadioStation): void {
  if (!s.id.startsWith(DIRECTORY_ID_PREFIX)) return;
  fetchDirectory(`url/${encodeURIComponent(s.id.slice(DIRECTORY_ID_PREFIX.length))}`).catch(() => {
    // Only a popularity count; playback doesn't depend on it.
  });
}
