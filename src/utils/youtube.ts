/**
 * Utility functions for YouTube URL detection, ID extraction, and thumbnail resolution.
 */

export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

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
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
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
  } catch {}

  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

export function getYouTubeThumbnail(videoId: string, quality: 'max' | 'hq' = 'hq'): string {
  if (quality === 'max') {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeBackdrop(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function getYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    disableKb?: boolean;
    mute?: boolean;
    start?: number;
  } = {}
): string {
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
    controls: options.controls !== false ? '1' : '0',
    disablekb: options.disableKb ? '1' : '0',
    autoplay: options.autoplay ? '1' : '0',
    mute: options.mute ? '1' : '0',
  });
  if (options.start && options.start > 0) {
    params.set('start', Math.floor(options.start).toString());
  }
  // youtube-nocookie.com avoids cross-origin iframe issues in preview/embed environments
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
