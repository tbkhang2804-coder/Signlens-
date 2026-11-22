const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeId(inputUrl: string): string | null {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const clean = inputUrl.trim();
  if (!clean) return null;

  if (YOUTUBE_ID_REGEX.test(clean)) {
    return clean;
  }

  try {
    const parsed = new URL(clean);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return null;

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let candidate: string | null = null;

    if (host === 'youtu.be') {
      candidate = parsed.pathname.split('/').filter(Boolean)[0] || null;
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = parsed.searchParams.get('v');
      if (vParam) {
        candidate = vParam;
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
          candidate = parts[1];
        }
      }
    }

    if (candidate && YOUTUBE_ID_REGEX.test(candidate)) {
      return candidate;
    }
  } catch {
    const fallbackMatch = clean.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
    );
    if (fallbackMatch && YOUTUBE_ID_REGEX.test(fallbackMatch[1])) {
      return fallbackMatch[1];
    }
  }

  return null;
}

export function getYouTubeThumbnailUrl(youtubeId: string): string {
  if (!YOUTUBE_ID_REGEX.test(youtubeId)) return '';
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(youtubeId: string): string {
  if (!YOUTUBE_ID_REGEX.test(youtubeId)) return '';
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`;
}

export function getYouTubeWatchUrl(youtubeId: string): string {
  if (!YOUTUBE_ID_REGEX.test(youtubeId)) return 'https://www.youtube.com';
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}
