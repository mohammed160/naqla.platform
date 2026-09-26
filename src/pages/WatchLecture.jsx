import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createPrivateFileUrl } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { formatError } from '../lib/helpers';
import LoadingScreen from '../components/LoadingScreen';
import YouTubeLecturePlayer from '../components/YouTubeLecturePlayer';
import BunnyLecturePlayer from '../components/BunnyLecturePlayer';
import ReviewsSection from '../components/ReviewsSection';

function mapLecture(item) {
  return {
    ...item,
    courseId: item.course_id,
    isFree: item.is_free,
    thumbnailUrl: item.thumbnail_url,
    durationText: item.duration_text,
    order: item.sort_order,
  };
}

export default function WatchLecture() {
  const { lectureId } = useParams();
  const { user } = useAuth();
  const userId = user?.id || '';
  const htmlVideoRef = useRef(null);
  const playerControllerRef = useRef(null);
  const lastSavedSecond = useRef(-1);
  const [lecture, setLecture] = useState(null);
  const [courseLectures, setCourseLectures] = useState([]);
  const [playback, setPlayback] = useState({ provider: '', videoId: '', url: '' });
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guarded, setGuarded] = useState(false);
  const [watermarkPosition, setWatermarkPosition] = useState({ top: '12%', left: '8%' });
  const [completed, setCompleted] = useState(false);
  const [resumeSeconds, setResumeSeconds] = useState(0);

  const pausePlayback = useCallback(() => {
    playerControllerRef.current?.pause?.();
    htmlVideoRef.current?.pause?.();
  }, []);

  const currentPlaybackSecond = useCallback(() => {
    if (playback.provider === 'youtube' || playback.provider === 'bunny') {
      return Math.floor(Number(playerControllerRef.current?.getCurrentTime?.() || 0));
    }
    return Math.floor(Number(htmlVideoRef.current?.currentTime || 0));
  }, [playback.provider]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      setPlayback({ provider: '', videoId: '', url: '' });
      setResumeSeconds(0);
      lastSavedSecond.current = -1;

      try {
        if (lectureId === 'demo-free') {
          setLecture({
            id: lectureId,
            title: 'مقدمة: إزاي تستفيد من نقلة',
            description: 'محاضرة تعريفية مجانية.',
            isFree: true,
            thumbnailUrl: '/assets/cover-default.svg',
          });
          return;
        }

        const { data, error: lectureError } = await supabase
          .from('lectures')
          .select('*')
          .eq('id', lectureId)
          .maybeSingle();
        if (lectureError) throw lectureError;
        if (!data) throw new Error('المحاضرة غير موجودة أو حسابك لا يملك صلاحية مشاهدتها.');

        const mapped = mapLecture(data);
        if (!active) return;
        setLecture(mapped);

        const [lecturesResult, materialsResult, progressResult, playbackResult] = await Promise.all([
          supabase.from('lectures').select('*').eq('course_id', data.course_id).eq('published', true).order('sort_order', { ascending: true }),
          supabase.from('materials').select('*').eq('lecture_id', data.id).order('created_at', { ascending: true }),
          userId
            ? supabase.from('lecture_progress').select('*').eq('user_id', userId).eq('lecture_id', data.id).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.rpc('get_lecture_playback', { p_lecture_id: data.id }).maybeSingle(),
        ]);

        const firstError = lecturesResult.error || materialsResult.error || progressResult.error;
        if (firstError) throw firstError;
        if (!active) return;

        const savedPosition = Math.max(0, Math.floor(Number(
          progressResult.data?.last_position_seconds
          ?? progressResult.data?.watched_seconds
          ?? 0,
        )));

        setCourseLectures((lecturesResult.data || []).map(mapLecture));
        setMaterials(materialsResult.data || []);
        setCompleted(Boolean(progressResult.data?.completed));
        setResumeSeconds(savedPosition);
        lastSavedSecond.current = savedPosition > 0 ? savedPosition : -1;

        if (!playbackResult.error && playbackResult.data?.provider === 'youtube' && playbackResult.data?.provider_video_id) {
          setPlayback({ provider: 'youtube', videoId: playbackResult.data.provider_video_id, url: '' });
        } else if (!playbackResult.error && playbackResult.data?.provider === 'bunny' && playbackResult.data?.provider_video_id) {
          setPlayback({ provider: 'bunny', videoId: playbackResult.data.provider_video_id, url: '' });
        } else if (data.video_path) {
          const url = await createPrivateFileUrl('lecture-videos', data.video_path, 1800);
          if (active) setPlayback({ provider: 'storage', videoId: '', url });
        } else if (playbackResult.error && playbackResult.error.code !== 'PGRST202') {
          throw playbackResult.error;
        }
      } catch (err) {
        if (active) setError(formatError(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [lectureId, userId]);

  useEffect(() => {
    const positions = [
      { top: '10%', left: '7%' },
      { top: '17%', left: '62%' },
      { top: '68%', left: '9%' },
      { top: '72%', left: '61%' },
      { top: '42%', left: '36%' },
    ];
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % positions.length;
      setWatermarkPosition(positions[index]);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const saveProgress = useCallback(async (isComplete = false, explicitSeconds = null, force = false) => {
    if (!userId || !lecture || lecture.id === 'demo-free') return;

    const seconds = explicitSeconds == null
      ? currentPlaybackSecond()
      : Math.floor(Number(explicitSeconds || 0));

    if (!isComplete && !force && lastSavedSecond.current >= 0 && seconds - lastSavedSecond.current < 20) return;
    if (!isComplete && seconds <= 0) return;

    lastSavedSecond.current = seconds;
    const payload = {
      user_id: userId,
      lecture_id: lecture.id,
      watched_seconds: seconds,
      last_position_seconds: seconds,
      completed: isComplete || completed,
    };
    if (isComplete) payload.completed_at = new Date().toISOString();

    const { error: progressError } = await supabase
      .from('lecture_progress')
      .upsert(payload, { onConflict: 'user_id,lecture_id' });
    if (progressError) return;
    if (isComplete) setCompleted(true);
  }, [completed, currentPlaybackSecond, lecture, userId]);

  const handlePlayerProgress = useCallback((seconds) => saveProgress(false, seconds), [saveProgress]);
  const handlePlayerEnded = useCallback((seconds) => saveProgress(true, seconds), [saveProgress]);

  const restoreHtmlPlayback = useCallback((event) => {
    const video = event.currentTarget;
    const saved = Math.max(0, Number(resumeSeconds || 0));
    if (saved <= 0) return;

    const duration = Number(video.duration || 0);
    const target = duration > 1 ? Math.min(saved, duration - 1) : saved;
    if (Number.isFinite(target) && target > 0) video.currentTime = target;
  }, [resumeSeconds]);

  useEffect(() => {
    const block = (event) => {
      const key = String(event.key || '').toLowerCase();
      const screenshotCombo = key === 'printscreen'
        || ((event.ctrlKey || event.metaKey) && ['s', 'p', 'u'].includes(key))
        || (event.metaKey && event.shiftKey && ['3', '4', '5'].includes(key));
      if (screenshotCombo) {
        event.preventDefault();
        setGuarded(true);
        pausePlayback();
        setTimeout(() => setGuarded(false), 1800);
      }
    };
    const context = (event) => event.preventDefault();
    const visibility = () => {
      if (document.hidden) {
        void saveProgress(false, null, true);
      }
    };

    document.addEventListener('keydown', block);
    document.addEventListener('contextmenu', context);
    document.addEventListener('dragstart', context);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('keydown', block);
      document.removeEventListener('contextmenu', context);
      document.removeEventListener('dragstart', context);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [pausePlayback, saveProgress]);

  async function downloadMaterial(material) {
    try {
      const url = await createPrivateFileUrl('course-materials', material.file_path, 300);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(formatError(err));
    }
  }

  const identity = useMemo(
    () => `${user?.email || 'FREE VIEW'} • ${new Date().toLocaleDateString('ar-EG')}`,
    [user?.email],
  );

  if (loading) return <LoadingScreen label="جاري تجهيز غرفة المحاضرة..." />;
  if (error) {
    return (
      <main className="watch-error">
        <h1>تعذر فتح المحاضرة</h1>
        <p>{error}</p>
        <Link className="btn primary" to={user ? '/dashboard' : '/login'}>{user ? 'العودة للوحة الطالب' : 'تسجيل الدخول'}</Link>
      </main>
    );
  }

  const hasPlayback = Boolean(playback.videoId || playback.url);

  return (
    <main className="watch-page">
      <div className="watch-header">
        <div><span className="secure-pill">● غرفة محمية</span><h1>{lecture.title}</h1></div>
        <Link className="btn ghost compact" to={user ? '/dashboard' : '/'}>رجوع</Link>
      </div>

      <div className="watch-layout">
        <section className="player-column">
          <div className={`secure-player ${guarded ? 'guarded' : ''}`}>
            {playback.provider === 'youtube' && playback.videoId ? (
              <YouTubeLecturePlayer
                videoId={playback.videoId}
                title={lecture.title}
                controllerRef={playerControllerRef}
                initialTime={resumeSeconds}
                onProgress={handlePlayerProgress}
                onEnded={handlePlayerEnded}
              />
            ) : playback.provider === 'bunny' && playback.videoId ? (
              <BunnyLecturePlayer
                lectureId={lecture.id}
                title={lecture.title}
                controllerRef={playerControllerRef}
                initialTime={resumeSeconds}
                onProgress={handlePlayerProgress}
                onEnded={handlePlayerEnded}
              />
            ) : playback.provider === 'storage' && playback.url ? (
              <video
                ref={htmlVideoRef}
                src={playback.url}
                poster={lecture.thumbnailUrl}
                controls
                playsInline
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onLoadedMetadata={restoreHtmlPlayback}
                onTimeUpdate={() => saveProgress(false)}
                onEnded={() => saveProgress(true)}
              />
            ) : (
              <div className="video-placeholder">
                <img src={lecture.thumbnailUrl || '/assets/cover-default.svg'} alt="" />
                <div><b>المحاضرة غير متاحة حاليًا</b><span>جرّب مرة أخرى لاحقًا أو تواصل مع الدعم.</span></div>
              </div>
            )}

            {hasPlayback && <div className="dynamic-watermark" style={watermarkPosition}><b>نقلة</b><span>{identity}</span></div>}
            <div className="anti-capture-grid" />
            {guarded && <div className="capture-guard"><span>◉</span><b>تم إيقاف العرض للحماية</b><small>ارجع للنافذة وكمل المحاضرة.</small></div>}
          </div>

          <div className="lecture-info">
            <div><span className="eyebrow">المحاضرة الحالية</span><h2>{lecture.title}</h2><p>{lecture.description}</p></div>
            {completed && <span className="completed-badge">✓ مكتملة</span>}
          </div>

          <div className="protection-note">
            <b>مشاهدة آمنة داخل المنصة</b>
            <span>المحاضرات المدفوعة متاحة فقط للحسابات المشتركـة، ويتم التحقق من صلاحية المشاهدة تلقائيًا قبل التشغيل.</span>
          </div>

          {!!materials.length && (
            <div className="lecture-materials">
              <h3>ماتريال المحاضرة</h3>
              {materials.map((material) => (
                <button key={material.id} onClick={() => downloadMaterial(material)}>
                  <span>⇩</span><div><b>{material.title}</b><small>{material.file_name}</small></div>
                </button>
              ))}
            </div>
          )}

          {lecture.id !== 'demo-free' && <ReviewsSection lectureId={lecture.id} />}
        </section>

        <aside className="lecture-playlist">
          <div><span>محتوى الكورس</span><b>{courseLectures.length || 1} محاضرة</b></div>
          {courseLectures.length ? courseLectures.map((item, index) => (
            <Link className={item.id === lecture.id ? 'active' : ''} key={item.id} to={`/watch/${item.id}`}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <span><b>{item.title}</b><small>{item.durationText || 'محاضرة'}</small></span>
              {item.id === lecture.id && <em>تشاهد الآن</em>}
            </Link>
          )) : <div className="playlist-empty">المحاضرة المجانية</div>}
        </aside>
      </div>
    </main>
  );
}
