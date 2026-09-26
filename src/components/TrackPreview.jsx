// Tiny product screens drawn with the brand shapes; one per track. Purely illustrative.
const K = '#fb4c7d', P = '#694aff', O = '#ff5500', T = '#54e6d4', INK = '#101516';

function Graphic() {
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="معاينة تصميم">
      <rect width="260" height="170" rx="14" fill="#eef0f1" />
      <rect x="10" y="12" width="26" height="146" rx="10" fill="#fff" />
      {[K, P, O, T].map((c, i) => <circle key={c} cx="23" cy={30 + i * 30} r="7" fill={c} />)}
      <rect x="46" y="12" width="204" height="118" rx="12" fill={K} />
      <circle cx="108" cy="70" r="34" fill={INK} />
      <circle cx="74" cy="110" r="12" fill="#fff" />
      <path d="M160 26h50v26a25 25 0 0 1-50 0z" fill={O} />
      <path d="M172 84h50v26a25 25 0 0 1-50 0z" fill={T} />
      <rect x="46" y="138" width="204" height="20" rx="10" fill="#fff" />
      {[K, P, O, T].map((c, i) => <circle key={c} cx={66 + i * 24} cy="148" r="6" fill={c} />)}
    </svg>
  );
}

function Vibe() {
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="معاينة منصة">
      <rect width="260" height="170" rx="14" fill="#eef0f1" />
      <rect x="10" y="10" width="146" height="112" rx="12" fill={INK} />
      {[[24, 26, 70, P], [24, 42, 104, T], [38, 58, 82, '#4b5558'], [38, 74, 96, K], [24, 90, 58, T], [24, 106, 90, '#4b5558']].map(([x, y, w, c]) => <rect key={`${x}${y}`} x={x} y={y} width={w} height="8" rx="4" fill={c} />)}
      <rect x="166" y="10" width="84" height="112" rx="12" fill="#fff" />
      <rect x="176" y="20" width="64" height="34" rx="8" fill={P} />
      <circle cx="190" cy="37" r="9" fill="#fff" />
      <rect x="176" y="62" width="64" height="8" rx="4" fill="#d7dcde" />
      <rect x="176" y="76" width="44" height="8" rx="4" fill="#d7dcde" />
      <rect x="176" y="94" width="64" height="20" rx="10" fill={T} />
      <rect x="10" y="132" width="240" height="28" rx="14" fill="#fff" />
      <circle cx="28" cy="146" r="8" fill={T} />
      <rect x="44" y="142" width="120" height="8" rx="4" fill="#d7dcde" />
      <rect x="210" y="138" width="34" height="16" rx="8" fill={P} />
    </svg>
  );
}

function Ads() {
  const bars = [34, 46, 42, 64, 80, 104];
  return (
    <svg viewBox="0 0 260 170" role="img" aria-label="معاينة إعلانات">
      <rect width="260" height="170" rx="14" fill="#eef0f1" />
      <rect x="10" y="10" width="160" height="150" rx="12" fill="#fff" />
      {bars.map((h, i) => <rect key={h} x={24 + i * 24} y={144 - h} width="16" height={h} rx="6" fill={i === bars.length - 1 ? K : O} />)}
      <rect x="180" y="10" width="70" height="70" rx="12" fill={INK} />
      <text x="215" y="52" textAnchor="middle" fontSize="24" fontWeight="800" fill="#fff" fontFamily="Marble, sans-serif">3.4x</text>
      <rect x="180" y="90" width="70" height="70" rx="12" fill="#fff" />
      <circle cx="215" cy="125" r="26" fill="none" stroke={O} strokeWidth="6" />
      <circle cx="215" cy="125" r="14" fill="none" stroke={K} strokeWidth="6" />
      <circle cx="215" cy="125" r="4" fill={INK} />
    </svg>
  );
}

const MAP = { pink: Graphic, purple: Vibe, orange: Ads, teal: Graphic };

export default function TrackPreview({ kind = 'pink' }) {
  const View = MAP[kind] || Graphic;
  return <View />;
}
