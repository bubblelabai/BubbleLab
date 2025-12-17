/**
 * Common file extensions that indicate a downloadable file
 */
const DOWNLOADABLE_FILE_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.json',
  '.xml',
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.mp3',
  '.wav',
  '.ogg',
  '.mp4',
  '.webm',
  '.avi',
  '.mov',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.ts',
  '.md',
];

/**
 * Check if a URL is likely a downloadable file
 * Detects Cloudflare R2 storage URLs, presigned URLs, and URLs with file extensions
 */
export function isDownloadableFileUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    // Cloudflare R2 storage patterns
    if (
      hostname.includes('.r2.cloudflarestorage.com') ||
      hostname.includes('.r2.dev')
    ) {
      return true;
    }

    // AWS S3 presigned URLs (common pattern)
    if (
      urlObj.searchParams.has('X-Amz-Signature') ||
      urlObj.searchParams.has('x-amz-signature')
    ) {
      return true;
    }

    // Check for common file extensions in pathname
    const hasFileExtension = DOWNLOADABLE_FILE_EXTENSIONS.some((ext) =>
      pathname.endsWith(ext)
    );
    if (hasFileExtension) {
      return true;
    }

    // Check if pathname looks like a file (has extension pattern)
    const extensionMatch = pathname.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (extensionMatch && extensionMatch[1].length <= 5) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract filename from URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'download';
    // Decode URI components and clean up
    return decodeURIComponent(filename).replace(/[?#].*$/, '');
  } catch {
    return 'download';
  }
}
