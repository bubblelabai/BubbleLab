// Browser polyfill for Node.js 'os' module
// Provides minimal OS APIs for browser compatibility

// Detect platform from user agent or default to 'linux' for browser
function detectPlatform(): NodeJS.Platform {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'win32';
    if (platform.includes('mac')) return 'darwin';
    if (platform.includes('linux')) return 'linux';
  }
  // Default to 'linux' for browser compatibility
  return 'linux';
}

export const platform = (): NodeJS.Platform => detectPlatform();

// Stub for other os methods that might be called
export const arch = (): string => {
  // Detect architecture from navigator if available
  if (
    typeof navigator !== 'undefined' &&
    (navigator as any).hardwareConcurrency
  ) {
    // This is a rough guess - browsers don't expose architecture directly
    return 'x64'; // Most modern browsers are 64-bit
  }
  return 'x64';
};

export const cpus = (): any[] => {
  // Return empty array - not available in browser
  return [];
};

export const freemem = (): number => {
  // Try to get memory info if available (Chrome/Edge)
  if (typeof (performance as any).memory !== 'undefined') {
    return (
      (performance as any).memory.jsHeapSizeLimit -
      (performance as any).memory.usedJSHeapSize
    );
  }
  return 0;
};

export const totalmem = (): number => {
  // Try to get memory info if available (Chrome/Edge)
  if (typeof (performance as any).memory !== 'undefined') {
    return (performance as any).memory.jsHeapSizeLimit;
  }
  return 0;
};

export const homedir = (): string => {
  // Return empty string - not available in browser
  return '';
};

export const tmpdir = (): string => {
  // Return '/tmp' as a reasonable default for browser
  return '/tmp';
};

export const hostname = (): string => {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.hostname;
  }
  return 'localhost';
};

export const type = (): string => {
  const platform = detectPlatform();
  if (platform === 'win32') return 'Windows_NT';
  if (platform === 'darwin') return 'Darwin';
  return 'Linux';
};

export const release = (): string => {
  return '0.0.0'; // Browser doesn't expose OS version
};

export const uptime = (): number => {
  // Return uptime in seconds (since page load)
  if (typeof performance !== 'undefined' && performance.now) {
    return Math.floor(performance.now() / 1000);
  }
  return 0;
};

export const loadavg = (): number[] => {
  return [0, 0, 0]; // Not available in browser
};

export const networkInterfaces = (): Record<string, any[]> => {
  return {}; // Not available in browser
};

export const userInfo = (): {
  username: string;
  uid: number;
  gid: number;
  shell: string | null;
  homedir: string;
} => {
  return {
    username: 'browser',
    uid: 0,
    gid: 0,
    shell: null,
    homedir: '',
  };
};

// Export default object with all methods
export default {
  platform,
  arch,
  cpus,
  freemem,
  totalmem,
  homedir,
  tmpdir,
  hostname,
  type,
  release,
  uptime,
  loadavg,
  networkInterfaces,
  userInfo,
};
