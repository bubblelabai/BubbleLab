/**
 * BubblePromptInput - Simple textarea that displays text with bubble tags
 * Pure component that parses value and renders bubble tags inline
 */
import { KeyboardEvent, ChangeEvent } from 'react';
import { parseBubbleTags } from '../../utils/bubbleTagParser';
import { BubbleTag } from './BubbleTag';
import { useBubbleDetail } from '../../hooks/useBubbleDetail';

interface BubblePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  flowId: number | null;
}

export function BubblePromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  disabled = false,
  className = '',
  flowId,
}: BubblePromptInputProps) {
  const bubbleDetail = useBubbleDetail(flowId);

  // Parse the value and render segments
  const segments = parseBubbleTags(value);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey && !disabled && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  console.log('[BubblePromptInput] segments', segments);
  // Check if there are any bubble tags
  const hasBubbles = segments.some((s) => s.type === 'bubble');

  return (
    <div className="relative">
      {/* Always show textarea for editing */}
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`${className} ${hasBubbles ? 'text-transparent caret-gray-100' : ''}`}
        style={{
          minHeight: '80px',
          height: '80px',
          resize: 'none',
        }}
      />

      {/* Overlay with bubble tags when they exist */}
      {hasBubbles && (
        <div
          className={`absolute inset-0 pointer-events-none ${className}`}
          style={{
            minHeight: '80px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {segments.map((segment, index) => {
            if (segment.type === 'text') {
              return <span key={index}>{segment.content}</span>;
            } else {
              return <BubbleTag key={index} variableId={segment.variableId!} />;
            }
          })}
        </div>
      )}
    </div>
  );
}
