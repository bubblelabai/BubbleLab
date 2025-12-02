// Browser polyfill for Node.js 'fs' module
// Provides minimal fs APIs that throw helpful errors if actually used
// These are stubs to prevent import errors, but file operations won't work in browser

const throwFsError = (method: string) => {
  throw new Error(
    `fs.${method} is not available in browser environment. ` +
      'File system operations require Node.js runtime.'
  );
};

// Async methods - return rejected promises
export const stat = () =>
  Promise.reject(new Error('fs.stat is not available in browser'));
export const lstat = () =>
  Promise.reject(new Error('fs.lstat is not available in browser'));
export const readdir = () =>
  Promise.reject(new Error('fs.readdir is not available in browser'));
export const readFile = () =>
  Promise.reject(new Error('fs.readFile is not available in browser'));
export const writeFile = () =>
  Promise.reject(new Error('fs.writeFile is not available in browser'));
export const mkdir = () =>
  Promise.reject(new Error('fs.mkdir is not available in browser'));
export const access = () =>
  Promise.reject(new Error('fs.access is not available in browser'));
export const unlink = () =>
  Promise.reject(new Error('fs.unlink is not available in browser'));

// Sync methods - throw immediately
export const statSync = () => throwFsError('statSync');
export const lstatSync = () => throwFsError('lstatSync');
export const readdirSync = () => throwFsError('readdirSync');
export const readFileSync = () => throwFsError('readFileSync');
export const writeFileSync = () => throwFsError('writeFileSync');
export const mkdirSync = () => throwFsError('mkdirSync');
export const accessSync = () => throwFsError('accessSync');
export const unlinkSync = () => throwFsError('unlinkSync');
export const existsSync = () => false; // Return false for browser compatibility

// Promises API
export const promises = {
  stat,
  lstat,
  readdir,
  readFile,
  writeFile,
  mkdir,
  access,
  unlink,
};

// Export default object
export default {
  stat,
  lstat,
  readdir,
  readFile,
  writeFile,
  mkdir,
  access,
  unlink,
  statSync,
  lstatSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  accessSync,
  unlinkSync,
  existsSync,
  promises,
};
