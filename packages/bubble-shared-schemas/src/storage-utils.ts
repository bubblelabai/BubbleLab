export type StorableValue = unknown | string;

/**
 * Prepare an object for storage with a size cap. If the JSON stringified
 * representation exceeds maxBytes, return a preview marker with metadata.
 * Also logs a warning when truncation happens.
 */
export function prepareForStorage(
  value: unknown,
  options?: { maxBytes?: number; previewBytes?: number }
): StorableValue {
  const maxBytes = options?.maxBytes ?? 1024 * 1024; // 1MB
  const previewBytes = options?.previewBytes ?? 4096; // 4KB
  try {
    const json = JSON.stringify(value);
    const sizeBytes = Buffer.byteLength(json, 'utf8');
    if (sizeBytes > maxBytes) {
      // eslint-disable-next-line no-console
      console.warn(
        `[prepareForStorage] Size ${sizeBytes} > ${maxBytes}. Storing preview only.`
      );
      const preview = json.slice(0, previewBytes);
      return `response truncated due to size, preview ::: first ${preview.length} characters :: ${preview}`;
    }
    return value;
  } catch (_err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[prepareForStorage] Failed to serialize value for size check. Storing preview only.'
    );
    return 'response truncated due to size, preview ::: first 0 characters ::';
  }
}
