import { BrandShape } from './BrandShapes';

export default function LoadingScreen({ label = 'جاري التحميل...' }) {
  return (
    <div className="loading-screen" role="status">
      <div className="nq-loader" aria-hidden="true">
        <BrandShape type="bubble" color="#694aff" />
        <BrandShape type="shield" color="#ff5500" />
        <BrandShape type="circle" color="#fb4c7d" />
        <BrandShape type="hook" color="#54e6d4" />
      </div>
      <span>{label}</span>
    </div>
  );
}
