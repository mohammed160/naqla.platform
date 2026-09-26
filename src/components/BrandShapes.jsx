// The four shapes of the Naqla mark, reusable at any size.
const PATHS = {
  circle: 'M50 4a46 46 0 1 0 0 92 46 46 0 0 0 0-92z',
  bubble: 'M50 4a46 46 0 1 0 22 86L92 98 84 72A46 46 0 0 0 50 4z',
  shield: 'M6 6h88v44a44 44 0 0 1-88 0z',
  hook: 'M22 6h72v50a44 44 0 0 1-88 0V52h34v4a10 10 0 0 0 20 0V40H22z',
};

export function BrandShape({ type = 'circle', color = '#54e6d4', className = '' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d={PATHS[type] || PATHS.circle} fill={color} />
    </svg>
  );
}

export default BrandShape;
