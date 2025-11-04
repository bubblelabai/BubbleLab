export type StorableValue = {
  truncated: boolean;
  preview: string | unknown;
  sizeBytes: number;
};

/**
 * Prepare an object for storage with a size cap. If the JSON stringified
 * representation exceeds maxBytes, return a preview marker with metadata.
 * Also logs a warning when truncation happens.
 *
 * Returns a consistent object structure when truncated to ensure compatibility
 * with database schemas expecting JSON objects (jsonb/text with mode: 'json').
 */
export function prepareForStorage(
  value: unknown,
  options?: { maxBytes?: number; previewBytes?: number }
): StorableValue {
  const maxBytes = options?.maxBytes ?? 1024 * 1024; // 1MB
  const previewBytes = options?.previewBytes ?? 4096; // 4KB

  try {
    const json = JSON.stringify(value);
    // Compute byte length in a way that works in both browser and Node
    const sizeBytes =
      typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(json).length
        : ((globalThis as any).Buffer?.byteLength?.(json, 'utf8') ??
          json.length);
    if (sizeBytes > maxBytes) {
      // eslint-disable-next-line no-console
      console.warn(
        `[prepareForStorage] Size ${sizeBytes} > ${maxBytes}. Storing preview only.`
      );
      // Use Buffer.slice to ensure we slice at byte boundaries, not character boundaries
      // This prevents splitting multi-byte UTF-8 characters
      const previewBuffer =
        json.slice(0, previewBytes) + '....truncated due to size limit';
      return {
        truncated: true,
        preview: previewBuffer,
        sizeBytes,
      };
    }
    return {
      truncated: false,
      preview: value,
      sizeBytes: 0,
    };
  } catch (_err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[prepareForStorage] Failed to serialize value for size check. Storing preview only.'
    );
    return {
      truncated: true,
      preview: '',
      sizeBytes: 0,
    };
  }
}

export function cleanUpObjectForDisplayAndStorage(
  obj: unknown,
  maxBytes: number = 1024 * 1024
): unknown {
  const storageResult = prepareForStorage(obj, { maxBytes });
  if (storageResult.truncated) {
    return storageResult.preview;
  }
  return obj;
}
