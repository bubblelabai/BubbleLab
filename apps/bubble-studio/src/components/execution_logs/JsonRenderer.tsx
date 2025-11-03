import { useMemo, memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  getCacheKey,
  evictCacheIfNeeded,
  jsonCache,
  syntaxHighlightJson,
} from '../../utils/executionLogsFormatUtils';

// Constants for truncation
const MAX_STRING_LENGTH = 50000; // ~50KB preview
const MAX_PREVIEW_LENGTH = 10000; // ~10KB preview
const MAX_DEPTH = 10; // Maximum nesting depth
const MAX_ARRAY_ITEMS = 50; // Maximum array items to show
const MAX_OBJECT_KEYS = 50; // Maximum object keys to show

/**
 * Detect if a string contains markdown patterns
 */
function isMarkdown(str: string): boolean {
  // Check for common markdown patterns
  const markdownPatterns = [
    /^#{1,6}\s+/m, // Headers
    /\[([^\]]+)\]\(([^)]+)\)/, // Links
    /!\[([^\]]*)\]\(([^)]+)\)/, // Images
    /```[\s\S]*?```/, // Code blocks
    /`[^`]+`/, // Inline code
    /\*\*[^*]+\*\*/, // Bold
    /\*[^*]+\*/, // Italic
    /^[-*+]\s+/m, // Lists
    /^\d+\.\s+/m, // Numbered lists
    /^>/m, // Blockquotes
    /^---/m, // Horizontal rules
  ];

  return markdownPatterns.some((pattern) => pattern.test(str));
}

/**
 * Detect if a string contains HTML tags
 */
function isHTML(str: string): boolean {
  // First unescape to check for actual HTML tags
  const unescaped = unescapeContent(str);
  // Check for HTML tags (opening tags, closing tags, self-closing tags)
  const htmlPattern = /<[a-z][\s\S]*?>/i;
  // Also check for common HTML entities that suggest HTML content
  const hasHtmlEntities = /&(?:[a-z]+|#\d+);/i.test(unescaped);
  return (
    htmlPattern.test(unescaped) || (hasHtmlEntities && unescaped.length > 50)
  );
}

/**
 * Unescape HTML entities and newlines
 */
function unescapeContent(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

/**
 * Detect if a string is a JSON string (contains JSON that can be parsed)
 */
function isJSONString(str: string): boolean {
  // First unescape to check the actual content
  const unescaped = unescapeContent(str.trim());

  // Check if it starts with JSON-like structures
  const startsWithJson = /^[\s]*[{\[]/.test(unescaped);
  if (!startsWithJson) {
    return false;
  }

  // Try to parse it to confirm it's valid JSON
  try {
    JSON.parse(unescaped);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a JSON string safely
 */
function parseJSONString(str: string): unknown | null {
  try {
    const unescaped = unescapeContent(str);
    return JSON.parse(unescaped);
  } catch {
    return null;
  }
}

/**
 * Truncate a string intelligently at a good break point
 */
function truncateString(
  str: string,
  maxLength: number
): { truncated: string; isTruncated: boolean } {
  if (str.length <= maxLength) {
    return { truncated: str, isTruncated: false };
  }

  // Try to find a good break point (newline, space, or punctuation)
  const searchWindow = Math.min(5000, maxLength / 2);
  const searchSection = str.substring(maxLength - searchWindow, maxLength);

  // Look for last newline
  const lastNewline = searchSection.lastIndexOf('\n');
  if (lastNewline !== -1) {
    return {
      truncated: str.substring(0, maxLength - searchWindow + lastNewline),
      isTruncated: true,
    };
  }

  // Look for last space
  const lastSpace = searchSection.lastIndexOf(' ');
  if (lastSpace !== -1) {
    return {
      truncated: str.substring(0, maxLength - searchWindow + lastSpace),
      isTruncated: true,
    };
  }

  // Just truncate
  return { truncated: str.substring(0, maxLength), isTruncated: true };
}

/**
 * Component for truncated content with expand functionality
 */
function TruncatedContent({
  fullContent,
  previewContent,
  fullLength,
  previewLength,
}: {
  fullContent: React.ReactNode;
  previewContent: React.ReactNode;
  fullLength: number;
  previewLength: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (fullLength <= previewLength) {
    return <>{fullContent}</>;
  }

  const sizeKB = Math.round(fullLength / 1024);
  const previewKB = Math.round(previewLength / 1024);

  return (
    <div>
      {isExpanded ? (
        <>
          {fullContent}
          <button
            onClick={() => setIsExpanded(false)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
          >
            Show less ({sizeKB}KB)
          </button>
        </>
      ) : (
        <>
          {previewContent}
          <div className="mt-2 text-xs text-yellow-400 italic">
            ... (preview only, {previewKB}KB of {sizeKB}KB total)
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
          >
            Show full content ({sizeKB}KB)
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Render a string value - either as JSON, markdown, HTML, or regular string
 */
function renderStringValue(
  value: string,
  isInline: boolean = false,
  depth: number = 0
): React.ReactNode {
  const originalLength = value.length;
  const shouldTruncate = originalLength > MAX_STRING_LENGTH;

  // Truncate if needed
  let displayValue = value;
  let isTruncated = false;
  if (shouldTruncate) {
    const result = truncateString(value, MAX_PREVIEW_LENGTH);
    displayValue = result.truncated;
    isTruncated = result.isTruncated;
  }

  // Check if it's a JSON string first (highest priority)
  if (isJSONString(value)) {
    const parsed = parseJSONString(value);
    if (parsed !== null) {
      const previewParsed = isTruncated ? parseJSONString(displayValue) : null;
      const content = (
        <div className="ml-2 border-l-2 border-blue-600/30 pl-2 py-1">
          {renderValue(parsed, depth + 1)}
        </div>
      );
      const previewContent = previewParsed ? (
        <div className="ml-2 border-l-2 border-blue-600/30 pl-2 py-1">
          {renderValue(previewParsed, depth + 1)}
        </div>
      ) : (
        content
      );

      return isTruncated ? (
        <TruncatedContent
          fullContent={content}
          previewContent={previewContent}
          fullLength={originalLength}
          previewLength={MAX_PREVIEW_LENGTH}
        />
      ) : (
        content
      );
    }
  }

  // Check if it's markdown
  if (isMarkdown(value)) {
    const unescaped = unescapeContent(value);
    const previewUnescaped = isTruncated
      ? unescapeContent(displayValue)
      : unescaped;
    const containerClass = isInline
      ? 'prose prose-invert prose-sm max-w-none inline-block'
      : 'prose prose-invert prose-sm max-w-none my-2';

    const markdownContent = (
      <div className={containerClass}>
        <ReactMarkdown
          components={{
            img: ({ src, alt }) => (
              <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded my-2"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                {children}
              </a>
            ),
            code: ({ className, children }) => {
              const isInlineCode = !className;
              return isInlineCode ? (
                <code className="bg-gray-800 px-1 py-0.5 rounded text-xs">
                  {children}
                </code>
              ) : (
                <code className="block bg-gray-800 p-2 rounded my-2 overflow-x-auto">
                  {children}
                </code>
              );
            },
          }}
        >
          {unescaped}
        </ReactMarkdown>
      </div>
    );

    const previewMarkdown = isTruncated ? (
      <div className={containerClass}>
        <ReactMarkdown
          components={{
            img: ({ src, alt }) => (
              <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded my-2"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                {children}
              </a>
            ),
            code: ({ className, children }) => {
              const isInlineCode = !className;
              return isInlineCode ? (
                <code className="bg-gray-800 px-1 py-0.5 rounded text-xs">
                  {children}
                </code>
              ) : (
                <code className="block bg-gray-800 p-2 rounded my-2 overflow-x-auto">
                  {children}
                </code>
              );
            },
          }}
        >
          {previewUnescaped}
        </ReactMarkdown>
      </div>
    ) : (
      markdownContent
    );

    return isTruncated ? (
      <TruncatedContent
        fullContent={markdownContent}
        previewContent={previewMarkdown}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    ) : (
      markdownContent
    );
  }

  // Check if it's HTML
  if (isHTML(value)) {
    const unescaped = unescapeContent(value);
    const previewUnescaped = isTruncated
      ? unescapeContent(displayValue)
      : unescaped;
    const containerClass = isInline
      ? 'prose prose-invert prose-sm max-w-none inline-block [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_a]:text-blue-400 [&_a]:hover:text-blue-300 [&_a]:underline'
      : 'prose prose-invert prose-sm max-w-none my-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_a]:text-blue-400 [&_a]:hover:text-blue-300 [&_a]:underline';

    const htmlContent = (
      <div
        className={containerClass}
        dangerouslySetInnerHTML={{ __html: unescaped }}
      />
    );

    const previewHtml = isTruncated ? (
      <div
        className={containerClass}
        dangerouslySetInnerHTML={{ __html: previewUnescaped }}
      />
    ) : (
      htmlContent
    );

    return isTruncated ? (
      <TruncatedContent
        fullContent={htmlContent}
        previewContent={previewHtml}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    ) : (
      htmlContent
    );
  }

  // Regular string - truncate if too long
  if (shouldTruncate) {
    return (
      <TruncatedContent
        fullContent={<span className="text-gray-200">"{value}"</span>}
        previewContent={<span className="text-gray-200">"{displayValue}"</span>}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    );
  }

  return <span className="text-gray-200">"{value}"</span>;
}

/**
 * Recursively render data with special handling for markdown/HTML
 * Preserves JSON structure while rendering markdown/HTML fields inline
 */
function renderValue(value: unknown, depth: number = 0): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-red-300">null</span>;
  }

  if (typeof value === 'string') {
    return renderStringValue(value, false, depth);
  }

  if (typeof value === 'number') {
    return <span className="text-orange-300">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-blue-400">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400">[]</span>;
    }

    // Limit array items if too many
    const shouldLimit = value.length > MAX_ARRAY_ITEMS;
    const itemsToShow = shouldLimit ? MAX_ARRAY_ITEMS : value.length;

    return (
      <div className="ml-4 border-l border-gray-700 pl-2">
        {value.slice(0, itemsToShow).map((item, index) => (
          <div key={index} className="my-1">
            <span className="text-gray-500">[{index}]</span>{' '}
            {renderValue(item, depth + 1)}
          </div>
        ))}
        {shouldLimit && (
          <div className="my-1 text-xs text-yellow-400 italic">
            ... ({value.length - MAX_ARRAY_ITEMS} more items)
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400">{'{}'}</span>;
    }

    // Limit depth and object keys
    if (depth >= MAX_DEPTH) {
      return (
        <span className="text-gray-400 text-xs italic">
          (max depth reached)
        </span>
      );
    }

    const shouldLimit = entries.length > MAX_OBJECT_KEYS;
    const keysToShow = shouldLimit ? MAX_OBJECT_KEYS : entries.length;

    return (
      <div className="ml-4 border-l border-gray-700 pl-2 py-1">
        {entries.slice(0, keysToShow).map(([key, val]) => (
          <div key={key} className="my-1.5">
            <span className="text-purple-300">"{key}"</span>
            <span className="text-gray-500">:</span>{' '}
            {typeof val === 'string' &&
            (isJSONString(val) || isMarkdown(val) || isHTML(val)) ? (
              <div className="mt-1 -ml-2">
                {renderStringValue(val, false, depth + 1)}
              </div>
            ) : (
              renderValue(val, depth + 1)
            )}
          </div>
        ))}
        {shouldLimit && (
          <div className="my-1 text-xs text-yellow-400 italic">
            ... ({entries.length - MAX_OBJECT_KEYS} more keys)
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return <span className="text-gray-300">{String(value)}</span>;
}

/**
 * Cache for enhanced renderer results (JSON strings, markdown, HTML)
 * Key: Hash of serialized data, Value: React component tree
 */
const enhancedRendererCache = new Map<string, React.ReactNode>();
const MAX_ENHANCED_CACHE_SIZE = 100; // Limit cache size to prevent memory issues

/**
 * Clear oldest cache entries from enhanced renderer cache when limit is reached
 */
function evictEnhancedCacheIfNeeded() {
  if (enhancedRendererCache.size >= MAX_ENHANCED_CACHE_SIZE) {
    // Remove oldest entry (first key in Map)
    const firstKey = enhancedRendererCache.keys().next().value;
    if (firstKey !== undefined) {
      enhancedRendererCache.delete(firstKey);
    }
  }
}

/**
 * Memoized JSON renderer component with markdown/HTML support
 * Use this component instead of renderJson function for better performance in React
 *
 * Accepts optional context (flowId, executionId, timestamp) for better cache locality
 * The cache key uses hash instead of full JSON string to save memory
 *
 * This component intelligently detects and renders:
 * - JSON strings (nested JSON within strings, parsed and rendered recursively)
 * - Markdown content (with proper formatting, images, links)
 * - HTML content (with proper styling)
 * - Regular JSON (with syntax highlighting)
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
  const rendered = useMemo(() => {
    // Check if data contains JSON strings, markdown/HTML content
    // If so, use the enhanced renderer, otherwise use JSON highlighting
    const hasSpecialContent = (val: unknown): boolean => {
      if (typeof val === 'string') {
        return isJSONString(val) || isMarkdown(val) || isHTML(val);
      }
      if (Array.isArray(val)) {
        return val.some(hasSpecialContent);
      }
      if (val && typeof val === 'object') {
        return Object.values(val).some(hasSpecialContent);
      }
      return false;
    };

    if (hasSpecialContent(data)) {
      // Use enhanced renderer for markdown/HTML content
      // Generate cache key for enhanced renderer
      let cacheKey: string;
      try {
        const jsonString = JSON.stringify(data);
        cacheKey = getCacheKey(jsonString, {
          flowId,
          executionId,
          timestamp,
        });
      } catch (error) {
        // If serialization fails, render without cache
        return renderValue(data);
      }

      // Check cache first
      if (enhancedRendererCache.has(cacheKey)) {
        return enhancedRendererCache.get(cacheKey)!;
      }

      // Render and cache the result
      const rendered = renderValue(data);

      // Cache the result (with size limit)
      evictEnhancedCacheIfNeeded();
      enhancedRendererCache.set(cacheKey, rendered);

      return rendered;
    }

    // Fallback to JSON syntax highlighting for regular JSON
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
      const cached = jsonCache.get(cacheKey)!;
      return <span dangerouslySetInnerHTML={{ __html: cached }} />;
    }

    // Apply syntax highlighting
    const highlighted = syntaxHighlightJson(jsonString);

    // Cache the result (with size limit)
    evictCacheIfNeeded();
    jsonCache.set(cacheKey, highlighted);

    return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
  }, [data, flowId, executionId, timestamp]);

  return <>{rendered}</>;
});
