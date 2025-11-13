/**
 * BubblePromptInput - Simple textarea that displays selected bubble context
 * Shows selected bubbles separately on top of the textarea
 */
import { KeyboardEvent, ChangeEvent } from 'react';
import { BubbleTag } from './BubbleTag';
import { X } from 'lucide-react';

interface BubblePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  flowId: number | null;
  selectedBubbleContext: number[]; // Bubble variable IDs from context
  onRemoveBubble?: (variableId: number) => void;
}

export function BubblePromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  disabled = false,
  className = '',
  selectedBubbleContext,
  onRemoveBubble,
}: BubblePromptInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey && !disabled && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="space-y-2">
      {/* Display selected bubble context on top if any exist */}
      {selectedBubbleContext.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {selectedBubbleContext.map((variableId) => (
            <div
              key={variableId}
              className="relative group inline-flex items-center gap-1"
            >
              <BubbleTag variableId={variableId} />
              {onRemoveBubble && (
                <button
                  type="button"
                  onClick={() => onRemoveBubble(variableId)}
                  disabled={disabled}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Remove bubble from context"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Textarea for text input */}
      <textarea
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        style={{
          minHeight: '80px',
          height: '80px',
          resize: 'none',
        }}
      />
    </div>
  );
}
