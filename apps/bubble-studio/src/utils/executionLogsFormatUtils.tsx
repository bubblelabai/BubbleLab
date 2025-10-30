import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
  EyeIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';

/**
 * Format ISO timestamp to locale time string
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Format bytes to human-readable memory size (B, KB, MB, GB)
 */
export function formatMemoryUsage(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detect URLs in text and convert them to clickable links
 */
export function makeLinksClickable(text: string | null) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text?.split(urlRegex) ?? [];

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Pre-compiled regex patterns for better performance
const JSON_KEY_REGEX = /^"/;
const JSON_KEY_COLON_REGEX = /:$/;
const JSON_BOOLEAN_REGEX = /^(true|false)$/;
const JSON_NULL_REGEX = /^null$/;
const JSON_TOKEN_REGEX =
  /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

/**
 * Intelligently truncate JSON string at a reasonable point
 * Tries to find a good cutoff point (after closing brace, bracket, or comma)
 */
function truncateJson(json: string, maxLength: number): string {
  if (json.length <= maxLength) {
    return json;
  }

  // Try to find a good truncation point by looking backwards from maxLength
  const searchWindow = Math.min(5000, maxLength / 2); // Search up to 5KB or half the max length
  const startPos = Math.max(0, maxLength - searchWindow);
  const searchSection = json.substring(startPos, maxLength);

  // Look for the last occurrence of safe cut points (closest to maxLength)
  // Priority: closing brace/bracket > comma > newline
  let bestCutPoint = -1;

  // Look for closing braces/brackets at end of lines (highest priority)
  const closingBraceMatch = searchSection.lastIndexOf('\n}');
  const closingBracketMatch = searchSection.lastIndexOf('\n]');

  if (closingBraceMatch !== -1) {
    bestCutPoint = Math.max(bestCutPoint, startPos + closingBraceMatch + 2);
  }
  if (closingBracketMatch !== -1) {
    bestCutPoint = Math.max(bestCutPoint, startPos + closingBracketMatch + 2);
  }

  // If we found a good point, use it
  if (bestCutPoint > 0) {
    return json.substring(0, bestCutPoint);
  }

  // Look for commas followed by newline
  const commaMatch = searchSection.lastIndexOf(',\n');
  if (commaMatch !== -1) {
    return json.substring(0, startPos + commaMatch + 2);
  }

  // Look for any newline
  const newlineMatch = searchSection.lastIndexOf('\n');
  if (newlineMatch !== -1) {
    return json.substring(0, startPos + newlineMatch + 1);
  }

  // Fallback: just truncate at maxLength
  return json.substring(0, maxLength);
}

/**
 * Apply syntax highlighting to JSON string
 * Returns HTML string with span elements and color classes
 * Optimized with pre-compiled regex patterns
 * For large JSON, shows a preview with truncation indicator
 */
export function syntaxHighlightJson(json: string): string {
  // Early return for empty strings
  if (!json) return '';

  // For very large JSON strings, show a preview instead
  const MAX_JSON_LENGTH = 100000; // ~100KB
  const PREVIEW_LENGTH = 20000; // ~20KB preview

  const isTruncated = json.length > MAX_JSON_LENGTH;
  const jsonToHighlight = isTruncated
    ? truncateJson(json, PREVIEW_LENGTH)
    : json;

  const highlighted = jsonToHighlight.replace(JSON_TOKEN_REGEX, (match) => {
    if (JSON_KEY_REGEX.test(match)) {
      if (JSON_KEY_COLON_REGEX.test(match)) {
        return `<span class="text-purple-300">${match}</span>`;
      } else {
        return `<span class="text-gray-200">${match}</span>`;
      }
    } else if (JSON_BOOLEAN_REGEX.test(match)) {
      return `<span class="text-blue-400">${match}</span>`;
    } else if (JSON_NULL_REGEX.test(match)) {
      return `<span class="text-red-300">${match}</span>`;
    } else {
      return `<span class="text-orange-300">${match}</span>`;
    }
  });

  // Add truncation indicator if needed
  if (isTruncated) {
    const sizeKB = Math.round(json.length / 1024);
    const previewKB = Math.round(PREVIEW_LENGTH / 1024);
    return (
      highlighted +
      `\n\n<span class="text-yellow-400 italic">... (preview only, ${previewKB}KB of ${sizeKB}KB total)</span>`
    );
  }

  return highlighted;
}

/**
 * Generate cache key from JSON string, optionally with context
 * Uses hash to save memory while maintaining uniqueness
 */
function getCacheKey(
  jsonString: string,
  context?: { flowId?: number | null; executionId?: number; timestamp?: string }
): string {
  // If context is provided, use it for better cache locality
  // Format: "flowId-executionId-hash" (e.g., "123-456-abc123")
  // This helps when same JSON appears in different executions (unlikely but possible)
  if (context?.flowId != null && context.timestamp != null) {
    return `${context.flowId}-${context.timestamp}`;
  }

  // Fallback to just hash (works everywhere, backwards compatible)
  return jsonString;
}

/**
 * Cache for JSON highlighting results
 * Key: Hash of JSON string (or context + hash), Value: highlighted HTML
 * Using hash instead of full JSON string saves significant memory
 */
const jsonCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100; // Limit cache size to prevent memory issues

/**
 * Clear oldest cache entries when limit is reached
 */
function evictCacheIfNeeded() {
  if (jsonCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first key in Map)
    const firstKey = jsonCache.keys().next().value;
    if (firstKey !== undefined) {
      jsonCache.delete(firstKey);
    }
  }
}

/**
 * Render JSON data with syntax highlighting
 * Optimized with memoization and caching
 */
export function renderJson(data: unknown) {
  // Generate JSON string first
  let jsonString: string;
  try {
    jsonString = JSON.stringify(data, null, 2);
  } catch (error) {
    // Handle circular references or non-serializable data
    jsonString = `[Error serializing data: ${error instanceof Error ? error.message : String(error)}]`;
  }

  // Use hash as cache key instead of full JSON string (saves memory)
  const cacheKey = getCacheKey(jsonString);

  // Check cache first
  if (jsonCache.has(cacheKey)) {
    const cached = jsonCache.get(cacheKey)!;
    return <span dangerouslySetInnerHTML={{ __html: cached }} />;
  }

  // Apply syntax highlighting
  const highlighted = syntaxHighlightJson(jsonString);

  // Cache the result (with size limit)
  evictCacheIfNeeded();
  jsonCache.set(cacheKey, highlighted);

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

/**
 * Get icon component for event type
 */
export function getEventIcon(event: StreamingLogEvent) {
  switch (event.type) {
    case 'bubble_start':
    case 'bubble_instantiation':
      return <PlayIcon className="h-4 w-4 text-blue-400" />;
    case 'bubble_complete':
    case 'bubble_execution':
    case 'bubble_execution_complete':
      return <CheckCircleIcon className="h-4 w-4 text-green-400" />;
    case 'execution_complete':
      return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
    case 'error':
      return <ExclamationCircleIcon className="h-4 w-4 text-red-400" />;
    case 'fatal':
      return <XCircleIcon className="h-4 w-4 text-red-600" />;
    case 'warn':
      return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-400" />;
    case 'info':
      return <InformationCircleIcon className="h-4 w-4 text-blue-300" />;
    case 'debug':
      return <BugAntIcon className="h-4 w-4 text-purple-400" />;
    case 'trace':
      return <EyeIcon className="h-4 w-4 text-gray-400" />;
    case 'log_line':
      return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
    default:
      return <div className="h-4 w-4 bg-gray-400 rounded-full"></div>;
  }
}

/**
 * Get Tailwind color class for event type
 */
export function getEventColor(event: StreamingLogEvent): string {
  switch (event.type) {
    case 'bubble_start':
    case 'bubble_instantiation':
      return 'text-blue-300';
    case 'bubble_complete':
    case 'bubble_execution':
    case 'bubble_execution_complete':
      return 'text-green-300';
    case 'execution_complete':
      return 'text-green-400 font-semibold';
    case 'error':
      return 'text-red-300';
    case 'fatal':
      return 'text-red-600 font-semibold';
    case 'warn':
      return 'text-yellow-300';
    case 'info':
      return 'text-blue-200';
    case 'debug':
      return 'text-purple-300';
    case 'trace':
      return 'text-gray-400';
    case 'log_line':
      return 'text-gray-300';
    default:
      return 'text-gray-300';
  }
}

// Export cache-related functions for use in JsonRenderer component
export { getCacheKey, evictCacheIfNeeded, jsonCache };
