function isVideoUrl(url = '', previewType = '') {
  return previewType.startsWith('video/') || /\.(mp4|webm)(\?.*)?$/i.test(url);
}

export default function BrandMedia({ settings, footer = false, previewUrl = '', previewType = '', className = '' }) {
  const staticUrl = footer
    ? (settings.footerLogoUrl || settings.logoUrl)
    : settings.logoUrl;
  const animatedUrl = settings.animatedLogoUrl;
  const useAnimated = !footer && settings.logoMode === 'animated' && animatedUrl;
  const source = previewUrl || (useAnimated ? animatedUrl : staticUrl);
  const size = Number(settings.logoSize || 44);
  const motionClass = settings.animationSettings?.logoMotion !== false
    ? `logo-motion-${settings.logoMotionStyle || 'float'}`
    : '';
  const style = { '--brand-media-size': `${size}px` };

  if (!source) {
    return <img className={`brand-media ${className}`.trim()} src="/brand/logo-mark.svg" alt={settings.siteName || 'نقلة'} style={style} />;
  }

  if (isVideoUrl(source, previewType)) {
    return (
      <video
        className={`brand-media brand-media-video ${motionClass} ${className}`.trim()}
        src={source}
        style={style}
        autoPlay
        loop
        muted
        playsInline
        aria-label={settings.siteName || 'نقلة'}
      />
    );
  }

  return (
    <img
      className={`brand-media ${motionClass} ${className}`.trim()}
      src={source}
      style={style}
      alt={settings.siteName || 'نقلة'}
    />
  );
}
