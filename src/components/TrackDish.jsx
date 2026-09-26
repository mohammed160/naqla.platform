import { useEffect, useState } from 'react';
import TrackPreview from './TrackPreview';
import { trackFor } from '../lib/tracks';

function wrapOffset(index, active, total) {
  let d = index - active;
  if (d > total / 2) d -= total;
  if (d < -total / 2) d += total;
  return d;
}

/** Hero visual: white "app windows" on a curved glass dish, one per track. */
export default function TrackDish({ courses = [], motionEnabled = true }) {
  const items = courses.slice(0, 3);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!motionEnabled || paused || items.length < 2) return undefined;
    const timer = setInterval(() => setActive((current) => (current + 1) % items.length), 6000);
    return () => clearInterval(timer);
  }, [motionEnabled, paused, items.length]);

  if (!items.length) return null;

  return (
    <div
      className="dish"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="group"
      aria-label="المسارات الثلاثة"
    >
      <div className="dish-band" aria-hidden="true" />
      <div className="dish-ring" aria-hidden="true" />
      <div className="dish-glow" aria-hidden="true" />
      {items.map((course, index) => {
        const track = trackFor(course, index);
        const offset = wrapOffset(index, active, items.length);
        const isActive = offset === 0;
        return (
          <article
            key={course.id}
            className={`dish-card ${isActive ? 'is-active' : ''}`}
            style={{ '--tc': track.color, '--o': offset, '--abs': Math.abs(offset) }}
            onClick={() => setActive(index)}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(index); } }}
            tabIndex={isActive ? -1 : 0}
            aria-label={course.title}
          >
            <div className="win-bar" aria-hidden="true"><i /><i /><i /><span>naqla.app</span></div>
            <div className="win-preview"><TrackPreview kind={track.key} /></div>
            <h3>{course.title}</h3>
            <div className="win-actions" aria-hidden="true">
              <span className="pill-dark">شوف المسار</span>
              <span className="pill-grad" style={{ background: `linear-gradient(90deg, ${track.color}, #694aff)` }}>ابدأ</span>
            </div>
            <div className="dish-label">
              <span className="dish-chip">المسار {index + 1}</span>
              <span className="dish-tag" style={{ background: track.color }}>{track.tag}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
