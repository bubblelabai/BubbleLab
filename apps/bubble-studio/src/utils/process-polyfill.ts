// Browser polyfill for Node.js 'process' global object
// Provides minimal process APIs for browser compatibility

const processPolyfill = {
  env: {
    NODE_ENV: import.meta.env.MODE || 'development',
    ...import.meta.env,
  },
  platform: (() => {
    if (typeof navigator !== 'undefined' && navigator.platform) {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes('win')) return 'win32';
      if (platform.includes('mac')) return 'darwin';
      if (platform.includes('linux')) return 'linux';
    }
    return 'linux'; // Default for browser
  })(),
  versions: {
    node: '0.0.0', // Browser doesn't have Node.js version
  },
  version: 'v0.0.0',
  argv: [],
  cwd: () => '/',
  nextTick: (callback: () => void) => {
    // Use setTimeout as fallback for nextTick
    setTimeout(callback, 0);
  },
  exit: (code?: number) => {
    console.warn(`process.exit(${code}) called in browser - no-op`);
  },
  on: () => {
    // No-op event emitter
  },
  off: () => {
    // No-op event emitter
  },
  emit: () => {
    // No-op event emitter
    return false;
  },
  browser: true, // Indicate this is a browser polyfill
};

// Attach to global scope so it's available as 'process' global
if (typeof window !== 'undefined') {
  (window as any).process = processPolyfill;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).process = processPolyfill;
}

// Export as both default and named export
export default processPolyfill;
export { processPolyfill as process };
