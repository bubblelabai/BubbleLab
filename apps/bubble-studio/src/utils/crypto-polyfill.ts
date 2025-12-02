// Browser polyfill for Node.js 'crypto' module
// Maps Node.js crypto APIs to Web Crypto API equivalents

// Use Web Crypto API's randomUUID if available, otherwise fallback
export const randomUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Stub for createHmac - returns an object that throws when methods are called
// This prevents errors during module import, but will fail gracefully if actually used
export const createHmac = (algorithm: string, key: string | Buffer) => {
  const errorMsg = `crypto.createHmac('${algorithm}', ...) is not available in browser environment. This functionality requires Node.js runtime.`;
  return {
    update: () => {
      throw new Error(errorMsg);
    },
    digest: () => {
      throw new Error(errorMsg);
    },
  };
};

// Export minimal crypto polyfill
export default {
  randomUUID,
  createHmac,
};
