/**
 * BubbleText - Component that parses and renders text with inline bubble tags
 * Converts <bubble>variableId</bubble> to visual bubble components
 */
import { parseBubbleTags } from '../../utils/bubbleTagParser';
import { BubbleTag } from './BubbleTag';

interface BubbleTextProps {
  text: string;
  className?: string;
}

export function BubbleText({ text, className = '' }: BubbleTextProps) {
  const segments = parseBubbleTags(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        } else {
          return <BubbleTag key={index} variableId={segment.variableId!} />;
        }
      })}
    </span>
  );
}
