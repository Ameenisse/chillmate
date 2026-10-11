import posterInterstellar from '../assets/images/poster_interstellar_odyssey_1790834896978.jpg';
import posterDune from '../assets/images/poster_dune_horizon_1790834911813.jpg';
import posterMidnightTokyo from '../assets/images/poster_midnight_tokyo_1790834931649.jpg';
import posterAlpine from '../assets/images/poster_alpine_expedition_1790834944382.jpg';
import backdropCinema from '../assets/images/backdrop_cinema_hall_1790834956424.jpg';
import { DownloadQualityOption, LibraryItem, TeamMember } from '../types';

export const ASSETS = {
  posterInterstellar,
  posterDune,
  posterMidnightTokyo,
  posterAlpine,
  backdropCinema,
};

export const DEFAULT_DOWNLOAD_FORMATS: DownloadQualityOption[] = [
  { id: '1080p', label: '1080p Full HD', ext: 'MP4', sizeBytes: 89128960, resolution: '1920x1080' },
  { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 48234496, resolution: '1280x720' },
  { id: '480p', label: '480p SD', ext: 'MP4', sizeBytes: 25165824, resolution: '854x480' },
  { id: '360p', label: '360p Fast', ext: 'MP4', sizeBytes: 14680064, resolution: '640x360' },
];

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatHumanDuration(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Local File';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export interface WebpageResolutionResult {
  valid: boolean;
  mode: 'DIRECT_VIDEO' | 'EXTRACTED_VIDEO' | 'EMBED' | 'WEBPAGE_FRAME';
  platform: string;
  originalUrl: string;
  title: string;
  description?: string;
  durationMs?: number;
  thumbnailUrl?: string | null;
  playableVideoUrl: string | null;
  embedUrl: string | null;
  proxyUrl: string;
  availableFormats: DownloadQualityOption[];
  isYouTube?: boolean;
  youTubeId?: string;
  reason?: string;
}

export function parseYouTubeVideoId(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // 1. Bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. YouTube Thumbnail URL
  const thumbMatch = trimmed.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([a-zA-Z0-9_-]{11})/i);
  if (thumbMatch?.[1]) return thumbMatch[1];

  // 3. YouTube standard patterns
  const patterns = [
    /(?:youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/i,
    /[?&]v=([a-zA-Z0-9_-]{11})/i,
    /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }

  try {
    const withProto =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const id = parsed.pathname.slice(1).split('/')[0];
      if (id && id.length >= 11) return id.slice(0, 11);
    }
    if (host.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && v.length >= 11) return v.slice(0, 11);
      const parts = parsed.pathname.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        if (['shorts', 'embed', 'live', 'v'].includes(parts[i].toLowerCase()) && parts[i + 1]) {
          return parts[i + 1].slice(0, 11);
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function resolveYouTubeVideoId(sources: {
  videoUrl?: string | null;
  embedUrl?: string | null;
  originalPageUrl?: string | null;
  posterUrl?: string | null;
}): string | null {
  return (
    parseYouTubeVideoId(sources.videoUrl) ||
    parseYouTubeVideoId(sources.embedUrl) ||
    parseYouTubeVideoId(sources.originalPageUrl) ||
    parseYouTubeVideoId(sources.posterUrl) ||
    null
  );
}

/**
 * Inspect and resolve both direct media URLs (.mp4, .m3u8, .webm, .mkv, .mov) AND any external video link
 * (MovieBox, YouTube, Vimeo, Dailymotion, Google Drive, Dropbox, Streamable, TikTok, Internet Archive, or any video source)
 * into a playable video stream, along with downloadable quality options.
 */
export function sanitizeVideoInputUrl(rawUrl: string): string {
  return String(rawUrl || '')
    .trim()
    .replace(/^['"<(]+/, '')
    .replace(/[.,;:!?)+>\]'"]+$/, '')
    .trim();
}

export async function resolveWebpageOrMediaUrl(
  rawUrl: string
): Promise<WebpageResolutionResult> {
  const trimmed = sanitizeVideoInputUrl(rawUrl);
  if (!trimmed) {
    return {
      valid: false,
      mode: 'DIRECT_VIDEO',
      platform: 'Unknown',
      originalUrl: '',
      title: '',
      thumbnailUrl: null,
      playableVideoUrl: null,
      embedUrl: null,
      proxyUrl: '',
      availableFormats: DEFAULT_DOWNLOAD_FORMATS,
      reason: 'Please enter a video link or stream URL.',
    };
  }

  // Fast resolution for YouTube video URLs, short URLs (youtu.be), shorts, and direct IDs (preserves case)
  const detectedYtId = parseYouTubeVideoId(trimmed);
  if (detectedYtId) {
    const canonicalYtUrl = `https://www.youtube.com/watch?v=${detectedYtId}`;
    const ytEmbedUrl = `https://www.youtube.com/embed/${detectedYtId}?autoplay=1&playsinline=1&enablejsapi=1&controls=1&rel=0&modestbranding=1&iv_load_policy=3&fs=1`;
    let ytTitle = `YouTube Video (${detectedYtId})`;

    // Try fast asynchronous oEmbed title resolution
    try {
      const oembedRes = await fetch(
        `https://noembed.com/embed?url=${encodeURIComponent(canonicalYtUrl)}`,
        { signal: AbortSignal.timeout(1800) }
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { title?: string };
        if (oembed?.title) ytTitle = oembed.title;
      }
    } catch {
      // Fallback: title remains YouTube Video
    }

    return {
      valid: true,
      mode: 'DIRECT_VIDEO',
      platform: 'YouTube Video',
      originalUrl: canonicalYtUrl,
      title: ytTitle,
      thumbnailUrl: `https://i.ytimg.com/vi/${detectedYtId}/hqdefault.jpg`,
      playableVideoUrl: canonicalYtUrl,
      embedUrl: ytEmbedUrl,
      proxyUrl: canonicalYtUrl,
      isYouTube: true,
      youTubeId: detectedYtId,
      availableFormats: [
        { id: '1080p', label: '1080p Full HD', ext: 'MP4', sizeBytes: 94371840, resolution: '1920x1080', videoUrl: canonicalYtUrl },
        { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 52428800, resolution: '1280x720', videoUrl: canonicalYtUrl },
        { id: '480p', label: '480p SD', ext: 'MP4', sizeBytes: 28311552, resolution: '854x480', videoUrl: canonicalYtUrl },
        { id: '360p', label: '360p Fast', ext: 'MP4', sizeBytes: 15728640, resolution: '640x360', videoUrl: canonicalYtUrl },
      ],
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith('http') || trimmed.startsWith('blob:') ? trimmed : `https://${trimmed}`);
  } catch {
    return {
      valid: false,
      mode: 'DIRECT_VIDEO',
      platform: 'Unknown',
      originalUrl: trimmed,
      title: '',
      thumbnailUrl: null,
      playableVideoUrl: null,
      embedUrl: null,
      proxyUrl: '',
      availableFormats: DEFAULT_DOWNLOAD_FORMATS,
      reason: 'Invalid video URL format.',
    };
  }

  const normalizedUrl = parsed.toString();
  const pathname = parsed.pathname.toLowerCase();

  // Direct media file extensions
  const isDirectMediaExt =
    pathname.endsWith('.mp4') ||
    pathname.endsWith('.webm') ||
    pathname.endsWith('.m3u8') ||
    pathname.endsWith('.mpd') ||
    pathname.endsWith('.ogg') ||
    pathname.endsWith('.mov') ||
    pathname.endsWith('.mkv') ||
    normalizedUrl.startsWith('blob:');

  if (isDirectMediaExt) {
    const fileTitle = decodeURIComponent(pathname.split('/').pop() || 'Direct Video Stream').replace(
      /\.(mp4|webm|m3u8|mpd|ogg|mov|mkv)$/i,
      ''
    );
    const isHls = pathname.endsWith('.m3u8');
    const isBlob = normalizedUrl.startsWith('blob:');
    const proxiedIfCrossOrigin =
      isBlob || isHls
        ? normalizedUrl
        : `/api/video/stream?url=${encodeURIComponent(normalizedUrl)}&referer=${encodeURIComponent(
            parsed.origin + '/'
          )}`;
    return {
      valid: true,
      mode: 'DIRECT_VIDEO',
      platform: parsed.hostname || 'Direct Stream',
      originalUrl: normalizedUrl,
      title: fileTitle || 'Direct Video Stream',
      thumbnailUrl: null,
      playableVideoUrl: proxiedIfCrossOrigin,
      embedUrl: null,
      proxyUrl: proxiedIfCrossOrigin,
      availableFormats: [
        { id: '1080p', label: '1080p Original Stream', ext: isHls ? 'HLS' : 'MP4', sizeBytes: 92274688, resolution: '1920x1080', videoUrl: proxiedIfCrossOrigin },
        { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 51380224, resolution: '1280x720', videoUrl: proxiedIfCrossOrigin },
        { id: '480p', label: '480p SD', ext: 'MP4', sizeBytes: 27262976, resolution: '854x480', videoUrl: proxiedIfCrossOrigin },
      ],
    };
  }

  // Query backend Universal Video Extractor for any other link (MovieBox, Vimeo, Archive.org, Dailymotion, Google Drive, Dropbox, Streamable, TikTok, or any custom link)
  try {
    const res = await fetch('/api/webpage/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl }),
    });
    if (res.ok) {
      const data = await res.json();
      const ytId = data.youTubeId || detectedYtId || parseYouTubeVideoId(data.extractedVideoUrl);
      if (ytId) {
        const canonicalYtUrl = `https://www.youtube.com/watch?v=${ytId}`;
        const ytEmbedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`;
        return {
          valid: true,
          mode: 'DIRECT_VIDEO',
          platform: 'YouTube Video',
          originalUrl: canonicalYtUrl,
          title: data.title || `YouTube Video (${ytId})`,
          thumbnailUrl: data.thumbnailUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          playableVideoUrl: canonicalYtUrl,
          embedUrl: ytEmbedUrl,
          proxyUrl: canonicalYtUrl,
          isYouTube: true,
          youTubeId: ytId,
          availableFormats: [
            { id: '1080p', label: '1080p Full HD', ext: 'MP4', sizeBytes: 94371840, resolution: '1920x1080', videoUrl: canonicalYtUrl },
            { id: '720p', label: '720p HD', ext: 'MP4', sizeBytes: 52428800, resolution: '1280x720', videoUrl: canonicalYtUrl },
            { id: '480p', label: '480p SD', ext: 'MP4', sizeBytes: 28311552, resolution: '854x480', videoUrl: canonicalYtUrl },
            { id: '360p', label: '360p Fast', ext: 'MP4', sizeBytes: 15728640, resolution: '640x360', videoUrl: canonicalYtUrl },
          ],
        };
      }

      const directStream =
        data.extractedVideoUrl ||
        `/api/video/stream?url=${encodeURIComponent(normalizedUrl)}`;
      return {
        valid: true,
        mode: data.mode || 'DIRECT_VIDEO',
        platform: data.platform || parsed.hostname,
        originalUrl: normalizedUrl,
        title: data.title || parsed.hostname,
        description: data.description,
        durationMs: typeof data.durationMs === 'number' && data.durationMs > 0 ? data.durationMs : undefined,
        thumbnailUrl: data.thumbnailUrl || null,
        playableVideoUrl: directStream,
        embedUrl: data.embedUrl || null,
        proxyUrl: directStream,
        availableFormats:
          Array.isArray(data.availableFormats) && data.availableFormats.length > 0
            ? data.availableFormats
            : DEFAULT_DOWNLOAD_FORMATS,
      };
    }
  } catch {
    // Fallback below
  }

  const fallbackStream = `/api/video/stream?url=${encodeURIComponent(normalizedUrl)}`;
  return {
    valid: true,
    mode: 'DIRECT_VIDEO',
    platform: parsed.hostname,
    originalUrl: normalizedUrl,
    title: parsed.hostname,
    thumbnailUrl: null,
    playableVideoUrl: fallbackStream,
    embedUrl: normalizedUrl,
    proxyUrl: fallbackStream,
    availableFormats: DEFAULT_DOWNLOAD_FORMATS,
  };
}

export const DEFAULT_LIBRARY_ITEMS: LibraryItem[] = [];

export const DEFAULT_TEAM_MEMBERS: TeamMember[] = [];
