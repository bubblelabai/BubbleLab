import { useMemo, memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  getCacheKey,
  simplifyObjectForContext,
} from '../../utils/executionLogsFormatUtils';
import { FileDownloadButton } from './FileDownloadButton';
import { isDownloadableFileUrl } from './downloadUtils';

// Constants for truncation
const MAX_STRING_LENGTH = 50000; // ~50KB preview
const MAX_PREVIEW_LENGTH = 10000; // ~10KB preview
const MAX_DEPTH = 10; // Maximum nesting depth
const MAX_ARRAY_ITEMS = 10; // Maximum array items to show
const MAX_OBJECT_KEYS = 20; // Maximum object keys to show

// Performance limits - skip expensive rendering for content beyond these
const MAX_MARKDOWN_LENGTH = 20000; // Skip markdown parsing beyond 20KB
const MAX_HTML_LENGTH = 20000; // Skip HTML rendering beyond 20KB
const MAX_JSON_STRING_LENGTH = 100000; // Skip nested JSON parsing beyond 100KB
const MAX_TOTAL_SIZE_BYTES = 500000; // ~500KB total size limit before skipping rendering

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
  const startsWithJson = /^[\s]*(?:\{|\[)/.test(unescaped);
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
 * Detect URLs in text and convert them to React components with clickable links
 * Similar to makeLinksClickable but returns React components
 * Adds download button for file URLs
 */
function renderStringWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s"<>]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        // Check if part is a URL by checking if it starts with http:// or https://
        const isUrl = part.startsWith('http://') || part.startsWith('https://');
        if (isUrl) {
          // Sanitize href to prevent javascript: and dangerous data URLs
          const safeHref =
            !part.toLowerCase().startsWith('javascript:') &&
            !part.toLowerCase().startsWith('data:text/html') &&
            !part.toLowerCase().startsWith('data:application/javascript')
              ? part
              : undefined;

          const isDownloadable = safeHref && isDownloadableFileUrl(safeHref);

          return (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 flex-wrap"
            >
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline break-all"
              >
                {part}
              </a>
              {isDownloadable && <FileDownloadButton url={safeHref} />}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

/**
 * Estimate the approximate size in bytes of a value
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 4; // "null" string
  }

  if (typeof value === 'string') {
    return value.length * 2; // Rough estimate: 2 bytes per char
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return 8; // Rough estimate
  }

  if (Array.isArray(value)) {
    let size = 2; // "[]"
    for (let i = 0; i < Math.min(value.length, 100); i++) {
      size += estimateSize(value[i]);
    }
    return size;
  }

  if (typeof value === 'object') {
    let size = 2; // "{}"
    const entries = Object.entries(value);
    for (let i = 0; i < Math.min(entries.length, 100); i++) {
      const [key, val] = entries[i];
      size += key.length * 2 + estimateSize(val);
    }
    return size;
  }

  return String(value).length * 2;
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
 * Uses lazy rendering - only creates full content when expanded to avoid performance issues
 */
function TruncatedContent({
  fullContentFactory,
  previewContent,
  fullLength,
  previewLength,
}: {
  fullContentFactory: () => React.ReactNode; // Lazy factory function
  previewContent: React.ReactNode;
  fullLength: number;
  previewLength: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (fullLength <= previewLength) {
    return <>{previewContent}</>;
  }

  const sizeKB = Math.round(fullLength / 1024);
  const previewKB = Math.round(previewLength / 1024);

  return (
    <div>
      {isExpanded ? (
        <>
          {fullContentFactory()}
          <button
            onClick={() => setIsExpanded(false)}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Show less ({sizeKB}KB)
          </button>
        </>
      ) : (
        <>
          {previewContent}
          <div className="mt-2 text-xs text-warning italic">
            ... (preview only, {previewKB}KB of {sizeKB}KB total)
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="mt-1 text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
          >
            Show full content ({sizeKB}KB)
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Sanitize HTML by removing style tags, inline styles, and script tags
 * This prevents CSS from affecting the execution history page styling
 */
function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Use DOM API for safer parsing (same approach as existing sanitizeHtml)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove <style> tags and their content (prevents CSS leakage)
  const styleTags = tempDiv.querySelectorAll('style');
  styleTags.forEach((style) => style.remove());

  // Remove <script> tags and their content (security)
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach((script) => script.remove());

  // Remove inline style attributes from all elements (prevents CSS leakage)
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((el) => {
    el.removeAttribute('style');
  });

  return tempDiv.innerHTML;
}

/**
 * Render a string value - either as JSON, markdown, HTML, or regular string
 * Includes early bailouts for large content to prevent performance issues
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

  // Early bailout: Skip expensive parsing for very large JSON strings
  if (originalLength > MAX_JSON_STRING_LENGTH) {
    const previewString = (
      <span className="text-foreground/90">
        "{renderStringWithLinks(displayValue)}"
      </span>
    );
    const sizeKB = Math.round(originalLength / 1024);
    return (
      <div>
        {previewString}
        <div className="mt-2 text-xs text-warning italic">
          Content too large to parse ({sizeKB}KB). Showing preview only.
        </div>
      </div>
    );
  }

  // Check if it's a JSON string first (highest priority)
  if (isJSONString(value)) {
    const parsed = parseJSONString(value);
    if (parsed !== null) {
      const previewParsed = isTruncated ? parseJSONString(displayValue) : null;
      const contentFactory = () => (
        <div className="ml-2 border-l-2 border-blue-600/30 pl-2 py-1">
          {renderValue(parsed, depth + 1)}
        </div>
      );
      const previewContent = previewParsed ? (
        <div className="ml-2 border-l-2 border-blue-600/30 pl-2 py-1">
          {renderValue(previewParsed, depth + 1)}
        </div>
      ) : (
        contentFactory()
      );

      return isTruncated ? (
        <TruncatedContent
          fullContentFactory={contentFactory}
          previewContent={previewContent}
          fullLength={originalLength}
          previewLength={MAX_PREVIEW_LENGTH}
        />
      ) : (
        contentFactory()
      );
    }
  }

  // Check if it's markdown - skip parsing if too large
  if (isMarkdown(value)) {
    // Skip expensive markdown parsing for very large content
    if (originalLength > MAX_MARKDOWN_LENGTH) {
      const previewString = (
        <span className="text-foreground/90">
          "{renderStringWithLinks(displayValue)}"
        </span>
      );
      const sizeKB = Math.round(originalLength / 1024);
      return (
        <div>
          {previewString}
          <div className="mt-2 text-xs text-warning italic">
            Markdown content too large to render ({sizeKB}KB). Showing preview
            only.
          </div>
        </div>
      );
    }

    const unescaped = unescapeContent(value);
    const previewUnescaped = isTruncated
      ? unescapeContent(displayValue)
      : unescaped;
    const containerClass = isInline
      ? 'prose prose-invert prose-sm max-w-none inline-block'
      : 'prose prose-invert prose-sm max-w-none my-2';

    const markdownComponents = {
      img: ({ src, alt, ...props }: React.ComponentProps<'img'>) => {
        const safeSrc =
          src &&
          !src.toLowerCase().startsWith('javascript:') &&
          !src.toLowerCase().startsWith('data:text/html') &&
          !src.toLowerCase().startsWith('data:application/javascript')
            ? src
            : undefined;
        return (
          <img
            {...props}
            src={safeSrc}
            alt={alt}
            className="max-w-full h-auto rounded my-2"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        );
      },
      a: ({ href, children, ...props }: React.ComponentProps<'a'>) => {
        const safeHref =
          href &&
          !href.toLowerCase().startsWith('javascript:') &&
          !href.toLowerCase().startsWith('data:text/html') &&
          !href.toLowerCase().startsWith('data:application/javascript')
            ? href
            : undefined;
        return (
          <a
            {...props}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-300 hover:text-white underline"
          >
            {children}
          </a>
        );
      },
      code: ({
        className,
        children,
        ...props
      }: React.ComponentProps<'code'>) => {
        const isInlineCode = !className;
        return isInlineCode ? (
          <code {...props} className="bg-muted px-1 py-0.5 rounded text-xs">
            {children}
          </code>
        ) : (
          <code
            {...props}
            className="block bg-muted p-2 rounded my-2 overflow-x-auto"
          >
            {children}
          </code>
        );
      },
    };

    const markdownContentFactory = () => (
      <div className={containerClass}>
        <ReactMarkdown components={markdownComponents}>
          {unescaped}
        </ReactMarkdown>
      </div>
    );

    const previewMarkdown = isTruncated ? (
      <div className={containerClass}>
        <ReactMarkdown components={markdownComponents}>
          {previewUnescaped}
        </ReactMarkdown>
      </div>
    ) : (
      markdownContentFactory()
    );

    return isTruncated ? (
      <TruncatedContent
        fullContentFactory={markdownContentFactory}
        previewContent={previewMarkdown}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    ) : (
      markdownContentFactory()
    );
  }

  // Check if it's HTML - skip rendering if too large
  if (isHTML(value)) {
    // Skip expensive HTML rendering for very large content
    if (originalLength > MAX_HTML_LENGTH) {
      const previewString = (
        <span className="text-foreground/90">
          "{renderStringWithLinks(displayValue)}"
        </span>
      );
      const sizeKB = Math.round(originalLength / 1024);
      return (
        <div>
          {previewString}
          <div className="mt-2 text-xs text-warning italic">
            HTML content too large to render ({sizeKB}KB). Showing preview only.
          </div>
        </div>
      );
    }

    const unescaped = unescapeContent(value);
    // Sanitize HTML to remove style tags and inline styles that could affect page styling
    const sanitized = sanitizeHTML(unescaped);
    const previewUnescaped = isTruncated
      ? sanitizeHTML(unescapeContent(displayValue))
      : sanitized;
    const containerClass = isInline
      ? 'prose prose-invert prose-sm max-w-none inline-block [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_a]:text-gray-300 [&_a]:hover:text-white [&_a]:underline [&_*]:outline-none'
      : 'prose prose-invert prose-sm max-w-none my-2 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-2 [&_a]:text-gray-300 [&_a]:hover:text-white [&_a]:underline [&_*]:outline-none';

    const htmlContentFactory = () => (
      <div
        className={containerClass}
        dangerouslySetInnerHTML={{ __html: sanitized }}
        style={{ outline: 'none' }}
      />
    );

    const previewHtml = isTruncated ? (
      <div
        className={containerClass}
        dangerouslySetInnerHTML={{ __html: previewUnescaped }}
        style={{ outline: 'none' }}
      />
    ) : (
      htmlContentFactory()
    );

    return isTruncated ? (
      <TruncatedContent
        fullContentFactory={htmlContentFactory}
        previewContent={previewHtml}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    ) : (
      htmlContentFactory()
    );
  }

  // Regular string - detect and highlight URLs, then truncate if too long
  const stringWithLinksFactory = () => (
    <span className="text-foreground/90">"{renderStringWithLinks(value)}"</span>
  );
  const previewStringWithLinks = (
    <span className="text-foreground/90">
      "{renderStringWithLinks(displayValue)}"
    </span>
  );

  if (shouldTruncate) {
    return (
      <TruncatedContent
        fullContentFactory={stringWithLinksFactory}
        previewContent={previewStringWithLinks}
        fullLength={originalLength}
        previewLength={MAX_PREVIEW_LENGTH}
      />
    );
  }

  return stringWithLinksFactory();
}

/**
 * Recursively render data with special handling for markdown/HTML
 * Preserves JSON structure while rendering markdown/HTML fields inline
 * Includes size checks to prevent performance issues with large content
 */
function renderValue(value: unknown, depth: number = 0): React.ReactNode {
  // Early bailout: Skip rendering if content is too large
  if (depth === 0) {
    const estimatedSize = estimateSize(value);
    if (estimatedSize > MAX_TOTAL_SIZE_BYTES) {
      const sizeKB = Math.round(estimatedSize / 1024);
      const limitKB = Math.round(MAX_TOTAL_SIZE_BYTES / 1024);

      // Create a preview version of the data using existing simplifyObjectForContext
      let previewData: unknown;
      try {
        const simplifiedJson = simplifyObjectForContext(value);
        previewData = JSON.parse(simplifiedJson);
      } catch {
        // If parsing fails, use a minimal preview
        previewData = { error: 'Failed to create preview' };
      }

      return (
        <div>
          {/* Warning message */}
          <div className="p-4 border border-warning/50 rounded bg-warning/10 mb-4">
            <div className="text-warning font-semibold mb-2">
              Content too large to render
            </div>
            <div className="text-xs text-warning/80 mb-2">
              Estimated size: {sizeKB}KB (limit: {limitKB}KB)
            </div>
            <div className="text-xs text-muted-foreground">
              This content is too large to render safely.
            </div>
          </div>

          {/* Preview content */}
          <div className="opacity-75">
            <div className="text-xs text-muted-foreground/70 mb-2 italic">
              Preview (trimmed):
            </div>
            {renderValue(previewData, depth + 1)}
          </div>
        </div>
      );
    }
  }

  if (value === null || value === undefined) {
    return <span className="text-destructive/80">null</span>;
  }

  if (typeof value === 'string') {
    return renderStringValue(value, false, depth);
  }

  if (typeof value === 'number') {
    return <span className="text-foreground">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="text-foreground/90">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">[]</span>;
    }

    // Limit array items if too many
    const shouldLimit = value.length > MAX_ARRAY_ITEMS;
    const itemsToShow = shouldLimit ? MAX_ARRAY_ITEMS : value.length;

    return (
      <div className="ml-4 border-l border-border pl-2">
        {value.slice(0, itemsToShow).map((item, index) => (
          <div key={index} className="my-1">
            <span className="text-muted-foreground/70">[{index}]</span>{' '}
            {renderValue(item, depth + 1)}
          </div>
        ))}
        {shouldLimit && (
          <div className="my-1 text-xs text-warning italic">
            ... ({value.length - MAX_ARRAY_ITEMS} more items)
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-muted-foreground">{'{}'}</span>;
    }

    // Limit depth and object keys
    if (depth >= MAX_DEPTH) {
      return (
        <span className="text-muted-foreground text-xs italic">
          (max depth reached)
        </span>
      );
    }

    const shouldLimit = entries.length > MAX_OBJECT_KEYS;
    const keysToShow = shouldLimit ? MAX_OBJECT_KEYS : entries.length;

    return (
      <div className="ml-4 border-l border-border pl-2 py-1">
        {entries.slice(0, keysToShow).map(([key, val]) => (
          <div key={key} className="my-1.5">
            <span className="text-muted-foreground">"{key}"</span>
            <span className="text-muted-foreground/70">:</span>{' '}
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
          <div className="my-1 text-xs text-warning italic">
            ... ({entries.length - MAX_OBJECT_KEYS} more keys)
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return <span className="text-foreground/80">{String(value)}</span>;
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
    // Always use enhanced renderer for consistent nested structure with border lines
    // Generate cache key for enhanced renderer
    let cacheKey: string;
    try {
      const jsonString = JSON.stringify(data);
      cacheKey = getCacheKey(jsonString, {
        flowId,
        executionId,
        timestamp,
      });
    } catch {
      // If serialization fails, render without cache
      return renderValue(data);
    }

    // Check cache first
    if (enhancedRendererCache.has(cacheKey)) {
      return enhancedRendererCache.get(cacheKey)!;
    }

    // Render and cache the result
    // This will show the nested structure with border lines for all JSON
    const rendered = renderValue(data);

    // Cache the result (with size limit)
    evictEnhancedCacheIfNeeded();
    enhancedRendererCache.set(cacheKey, rendered);

    return rendered;
  }, [data, flowId, executionId, timestamp]);

  return <>{rendered}</>;
});
