import { useEffect, useRef, useState } from 'react';

let youtubeApiPromise = null;

function loadYouTubeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('المشغل غير متاح خارج المتصفح.'));
  }

  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;
    const previousReady = window.onYouTubeIframeAPIReady;

    const finish = () => {
      if (settled || !window.YT?.Player) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(window.YT);
    };

    window.onYouTubeIframeAPIReady = () => {
      try {
        previousReady?.();
      } finally {
        finish();
      }
    };

    const existing = document.querySelector('script[data-youtube-iframe-api="true"]');

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => {
        if (settled) return;
        settled = true;
        youtubeApiPromise = null;
        reject(new Error('تعذر تحميل مشغل المحاضرة.'));
      };
      document.head.appendChild(script);
    }

    const pollId = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(pollId);
        finish();
      }
    }, 100);

    timeoutId = window.setTimeout(() => {
      window.clearInterval(pollId);
      if (settled) return;
      settled = true;
      youtubeApiPromise = null;
      reject(new Error('استغرق تجهيز المحاضرة وقتًا أطول من المتوقع.'));
    }, 15000);
  });

  return youtubeApiPromise;
}

function getStudentSafeErrorMessage() {
  return 'تعذر تشغيل المحاضرة حاليًا. حاول مرة أخرى.';
}

function applyIframeAttributes(player, title) {
  const iframe = player?.getIframe?.();
  if (!iframe) return;

  iframe.className = 'youtube-player-frame';
  iframe.title = title || 'فيديو المحاضرة';
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
  iframe.setAttribute('allowfullscreen', '');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
}

export default function YouTubeLecturePlayer({
  videoId,
  title,
  controllerRef,
  onProgress,
  onEnded,
  onReady,
  onError,
}) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const callbacksRef = useRef({ onProgress, onEnded, onReady, onError });
  const [instanceKey, setInstanceKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState('');
  const [plainIframeMode, setPlainIframeMode] = useState(false);

  callbacksRef.current = { onProgress, onEnded, onReady, onError };

  useEffect(() => {
    if (!videoId || plainIframeMode) return undefined;

    let active = true;

    function clearProgressTimer() {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function publishProgress() {
      const seconds = Math.floor(Number(playerRef.current?.getCurrentTime?.() || 0));
      if (seconds > 0) callbacksRef.current.onProgress?.(seconds);
    }

    async function mountPlayer() {
      setReady(false);
      setApiError('');

      try {
        const YT = await loadYouTubeApi();
        if (!active || !hostRef.current) return;

        playerRef.current = new YT.Player(hostRef.current, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            controls: 1,
            fs: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (!active) return;
              applyIframeAttributes(event.target, title);
              setReady(true);
              callbacksRef.current.onReady?.();

              if (controllerRef) {
                controllerRef.current = {
                  pause: () => playerRef.current?.pauseVideo?.(),
                  getCurrentTime: () => Number(playerRef.current?.getCurrentTime?.() || 0),
                };
              }
            },
            onStateChange: (event) => {
              if (!active) return;

              if (event.data === YT.PlayerState.PLAYING) {
                clearProgressTimer();
                intervalRef.current = window.setInterval(publishProgress, 5000);
              } else {
                publishProgress();
                clearProgressTimer();
              }

              if (event.data === YT.PlayerState.ENDED) {
                const seconds = Math.floor(Number(
                  playerRef.current?.getDuration?.()
                  || playerRef.current?.getCurrentTime?.()
                  || 0,
                ));
                callbacksRef.current.onEnded?.(seconds);
              }
            },
            onError: (event) => {
              if (!active) return;
              const code = Number(event?.data || 0);
              const message = getStudentSafeErrorMessage();

              if (code === 5) {
                clearProgressTimer();
                try {
                  playerRef.current?.destroy?.();
                } catch {
                  // Ignore cleanup errors.
                }
                playerRef.current = null;
                setApiError(message);
                setPlainIframeMode(true);
                callbacksRef.current.onError?.(message, code);
                return;
              }

              setApiError(message);
              callbacksRef.current.onError?.(message, code);
            },
          },
        });
      } catch {
        if (!active) return;
        const message = getStudentSafeErrorMessage();
        setApiError(message);
        setPlainIframeMode(true);
        callbacksRef.current.onError?.(message, 0);
      }
    }

    mountPlayer();

    return () => {
      active = false;
      clearProgressTimer();
      if (controllerRef) controllerRef.current = null;

      try {
        playerRef.current?.destroy?.();
      } catch {
        // Ignore player cleanup errors.
      }

      playerRef.current = null;
    };
  }, [controllerRef, instanceKey, plainIframeMode, title, videoId]);

  function retryApiPlayer() {
    setApiError('');
    setReady(false);
    setPlainIframeMode(false);
    setInstanceKey((current) => current + 1);
  }

  if (plainIframeMode) {
    const params = new URLSearchParams({
      controls: '1',
      fs: '1',
      playsinline: '1',
      rel: '0',
    });

    return (
      <div className="youtube-player-shell" aria-label={title || 'فيديو المحاضرة'}>
        <iframe
          key={`plain-${videoId}-${instanceKey}`}
          className="youtube-player-frame"
          src={`https://www.youtube.com/embed/${videoId}?${params.toString()}`}
          title={title || 'فيديو المحاضرة'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />

        {apiError && (
          <button
            type="button"
            className="btn ghost compact youtube-api-retry"
            onClick={retryApiPlayer}
            title="إعادة المحاولة"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="youtube-player-shell" aria-label={title || 'فيديو المحاضرة'}>
      {!ready && !apiError && (
        <div className="youtube-player-loading">جاري تجهيز مشغل المحاضرة...</div>
      )}

      <div
        key={`${videoId}-${instanceKey}`}
        ref={hostRef}
        className="youtube-player-host"
      />

      {apiError && (
        <div className="youtube-player-error" role="alert">
          <strong>تعذر تشغيل المحاضرة</strong>
          <span>{apiError}</span>
          <button type="button" className="btn primary compact" onClick={retryApiPlayer}>
            إعادة المحاولة
          </button>
        </div>
      )}
    </div>
  );
}
