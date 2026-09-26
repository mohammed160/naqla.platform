import { Link } from 'react-router-dom';
export default function NotFound() {
  return <main className="not-found"><b>404</b><h1>الصفحة مش موجودة</h1><p>ارجع للرئيسية وكمل رحلتك.</p><Link className="btn primary" to="/">الرئيسية</Link></main>;
}
