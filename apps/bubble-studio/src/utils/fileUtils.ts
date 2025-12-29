import imageCompression from 'browser-image-compression';

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

/** Maximum file size in bytes (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** @deprecated Use MAX_FILE_SIZE_BYTES instead */
export const MAX_BYTES = MAX_FILE_SIZE_BYTES;

/** Allowed text file extensions (without dot) */
export const TEXT_FILE_EXTENSIONS = [
  'html',
  'htm',
  'csv',
  'txt',
  'md',
] as const;

/** Allowed image file extensions (without dot) */
export const IMAGE_FILE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
] as const;

/** Allowed document file extensions (without dot) - files that are read as base64 */
export const DOCUMENT_FILE_EXTENSIONS = ['pdf'] as const;

/** All allowed file extensions */
export const ALLOWED_FILE_EXTENSIONS = [
  ...TEXT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...DOCUMENT_FILE_EXTENSIONS,
] as const;

/** Allowed text MIME types */
export const TEXT_MIME_TYPES = [
  'text/plain',
  'text/html',
  'text/csv',
  'text/markdown',
] as const;

/** Allowed image MIME types */
export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
] as const;

/** Allowed document MIME types */
export const DOCUMENT_MIME_TYPES = ['application/pdf'] as const;

/** All allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  ...TEXT_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
] as const;

/**
 * File input accept string for HTML file inputs
 * Includes text files, images, and documents (PDF)
 */
export const FILE_INPUT_ACCEPT = [
  ...TEXT_FILE_EXTENSIONS.map((ext) => `.${ext}`),
  ...IMAGE_FILE_EXTENSIONS.map((ext) => `.${ext}`),
  ...DOCUMENT_FILE_EXTENSIONS.map((ext) => `.${ext}`),
  ...IMAGE_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
].join(',');

/**
 * File input accept string for array entries (text files only)
 */
export const TEXT_FILE_INPUT_ACCEPT = TEXT_FILE_EXTENSIONS.map(
  (ext) => `.${ext}`
).join(',');

/**
 * Human-readable list of allowed file types for error messages
 */
export const ALLOWED_FILE_TYPES_DISPLAY = [
  ...TEXT_FILE_EXTENSIONS,
  ...IMAGE_FILE_EXTENSIONS,
  ...DOCUMENT_FILE_EXTENSIONS,
].join(', ');

// ============================================================================
// FILE TYPE DETECTION UTILITIES
// ============================================================================

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function isAllowedType(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  // Check by extension
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.some((ext) =>
    name.endsWith(`.${ext}`)
  );
  if (hasAllowedExtension) return true;

  // Check by MIME type
  const hasAllowedMime = ALLOWED_MIME_TYPES.some(
    (allowedMime) => mime === allowedMime
  );
  if (hasAllowedMime) return true;

  // Also accept generic text MIME types
  if (mime.startsWith('text/')) return true;

  return false;
}

export function isTextLike(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  // Check by MIME type
  if (mime.startsWith('text/')) return true;

  // Check by extension
  return TEXT_FILE_EXTENSIONS.some((ext) => name.endsWith(`.${ext}`));
}

export function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  // Check by MIME type
  const hasImageMime = IMAGE_MIME_TYPES.some((imageMime) => mime === imageMime);
  if (hasImageMime) return true;

  // Check by extension
  return IMAGE_FILE_EXTENSIONS.some((ext) => name.endsWith(`.${ext}`));
}

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  return mime === 'application/pdf' || name.endsWith('.pdf');
}

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

/**
 * Read a file as base64 string (without the data URL prefix).
 * Use this for binary files like PDFs that should be uploaded as base64.
 */
export async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      // Extract base64 content from data URL (remove "data:mime/type;base64," prefix)
      const prefix = 'base64,';
      const idx = dataUrl.indexOf(prefix);
      if (idx === -1) {
        resolve(dataUrl);
      } else {
        resolve(dataUrl.slice(idx + prefix.length));
      }
    };
    reader.readAsDataURL(file);
  });
}

function dataURLToBase64(dataUrl: string): string {
  const prefix = 'base64,';
  const idx = dataUrl.indexOf(prefix);
  if (idx === -1) return dataUrl; // fallback
  return dataUrl.slice(idx + prefix.length);
}

export interface CompressPngOptions {
  maxBytes?: number;
  // progressively downscale until under cap or min size reached
  initialMaxDimension?: number; // e.g. 2000
  minMaxDimension?: number; // e.g. 600
  stepRatio?: number; // e.g. 0.85
}

/**
 * Compress a PNG by downscaling dimensions and exporting as PNG, then return base64 (no data URL prefix).
 * Note: PNG ignores quality param; size reduction comes from downscaling.
 */
export async function compressPngToBase64(
  file: File,
  options: CompressPngOptions = {}
): Promise<string> {
  const {
    maxBytes = MAX_BYTES,
    initialMaxDimension = 2000,
    minMaxDimension = 600,
    stepRatio = 0.85,
  } = options;

  // Try using library first for better performance and quality
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: initialMaxDimension,
      useWebWorker: true,
      fileType: 'image/png',
      // We will iterate ourselves if still too big
    });

    // If still larger than cap, iteratively downscale using the library
    let blob: Blob = compressed;
    let currentMax = initialMaxDimension;
    while (blob.size > maxBytes) {
      const next = Math.floor(currentMax * stepRatio);
      if (next < minMaxDimension || next === currentMax) break;
      currentMax = next;
      blob = await imageCompression(file, {
        maxSizeMB: maxBytes / (1024 * 1024),
        maxWidthOrHeight: currentMax,
        useWebWorker: true,
        fileType: 'image/png',
      });
    }

    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    return dataURLToBase64(base64DataUrl);
  } catch (error) {
    throw new Error(
      `Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Compress a PNG or JPEG by downscaling dimensions and exporting as the corresponding format, then return base64 (no data URL prefix).
 */
export async function compressImageToBase64(
  file: File,
  options: CompressPngOptions = {}
): Promise<string> {
  const {
    maxBytes = MAX_BYTES,
    initialMaxDimension = 2000,
    minMaxDimension = 600,
    stepRatio = 0.85,
  } = options;

  const inputMime = file.type.toLowerCase();
  const targetType =
    inputMime === 'image/jpeg' || inputMime === 'image/jpg'
      ? 'image/jpeg'
      : 'image/png';

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: initialMaxDimension,
      useWebWorker: true,
      fileType: targetType,
    });

    let blob: Blob = compressed;
    let currentMax = initialMaxDimension;
    while (blob.size > maxBytes) {
      const next = Math.floor(currentMax * stepRatio);
      if (next < minMaxDimension || next === currentMax) break;
      currentMax = next;
      blob = await imageCompression(file, {
        maxSizeMB: maxBytes / (1024 * 1024),
        maxWidthOrHeight: currentMax,
        useWebWorker: true,
        fileType: targetType,
      });
    }

    const base64DataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(String(fr.result));
      fr.readAsDataURL(blob);
    });
    return dataURLToBase64(base64DataUrl);
  } catch (error) {
    throw new Error(
      `Failed to compress image: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
