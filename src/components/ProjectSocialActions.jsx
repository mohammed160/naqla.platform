function HeartIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    </svg>
  );
}

function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6.5 4.5A2.5 2.5 0 0 1 9 2h6a2.5 2.5 0 0 1 2.5 2.5V21L12 17.7 6.5 21V4.5Z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M21 11.5a8.3 8.3 0 0 1-9 8.2 9.5 9.5 0 0 1-3.8-.9L3 20l1.4-4.6A8.2 8.2 0 1 1 21 11.5Z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function ProjectSocialActions({
  project,
  liked = false,
  saved = false,
  onToggleLike,
  onToggleSave,
  onComments,
  compact = false,
  busy = false,
}) {
  function stopAndRun(handler) {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler?.();
    };
  }

  return (
    <div className={`project-social-actions ${compact ? 'compact' : ''}`} aria-label="تفاعلات المشروع">
      <button
        type="button"
        className={`project-social-button ${liked ? 'active like-active' : ''}`}
        onClick={stopAndRun(onToggleLike)}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? 'إزالة الإعجاب' : 'إعجاب بالمشروع'}
      >
        <HeartIcon filled={liked} />
        <b>{project?.likes_count || 0}</b>
      </button>

      <button
        type="button"
        className={`project-social-button ${saved ? 'active save-active' : ''}`}
        onClick={stopAndRun(onToggleSave)}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? 'إزالة من المحفوظات' : 'حفظ المشروع'}
      >
        <BookmarkIcon filled={saved} />
        <b>{project?.saves_count || 0}</b>
      </button>

      <button
        type="button"
        className="project-social-button"
        onClick={stopAndRun(onComments)}
        aria-label="عرض التعليقات"
      >
        <CommentIcon />
        <b>{project?.comments_count || 0}</b>
      </button>

      <span className="project-social-stat" title="المشاهدات">
        <EyeIcon />
        <b>{project?.views_count || 0}</b>
      </span>
    </div>
  );
}
