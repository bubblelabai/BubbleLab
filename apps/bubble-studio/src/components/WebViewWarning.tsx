import { useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

/**
 * Detects if the current environment is a WebView
 * WebViews are commonly used in mobile apps and have specific user agent patterns
 * that Google OAuth blocks with a 403 error
 */
function isWebView(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  // Common WebView patterns
  const webViewPatterns = [
    'wv', // Android WebView
    'webview', // Generic WebView
    'webviewer', // Some WebView implementations
  ];

  // Check for WebView in user agent
  const hasWebViewPattern = webViewPatterns.some((pattern) =>
    userAgent.includes(pattern)
  );

  // Additional checks for mobile app WebViews
  // Some mobile apps embed WebViews without the standard patterns
  const isMobileAppWebView =
    // iOS WebView (UIWebView or WKWebView in apps)
    (userAgent.includes('iphone') || userAgent.includes('ipad')) &&
    !userAgent.includes('safari') &&
    !userAgent.includes('crios') && // Chrome iOS
    !userAgent.includes('fxios'); // Firefox iOS

  // Android WebView detection
  const isAndroidWebView =
    userAgent.includes('android') &&
    !userAgent.includes('chrome') &&
    !userAgent.includes('firefox') &&
    !userAgent.includes('samsungbrowser') &&
    !userAgent.includes('edg'); // Edge Android

  return hasWebViewPattern || isMobileAppWebView || isAndroidWebView;
}

/**
 * Attempts to open the current URL in an external browser
 * Uses multiple methods to maximize compatibility
 */
function attemptExternalBrowserRedirect(): boolean {
  const currentUrl = window.location.href;
  const userAgent = navigator.userAgent.toLowerCase();

  // Method 1: Try Android Intent URL (for Android devices)
  if (userAgent.includes('android')) {
    try {
      // Try Chrome intent
      const chromeIntent = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = chromeIntent;

      // If we get here, intent might have worked (or failed silently)
      // Give it a moment, then try other methods
      setTimeout(() => {
        // If still in WebView, try other methods
      }, 1000);
    } catch {
      // Continue to next method
    }
  }

  // Method 2: Try iOS custom URL scheme (for iOS devices)
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    try {
      // Try Safari URL scheme
      window.location.href = `x-safari-https://${currentUrl.replace(/^https?:\/\//, '')}`;
      return true;
    } catch {
      // Continue to next method
    }
  }

  // Method 3: Try window.open with _system target (works in some WebViews)
  try {
    const opened = window.open(currentUrl, '_system');
    if (opened) {
      return true;
    }
  } catch {
    // Continue to next method
  }

  // Method 4: Try window.open with _blank (standard method)
  try {
    const opened = window.open(currentUrl, '_blank', 'noopener,noreferrer');
    if (opened && !opened.closed) {
      return true;
    }
  } catch {
    // Continue to next method
  }

  // Method 5: Try creating a temporary link and clicking it
  try {
    const link = document.createElement('a');
    link.href = currentUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    // All methods failed
  }

  return false;
}

/**
 * Global WebView warning component that detects WebView environments
 * and shows a warning page instructing users to open in a full browser.
 */
export function WebViewWarning() {
  const [isWebViewEnv, setIsWebViewEnv] = useState(false);
  const [hasAttemptedRedirect, setHasAttemptedRedirect] = useState(false);
  const [showCopyUrl, setShowCopyUrl] = useState(false);

  useEffect(() => {
    // Check if we're in a WebView environment
    const detected = isWebView();
    setIsWebViewEnv(detected);

    // Auto-redirect to external browser if WebView detected
    if (detected && !hasAttemptedRedirect) {
      setHasAttemptedRedirect(true);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        attemptExternalBrowserRedirect();
      }, 100);
    }
  }, [hasAttemptedRedirect]);

  // Don't render anything if not in WebView
  if (!isWebViewEnv) {
    return null;
  }

  const currentUrl = window.location.href;

  const handleOpenExternal = () => {
    const success = attemptExternalBrowserRedirect();
    if (success) {
      // Try to close this window after a delay
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // Can't close, that's okay
        }
      }, 1500);
    } else {
      // If redirect failed, show copy URL option
      setShowCopyUrl(true);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setShowCopyUrl(false);
      alert('URL copied to clipboard! Paste it in your browser.');
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentUrl;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowCopyUrl(false);
        alert('URL copied to clipboard! Paste it in your browser.');
      } catch {
        alert('Please manually copy the URL from the address bar.');
      }
      document.body.removeChild(textArea);
    }
  };

  // Show full-screen warning
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-[#1a1a1a] border border-[#30363d] rounded-2xl p-8 shadow-2xl">
        {/* Header with Bubble Lab branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 font-sans">
            Browser Not Supported
          </h1>
          <p className="text-gray-400 text-lg font-sans">
            Bubble Lab does not support this browser
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4 mb-6">
          <p className="text-yellow-200 text-sm font-sans">
            <strong>In-app browsers are not supported.</strong> Please use a
            full browser like Chrome, Safari, or Firefox for the best
            experience.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white font-sans">
            How to access Bubble Lab:
          </h2>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-[#0a0a0a] rounded-lg border border-[#30363d]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1 font-sans">
                  Open in your device's browser
                </p>
                <p className="text-gray-400 text-sm font-sans">
                  Look for a menu button (⋮ or ⋯) and select "Open in Browser"
                  or "Open in Safari/Chrome"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[#0a0a0a] rounded-lg border border-[#30363d]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1 font-sans">
                  Copy the URL and open in a browser
                </p>
                <p className="text-gray-400 text-sm font-sans">
                  Copy this page's URL and paste it directly in Chrome, Safari,
                  or Firefox
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[#0a0a0a] rounded-lg border border-[#30363d]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1 font-sans">
                  Use a desktop browser
                </p>
                <p className="text-gray-400 text-sm font-sans">
                  For the best experience, access Bubble Lab from a desktop
                  browser
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleOpenExternal}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors font-sans shadow-lg hover:shadow-xl"
          >
            Open in External Browser
          </button>

          {showCopyUrl && (
            <div className="space-y-2">
              <div className="p-3 bg-[#0a0a0a] border border-[#30363d] rounded-lg">
                <p className="text-xs text-gray-400 mb-2 font-sans">URL:</p>
                <p className="text-sm text-gray-300 break-all font-mono">
                  {currentUrl}
                </p>
              </div>
              <button
                onClick={handleCopyUrl}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors font-sans"
              >
                Copy URL
              </button>
            </div>
          )}

          <button
            onClick={() => {
              // Allow user to dismiss (they might want to try anyway)
              setIsWebViewEnv(false);
            }}
            className="w-full text-gray-400 hover:text-gray-300 text-sm underline font-sans py-2"
          >
            Continue anyway (limited functionality)
          </button>
        </div>
      </div>
    </div>
  );
}
