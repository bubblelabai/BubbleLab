import { useMemo, memo } from 'react';
import {
  getCacheKey,
  evictCacheIfNeeded,
  jsonCache,
  syntaxHighlightJson,
} from '../../utils/executionLogsFormatUtils';

/**
 * Memoized JSON renderer component
 * Use this component instead of renderJson function for better performance in React
 *
 * Accepts optional context (flowId, executionId, timestamp) for better cache locality
 * The cache key uses hash instead of full JSON string to save memory
 *
 * Note: React.memo compares props by reference, so this works best when the same
 * data object reference is passed. The internal cache still helps even if React
 * re-renders due to new object references.
 */
export const JsonRenderer = memo(function JsonRenderer({
  data,
  flowId,
  executionId,
  timestamp,
}: {
  data: unknown;
  flowId?: number | null;
  executionId?: number;
  timestamp?: string;
}) {
  const highlighted = useMemo(() => {
    // Generate JSON string first
    let jsonString: string;
    try {
      jsonString = JSON.stringify(data, null, 2);
    } catch (error) {
      jsonString = `[Error serializing data: ${error instanceof Error ? error.message : String(error)}]`;
    }

    // Use hash-based cache key (with optional context for better locality)
    const cacheKey = getCacheKey(jsonString, {
      flowId,
      executionId,
      timestamp,
    });

    // Check cache first
    if (jsonCache.has(cacheKey)) {
      return jsonCache.get(cacheKey)!;
    }

    // Apply syntax highlighting
    const highlighted = syntaxHighlightJson(jsonString);

    // Cache the result (with size limit)
    evictCacheIfNeeded();
    jsonCache.set(cacheKey, highlighted);

    return highlighted;
  }, [data, flowId, executionId, timestamp]); // Include data in dependencies!

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
});
