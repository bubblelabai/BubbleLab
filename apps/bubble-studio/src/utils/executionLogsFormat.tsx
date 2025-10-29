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

/**
 * Apply syntax highlighting to JSON string
 * Returns HTML string with span elements and color classes
 */
export function syntaxHighlightJson(json: string): string {
  const highlighted = json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'text-orange-300'; // numbers
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-purple-300'; // keys
          return `<span class="${cls}">${match}</span>`;
        } else {
          cls = 'text-gray-200'; // string values
          return `<span class="${cls}">${match}</span>`;
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-blue-400'; // booleans
      } else if (/null/.test(match)) {
        cls = 'text-red-300'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
  return highlighted;
}

/**
 * Render JSON data with syntax highlighting
 */
export function renderJson(data: unknown) {
  const jsonString = JSON.stringify(data, null, 2);
  const highlighted = syntaxHighlightJson(jsonString);
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
