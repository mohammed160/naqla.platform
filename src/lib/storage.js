import { supabase, supabaseConfigured } from './supabase';
import { slugifyFileName } from './helpers';

const SIX_MB = 6 * 1024 * 1024;
const IMMUTABLE_CACHE = '31536000';
const signedUrlCache = new Map();

function resolveBucket(folder = '', explicitBucket = '') {
  if (explicitBucket) return explicitBucket;
  if (folder.startsWith('videos/') || folder.startsWith('lecture-videos/')) return 'lecture-videos';
  if (folder.startsWith('materials/') || folder.startsWith('course-materials/')) return 'course-materials';
  if (folder.startsWith('projects/') || folder.startsWith('student-projects/')) return 'student-projects';
  if (folder.startsWith('payments/') || folder.startsWith('payment-proofs/')) return 'payment-proofs';
  if (folder.startsWith('media/') || folder.startsWith('public-media/')) return 'public-media';
  return 'public-assets';
}

function cleanFolder(folder = '') {
  return folder
    .replace(/^public\//, '')
    .replace(/^(lecture-videos|course-materials|student-projects|payment-proofs|public-media|videos|materials|projects|payments|media)\//, '')
    .replace(/^\/+|\/+$/g, '');
}

function getStorageEndpoint() {
  const projectUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  const projectRef = new URL(projectUrl).hostname.split('.')[0];
  return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
}

function cacheKey(bucket, path, transform) {
  return `${bucket}:${path}:${transform ? JSON.stringify(transform) : 'original'}`;
}

function getCachedUrl(key) {
  const cached = signedUrlCache.get(key);
  if (!cached) return '';
  if (cached.expiresAt <= Date.now() + 30000) {
    signedUrlCache.delete(key);
    return '';
  }
  return cached.url;
}

function setCachedUrl(key, url, expiresIn) {
  if (!url) return;
  signedUrlCache.set(key, {
    url,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
  });
}

async function uploadResumable({ bucket, fullPath, file, onProgress, upsert }) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error('انتهت جلسة تسجيل الدخول. سجّل دخول مرة أخرى.');

  // Loaded on demand: only large admin uploads need the resumable client.
  const tus = await import('tus-js-client');

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: getStorageEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': upsert ? 'true' : 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: SIX_MB,
      metadata: {
        bucketName: bucket,
        objectName: fullPath,
        contentType: file.type || 'application/octet-stream',
        cacheControl: IMMUTABLE_CACHE,
      },
      fingerprint: () => Promise.resolve(
        ['naqla', bucket, fullPath, file.size, file.lastModified].join('-'),
      ),
      onError: reject,
      onProgress: (bytesUploaded, bytesTotal) => {
        const percent = bytesTotal > 0
          ? Math.max(1, Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100)))
          : 1;
        onProgress?.(percent);
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve({ path: fullPath });
      },
    });

    upload.start();
  });
}

async function uploadStandard({ bucket, fullPath, file, onProgress, upsert }) {
  onProgress?.(10);
  const { data, error } = await supabase.storage.from(bucket).upload(fullPath, file, {
    cacheControl: IMMUTABLE_CACHE,
    contentType: file.type || 'application/octet-stream',
    upsert,
  });
  if (error) throw error;
  onProgress?.(100);
  return data;
}

export async function uploadFile({
  folder,
  file,
  publicUrl = true,
  onProgress,
  bucket: explicitBucket,
  upsert = false,
}) {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase غير متصل.');
  if (!file) throw new Error('لم يتم اختيار ملف.');

  const bucket = resolveBucket(folder, explicitBucket);
  const safeName = `${Date.now()}-${crypto.randomUUID()}-${slugifyFileName(file.name)}`;
  const safeFolder = cleanFolder(folder);
  const fullPath = safeFolder ? `${safeFolder}/${safeName}` : safeName;

  const shouldUseResumable = bucket === 'lecture-videos' || file.size > SIX_MB;
  const data = shouldUseResumable
    ? await uploadResumable({ bucket, fullPath, file, onProgress, upsert })
    : await uploadStandard({ bucket, fullPath, file, onProgress, upsert });

  let url = '';
  if (publicUrl && ['public-assets', 'public-media'].includes(bucket)) {
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    url = publicData.publicUrl;
  }

  return {
    bucket,
    path: data.path,
    url,
    name: file.name,
    size: file.size,
    contentType: file.type || 'application/octet-stream',
  };
}

export async function removeStoredFile(bucket, path) {
  if (!supabase || !bucket || !path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.warn(`Could not delete ${bucket}/${path}:`, error.message);
}

export async function createPrivateFileUrl(bucket, path, expiresIn = 300) {
  if (!supabase || !bucket || !path) return '';
  const key = cacheKey(bucket, path, null);
  const cached = getCachedUrl(key);
  if (cached) return cached;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  const url = data?.signedUrl || '';
  setCachedUrl(key, url, expiresIn);
  return url;
}

export async function createPrivateImageUrl(bucket, path, expiresIn = 1800, transform = {}) {
  if (!supabase || !bucket || !path) return '';
  const normalizedTransform = {
    width: transform.width,
    height: transform.height,
    resize: transform.resize || 'contain',
    quality: transform.quality ?? 78,
  };
  Object.keys(normalizedTransform).forEach((key) => {
    if (normalizedTransform[key] == null) delete normalizedTransform[key];
  });

  const key = cacheKey(bucket, path, normalizedTransform);
  const cached = getCachedUrl(key);
  if (cached) return cached;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn, {
    transform: normalizedTransform,
  });
  if (error) throw error;
  const url = data?.signedUrl || '';
  setCachedUrl(key, url, expiresIn);
  return url;
}

export async function createPrivateFileUrls(bucket, paths = [], expiresIn = 300) {
  if (!supabase || !bucket) return [];
  const cleanPaths = paths.filter(Boolean);
  if (!cleanPaths.length) return [];

  const results = new Array(cleanPaths.length).fill('');
  const missingPaths = [];
  const missingIndexes = [];

  cleanPaths.forEach((path, index) => {
    const key = cacheKey(bucket, path, null);
    const cached = getCachedUrl(key);
    if (cached) results[index] = cached;
    else {
      missingPaths.push(path);
      missingIndexes.push(index);
    }
  });

  if (!missingPaths.length) return results;

  try {
    const storage = supabase.storage.from(bucket);
    if (typeof storage.createSignedUrls === 'function') {
      const { data, error } = await storage.createSignedUrls(missingPaths, expiresIn);
      if (error) throw error;
      missingIndexes.forEach((resultIndex, dataIndex) => {
        const item = data?.[dataIndex];
        const url = item?.signedUrl || item?.signedURL || '';
        results[resultIndex] = url;
        setCachedUrl(cacheKey(bucket, cleanPaths[resultIndex], null), url, expiresIn);
      });
      return results;
    }
  } catch (error) {
    console.warn(`Batch signed URLs failed for ${bucket}; falling back to individual URLs.`, error?.message || error);
  }

  const fallback = await Promise.all(missingPaths.map((path) => createPrivateFileUrl(bucket, path, expiresIn).catch(() => '')));
  missingIndexes.forEach((resultIndex, fallbackIndex) => {
    results[resultIndex] = fallback[fallbackIndex] || '';
  });
  return results;
}
