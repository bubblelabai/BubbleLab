/**
 * MarkdownWithBubbles - ReactMarkdown wrapper that supports bubble tags
 * Pure component that pre-processes bubble tags before rendering markdown
 */
import ReactMarkdown from 'react-markdown';
import { sharedMarkdownComponents } from '../shared/MarkdownComponents';
import { parseBubbleTags } from '../../utils/bubbleTagParser';
import { BubbleTag } from './BubbleTag';
import { useBubbleDetail } from '../../hooks/useBubbleDetail';

interface MarkdownWithBubblesProps {
  content: string;
  flowId: number | null;
  className?: string;
}

export function MarkdownWithBubbles({
  content,
  flowId,
  className = '',
}: MarkdownWithBubblesProps) {
  const bubbleDetail = useBubbleDetail(flowId);
  const segments = parseBubbleTags(content);

  // If no bubble tags, just render markdown normally
  if (segments.every((s) => s.type === 'text')) {
    return (
      <div className={className}>
        <ReactMarkdown components={sharedMarkdownComponents}>
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
            <ReactMarkdown key={index} components={sharedMarkdownComponents}>
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
