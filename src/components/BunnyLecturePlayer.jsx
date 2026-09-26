import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

let playerJsPromise;

function loadPlayerJs() {
  if (window.playerjs?.Player) return Promise.resolve(window.playerjs);
  if (playerJsPromise) return playerJsPromise;

  playerJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-bunny-playerjs="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.playerjs), { once: true });
      existing.addEventListener('error', () => reject(new Error('تعذر تحميل مشغل المحاضرة.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js';
    script.async = true;
    script.dataset.bunnyPlayerjs = 'true';
    script.onload = () => resolve(window.playerjs);
    script.onerror = () => reject(new Error('تعذر تحميل مشغل المحاضرة.'));
    document.head.appendChild(script);
  });

  return playerJsPromise;
}

async function readFunctionError(error) {
  try {
    const response = error?.context;
    if (response?.clone) {
      const payload = await response.clone().json();
      if (payload?.code === 'lecture_access_denied') {
        return 'تعذر التحقق من صلاحية المشاهدة. جرّب تسجيل الدخول من جديد.';
      }
      if (payload?.code === 'bunny_secrets_missing' || payload?.code === 'supabase_environment_missing') {
        return 'المحاضرة غير متاحة مؤقتًا. حاول مرة أخرى بعد قليل.';
      }
      if (payload?.code === 'not_bunny_source') {
        return 'مصدر المحاضرة غير جاهز حاليًا.';
      }
      if (payload?.code === 'playback_rpc_failed') {
        return 'تعذر التحقق من صلاحية المشاهدة حاليًا.';
      }
    }
  } catch {
    // Keep student-facing errors intentionally generic.
  }
  return 'تعذر تجهيز المحاضرة حاليًا. حاول مرة أخرى.';
}

export default function BunnyLecturePlayer({
  lectureId,
  title,
  controllerRef,
  onProgress,
  onEnded,
  onReady,
  onError,
}) {
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const lastSecondRef = useRef(0);
  const [embedUrl, setEmbedUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;

    async function getSecureEmbed() {
      setLoading(true);
      setErrorMessage('');
      setEmbedUrl('');

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const headers = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined;

        const { data, error } = await supabase.functions.invoke('get-bunny-embed', {
          body: { lectureId },
          headers,
        });

        if (error) {
          const message = await readFunctionError(error);
          throw new Error(message);
        }

        if (!data?.embedUrl) {
          throw new Error('تعذر إنشاء جلسة المشاهدة الآمنة.');
        }

        if (active) setEmbedUrl(data.embedUrl);
      } catch (error) {
        const message = error?.message || 'تعذر تجهيز المحاضرة حاليًا.';
        if (active) {
          setErrorMessage(message);
          onError?.(message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    getSecureEmbed();
    return () => { active = false; };
  }, [lectureId, onError]);

  useEffect(() => {
    if (!embedUrl || !iframeRef.current) return undefined;
    let active = true;
    let player;

    async function connectPlayer() {
      try {
        const playerjs = await loadPlayerJs();
        if (!active || !iframeRef.current || !playerjs?.Player) return;

        player = new playerjs.Player(iframeRef.current);
        playerRef.current = player;

        const controller = {
          pause: () => player?.pause?.(),
          getCurrentTime: () => lastSecondRef.current,
        };
        if (controllerRef) controllerRef.current = controller;

        player.on('ready', () => {
          if (!active) return;
          onReady?.();
        });
        player.on('timeupdate', (data) => {
          const seconds = Math.max(0, Math.floor(Number(data?.seconds || 0)));
          lastSecondRef.current = seconds;
          onProgress?.(seconds);
        });
        player.on('ended', () => {
          onEnded?.(lastSecondRef.current);
        });
        player.on('error', () => {
          onError?.('حدث خطأ أثناء تشغيل المحاضرة.');
        });
      } catch {
        onError?.('تعذر تشغيل المحاضرة حاليًا.');
      }
    }

    connectPlayer();
    return () => {
      active = false;
      try { player?.off?.('timeupdate'); } catch { /* no-op */ }
      try { player?.off?.('ended'); } catch { /* no-op */ }
      try { player?.off?.('error'); } catch { /* no-op */ }
      playerRef.current = null;
      if (controllerRef) controllerRef.current = null;
    };
  }, [controllerRef, embedUrl, onEnded, onError, onProgress, onReady]);

  if (loading) {
    return <div className="video-placeholder"><div><b>جاري تجهيز المحاضرة الآمنة...</b><span>لحظات ويتم بدء التشغيل</span></div></div>;
  }

  if (errorMessage) {
    return <div className="video-placeholder"><div><b>تعذر تشغيل المحاضرة</b><span>{errorMessage}</span></div></div>;
  }

  return (
    <iframe
      ref={iframeRef}
      src={embedUrl}
      title={title || 'فيديو المحاضرة'}
      loading="eager"
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
    />
  );
}
