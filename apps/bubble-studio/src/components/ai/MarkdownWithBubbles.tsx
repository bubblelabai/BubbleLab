/**
 * MarkdownWithBubbles - ReactMarkdown wrapper that supports bubble tags
 * Pure component that pre-processes bubble tags before rendering markdown
 */
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { sharedMarkdownComponents } from '../shared/MarkdownComponents';
import { parseBubbleTags } from '../../utils/bubbleTagParser';
import { BubbleTag } from './BubbleTag';

interface MarkdownWithBubblesProps {
  content: string;
  className?: string;
}

// Custom components with collapsible JSON code blocks
const markdownComponentsWithCollapsibleJson: Components = {
  ...sharedMarkdownComponents,
  // Override pre component to detect JSON and make it collapsible
  pre: ({ children }) => {
    // Check if this is a JSON code block by examining the code element
    const codeElement = Array.isArray(children) ? children[0] : children;
    const isJsonBlock =
      codeElement &&
      typeof codeElement === 'object' &&
      'props' in codeElement &&
      codeElement.props?.className?.includes('language-json');

    if (isJsonBlock) {
      return (
        <details className="group mb-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-400 hover:text-gray-300 mb-2 flex items-center gap-2 select-none">
            <svg
              className="w-3 h-3 transition-transform group-open:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <span>JSON Response</span>
          </summary>
          <div className="mt-2">
            <pre className="bg-gray-900/50 rounded-lg overflow-x-auto mb-2">
              {children}
            </pre>
          </div>
        </details>
      );
    }

    // For non-JSON code blocks, use the default rendering
    return (
      <pre className="bg-gray-900/50 rounded-lg overflow-x-auto mb-2">
        {children}
      </pre>
    );
  },
};

export function MarkdownWithBubbles({
  content,
  className = '',
}: MarkdownWithBubblesProps) {
  const segments = parseBubbleTags(content);

  // If no bubble tags, just render markdown normally
  if (segments.every((s) => s.type === 'text')) {
    return (
      <div className={className}>
        <ReactMarkdown components={markdownComponentsWithCollapsibleJson}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Render segments with bubble tags
  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          // Render text as markdown
          return (
            <ReactMarkdown
              key={index}
              components={markdownComponentsWithCollapsibleJson}
            >
              {segment.content}
            </ReactMarkdown>
          );
        } else {
          // Render bubble tag
          return <BubbleTag key={index} variableId={segment.variableId!} />;
        }
      })}
    </div>
  );
}
