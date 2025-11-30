/**
 * BubblePromptInput - Simple textarea that displays selected bubble context
 * Shows selected bubbles and transformations separately on top of the textarea
 */
import {
  KeyboardEvent,
  ChangeEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';
import { BubbleTag } from './BubbleTag';
import { X, Code } from 'lucide-react';

interface BubblePromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  flowId: number | null;
  selectedBubbleContext: number[]; // Bubble variable IDs from context
  selectedTransformationContext: string | null; // Transformation function name
  onRemoveBubble?: (variableId: number) => void;
  onRemoveTransformation?: () => void;
}

export interface BubblePromptInputRef {
  focus: () => void;
  focusEnd: () => void;
}

export const BubblePromptInput = forwardRef<
  BubblePromptInputRef,
  BubblePromptInputProps
>(function BubblePromptInput(
  {
    value,
    onChange,
    onSubmit,
    placeholder = '',
    disabled = false,
    className = '',
    selectedBubbleContext,
    selectedTransformationContext,
    onRemoveBubble,
    onRemoveTransformation,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      textareaRef.current?.focus();
    },
    focusEnd: () => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        // Set cursor to end of text
        const length = textarea.value.length;
        textarea.setSelectionRange(length, length);
      }
    },
  }));
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
      {/* Display selected bubble or transformation context on top if any exist */}
      {(selectedBubbleContext.length > 0 || selectedTransformationContext) && (
        <div className="flex flex-wrap gap-2 px-1">
          {/* Bubble context */}
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

          {/* Transformation context */}
          {selectedTransformationContext && (
            <div className="relative group inline-flex items-center gap-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-600/20 border border-purple-500/40 rounded-full text-xs text-purple-200">
                <Code className="w-3 h-3" />
                <span className="font-medium">
                  {selectedTransformationContext}
                </span>
              </div>
              {onRemoveTransformation && (
                <button
                  type="button"
                  onClick={onRemoveTransformation}
                  disabled={disabled}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Remove transformation from context"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Textarea for text input */}
      <textarea
        ref={textareaRef}
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
});
