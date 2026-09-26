import { useEffect, useMemo, useState } from 'react';
import { prepareProjectCover } from '../lib/projectCover';

export default function ProjectCoverField({
  currentUrl = '',
  file = null,
  onFileChange,
  onClear,
  disabled = false,
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  const preview = filePreview || currentUrl;

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  async function chooseCover(event) {
    const rawFile = event.target.files?.[0];
    event.target.value = '';
    if (!rawFile) return;

    setProcessing(true);
    setError('');
    try {
      const prepared = await prepareProjectCover(rawFile);
      onFileChange?.(prepared);
    } catch (coverError) {
      setError(coverError?.message || 'تعذر تجهيز الغلاف.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="project-cover-editor">
      <div className="project-cover-editor-copy">
        <div>
          <span className="eyebrow">Project Cover</span>
          <h3>غلاف المشروع</h3>
        </div>
        <p>الغلاف بيتجهّز تلقائيًا بنسبة 16:10. التصميم كامل يفضل ظاهر، والخلفية بتتمدد بشكل سينمائي بدل ما نقص أي جزء من الصورة.</p>
      </div>

      <div className={`project-cover-preview ${preview ? 'has-image' : ''}`}>
        {preview ? <img src={preview} alt="معاينة غلاف المشروع" /> : <div><b>16:10</b><span>اختار صورة غلاف واضحة</span></div>}
      </div>

      <div className="project-cover-editor-actions">
        <label className={`btn ghost compact ${disabled || processing ? 'is-disabled' : ''}`}>
          <input type="file" accept="image/*" onChange={chooseCover} disabled={disabled || processing} />
          {processing ? 'جاري تجهيز الغلاف...' : preview ? 'تغيير الغلاف' : 'اختيار غلاف'}
        </label>
        {preview && onClear && (
          <button type="button" className="btn text compact" onClick={onClear} disabled={disabled || processing}>
            استخدام أول صورة بدل الغلاف
          </button>
        )}
      </div>
      {error && <small className="project-cover-error">{error}</small>}
    </div>
  );
}
