import { BrandShape } from './BrandShapes';
import { AUDIENCE } from '../lib/tracks';

const STYLES = [
  { cls: 'p-dark', shape: 'bubble', color: '#694aff' },
  { cls: 'p-purple', shape: 'shield', color: '#ff5500' },
  { cls: 'p-warm', shape: 'circle', color: '#54e6d4' },
];

export default function AudiencePills() {
  return (
    <section className="audience section-pad" aria-label="لمين نقلة">
      <h2>نقلة لكل من يقدّم علمًا</h2>
      <div className="audience-row">
        {AUDIENCE.map((item, index) => {
          const s = STYLES[index % STYLES.length];
          return (
            <article key={item.key} className={`audience-pill ${s.cls}`}>
              <span className="audience-shape"><BrandShape type={s.shape} color={s.color} /></span>
              <div><b>{item.title}</b><small>{item.text}</small></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
