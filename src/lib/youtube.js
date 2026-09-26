const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (YOUTUBE_ID_PATTERN.test(input)) return input;

  try {
    const normalized = input.startsWith('http://') || input.startsWith('https://')
      ? input
      : `https://${input}`;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] || '';
      return YOUTUBE_ID_PATTERN.test(id) ? id : '';
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const direct = url.searchParams.get('v') || '';
      if (YOUTUBE_ID_PATTERN.test(direct)) return direct;

      const parts = url.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
      const id = markerIndex >= 0 ? parts[markerIndex + 1] || '' : '';
      return YOUTUBE_ID_PATTERN.test(id) ? id : '';
    }
  } catch {
    return '';
  }

  return '';
}

export function buildYouTubeWatchUrl(videoId) {
  return YOUTUBE_ID_PATTERN.test(String(videoId || ''))
    ? `https://www.youtube.com/watch?v=${videoId}`
    : '';
}

export function buildYouTubeEmbedUrl(videoId) {
  return YOUTUBE_ID_PATTERN.test(String(videoId || ''))
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1`
    : '';
}

export function buildYouTubeThumbnailUrl(videoId) {
  return YOUTUBE_ID_PATTERN.test(String(videoId || ''))
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : '';
}

export function describeYouTubePlayerError(code) {
  const numericCode = Number(code || 0);
  const messages = {
    2: 'معرّف فيديو YouTube غير صحيح.',
    5: 'المتصفح لم يتمكن من تشغيل الفيديو بصيغة HTML5. جرّب تحديث الصفحة أو متصفحًا آخر.',
    100: 'الفيديو غير موجود، أو تم حذفه، أو تم ضبطه كفيديو خاص.',
    101: 'صاحب الفيديو منع تشغيله داخل المواقع. استخدم فيديو من قناتك وفعّل خيار السماح بالتضمين.',
    150: 'صاحب الفيديو منع تشغيله داخل المواقع. استخدم فيديو من قناتك وفعّل خيار السماح بالتضمين.',
    153: 'YouTube لم يستلم هوية الموقع بشكل صحيح. تأكد من فتح المنصة عبر رابط http أو https وليس ملفًا محليًا مباشرًا.',
  };

  return {
    code: numericCode,
    message: messages[numericCode] || 'تعذر تشغيل فيديو YouTube. تأكد أن الفيديو متاح ويسمح بالتضمين داخل المواقع.',
  };
}
