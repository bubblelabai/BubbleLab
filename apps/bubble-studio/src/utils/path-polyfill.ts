// Browser polyfill for Node.js 'path' module
// Provides minimal path utilities for browser compatibility

// Simple path utilities that work in browser
export const join = (...paths: string[]): string => {
  return (
    paths.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/\/$/, '') ||
    '/'
  );
};

export const resolve = (...paths: string[]): string => {
  const joined = join(...paths);
  // In browser, resolve to absolute-like path (prepend /)
  if (!joined.startsWith('/')) {
    return '/' + joined;
  }
  return joined;
};

export const dirname = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return '/' + parts.join('/') || '/';
};

export const basename = (path: string, ext?: string): string => {
  const parts = path.split('/').filter(Boolean);
  let name = parts[parts.length - 1] || '';
  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length);
  }
  return name;
};

export const extname = (path: string): string => {
  const parts = path.split('/');
  const filename = parts[parts.length - 1] || '';
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot) : '';
};

export const normalize = (path: string): string => {
  return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
};

export const isAbsolute = (path: string): boolean => {
  return path.startsWith('/');
};

export const relative = (from: string, to: string): string => {
  // Simplified relative path calculation
  const fromParts = from.split('/').filter(Boolean);
  const toParts = to.split('/').filter(Boolean);

  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  const upLevels = fromParts.length - commonLength;
  const downPath = toParts.slice(commonLength).join('/');

  return '../'.repeat(upLevels) + downPath || '.';
};

export const sep = '/';
export const delimiter = ':';

// POSIX-specific path utilities (same as regular path in browser)
export const posix = {
  join,
  resolve,
  dirname,
  basename,
  extname,
  normalize,
  isAbsolute,
  relative,
  sep: '/',
  delimiter: ':',
};

// Windows-specific path utilities (stubs for browser)
export const win32 = {
  join: (...paths: string[]) => paths.join('\\'),
  resolve: (...paths: string[]) => paths.join('\\'),
  dirname: (path: string) => {
    const parts = path.split('\\');
    parts.pop();
    return parts.join('\\') || '\\';
  },
  basename,
  extname,
  normalize: (path: string) => path.replace(/\\+/g, '\\'),
  isAbsolute: (path: string) =>
    /^[A-Z]:\\/.test(path) || path.startsWith('\\\\'),
  relative: (from: string, to: string) =>
    relative(from.replace(/\\/g, '/'), to.replace(/\\/g, '/')).replace(
      /\//g,
      '\\'
    ),
  sep: '\\',
  delimiter: ';',
};

// Export default object
export default {
  join,
  resolve,
  dirname,
  basename,
  extname,
  normalize,
  isAbsolute,
  relative,
  sep,
  delimiter,
  posix,
  win32,
};
