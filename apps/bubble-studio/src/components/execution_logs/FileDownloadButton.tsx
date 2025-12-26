import { useState, useCallback } from 'react';
import { Download, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getFilenameFromUrl } from './downloadUtils';

type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

interface FileDownloadButtonProps {
  url: string;
  className?: string;
}

/**
 * A button component that fetches a file and triggers a direct download
 * Works with cross-origin URLs like Cloudflare R2 storage
 */
export function FileDownloadButton({
  url,
  className = '',
}: FileDownloadButtonProps) {
  const [status, setStatus] = useState<DownloadStatus>('idle');

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (status === 'downloading') return;

      setStatus('downloading');

      try {
        // Fetch the file
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        // Get the blob
        const blob = await response.blob();

        // Create a blob URL
        const blobUrl = URL.createObjectURL(blob);

        // Get filename from URL or Content-Disposition header
        let filename = getFilenameFromUrl(url);
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(
            /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
          );
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
          }
        }

        // Create temporary link and trigger download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the blob URL
        URL.revokeObjectURL(blobUrl);

        setStatus('success');

        // Reset to idle after a short delay
        setTimeout(() => setStatus('idle'), 2000);
      } catch (error) {
        console.error('Download failed:', error);
        setStatus('error');

        // Reset to idle after showing error
        setTimeout(() => setStatus('idle'), 3000);
      }
    },
    [url, status]
  );

  const filename = getFilenameFromUrl(url);

  const getButtonContent = () => {
    switch (status) {
      case 'downloading':
        return (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Downloading...</span>
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle className="w-3 h-3" />
            <span>Downloaded!</span>
          </>
        );
      case 'error':
        return (
          <>
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </>
        );
      default:
        return (
          <>
            <Download className="w-3 h-3" />
            <span>Download</span>
          </>
        );
    }
  };

  const getButtonStyles = () => {
    const baseStyles =
      'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer';

    switch (status) {
      case 'downloading':
        return `${baseStyles} text-blue-400 bg-blue-500/10 border border-blue-500/30`;
      case 'success':
        return `${baseStyles} text-emerald-400 bg-emerald-500/20 border border-emerald-500/40`;
      case 'error':
        return `${baseStyles} text-red-400 bg-red-500/10 border border-red-500/30`;
      default:
        return `${baseStyles} text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30`;
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={status === 'downloading'}
      className={`${getButtonStyles()} ${className}`}
      title={status === 'idle' ? `Download ${filename}` : undefined}
    >
      {getButtonContent()}
    </button>
  );
}
