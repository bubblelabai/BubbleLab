import imageCompression from 'browser-image-compression';
export const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function isAllowedType(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (name.endsWith('.html') || name.endsWith('.htm')) return true;
  if (name.endsWith('.csv')) return true;
  if (name.endsWith('.txt')) return true;
  if (mime === 'image/png' || name.endsWith('.png')) return true;
  return false;
}

export function isTextLike(file: File): boolean {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (name.endsWith('.html') || name.endsWith('.htm')) return true;
  if (name.endsWith('.csv')) return true;
  if (name.endsWith('.txt')) return true;
  return false;
}

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
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
