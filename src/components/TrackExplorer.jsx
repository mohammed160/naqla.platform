import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandShape } from './BrandShapes';
import { TRACK_OUTCOMES, TRACK_TOPICS, trackFor } from '../lib/tracks';

const SHAPES = [['bubble', '#694aff'], ['shield', '#ff5500'], ['circle', '#fb4c7d'], ['hook', '#54e6d4']];

/**
 * Dashboard-style explorer of the three tracks.
 * Top: bento cards (numbers + track tabs). Bottom: a white panel with the topic list and a dark detail panel.
 */
export default function TrackExplorer({ courses = [], stats = [], title = 'المسارات', text = '' }) {
  const items = courses.slice(0, 3);
  const [tab, setTab] = useState(0);
  const [topic, setTopic] = useState(0);

  useEffect(() => { setTopic(0); }, [tab]);

  if (!items.length) return null;
  const course = items[tab] || items[0];
  const track = trackFor(course, tab);
  const topics = TRACK_TOPICS[track.key] || [];
  const current = topics[topic] || topics[0];
  const outcomes = TRACK_OUTCOMES[track.key] || [];

  return (
    <section className="explorer section-pad" id="courses">
      {title && (
        <header className="explorer-head">
          <h2>{title}</h2>
          {text && <p>{text}</p>}
        </header>
      )}

      <div className="bento">
        <div className="bento-card bento-metrics">
          <div className="metrics">
            {stats.slice(0, 3).map((item, index) => (
              <div key={`${item.label}-${index}`}>
                <small>{item.label}</small>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
          <div className="segments" aria-hidden="true">
            {items.map((entry, index) => {
              const t = trackFor(entry, index);
              return <span key={entry.id} style={{ '--tc': t.color }}><i />{t.tag}</span>;
            })}
          </div>
          <div className="shape-stack" aria-hidden="true">
            {SHAPES.map(([type, color]) => <span key={type}><BrandShape type={type} color={color} /></span>)}
          </div>
        </div>

        <div className="bento-card bento-tabs" role="tablist" aria-label="اختر المسار">
          {items.map((entry, index) => {
            const t = trackFor(entry, index);
            const selected = index === tab;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`tab-card ${selected ? 'on' : ''}`}
                style={{ '--tc': t.color }}
                onClick={() => setTab(index)}
              >
                <small>{t.tag}</small>
                <b>{entry.title}</b>
                <i>0{index + 1}</i>
              </button>
            );
          })}
        </div>
      </div>

      <div className="wpanel" style={{ '--tc': track.color }}>
        <div className="wnotch" role="tablist" aria-label="المسارات">
          {items.map((entry, index) => (
            <button key={entry.id} type="button" role="tab" aria-selected={index === tab} className={index === tab ? 'on' : ''} onClick={() => setTab(index)}>
              {trackFor(entry, index).tag}
            </button>
          ))}
        </div>

        <div className="wlist">
          <h3>محاور المسار</h3>
          <ul>
            {topics.map((entry, index) => (
              <li key={entry.title}>
                <button type="button" className={index === topic ? 'on' : ''} onClick={() => setTopic(index)}>
                  <span className="wnum">{index + 1}</span>
                  <span className="wtxt"><b>{entry.title}</b><small>{entry.note}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="wdetail">
          <div className="wdetail-head">
            <div><b>{course.title}</b></div>
            <span className="wtag" style={{ background: track.color }}>{track.tag}</span>
          </div>
          <p className="wnote">{current?.note}</p>
          <div className="wcards">
            {outcomes.map((line) => (
              <div key={line}><i style={{ background: track.color }} /><span>{line}</span></div>
            ))}
          </div>
          <div className="wbar">
            <span>اشتراك واحد يفتح المسارات الثلاثة مدى الحياة</span>
            <Link className="btn primary" to="/join">اشترك الآن</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
