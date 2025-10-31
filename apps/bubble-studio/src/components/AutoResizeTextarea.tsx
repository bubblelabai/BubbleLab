import React, { memo, forwardRef } from 'react';

interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
  maxHeight?: number;
}

// Auto-resize textarea helper
const autoResizeTextarea = (
  el: HTMLTextAreaElement,
  minHeight: number = 36,
  maxHeight: number = 200
) => {
  el.style.height = 'auto';
  const newHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
  el.style.height = `${newHeight}px`;
  el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
};

const AutoResizeTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ minHeight = 36, maxHeight = 200, onChange, onInput, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    autoResizeTextarea(e.currentTarget, minHeight, maxHeight);
    onChange?.(e);
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    autoResizeTextarea(
      e.currentTarget as HTMLTextAreaElement,
      minHeight,
      maxHeight
    );
    onInput?.(e);
  };

  const handleRef = (el: HTMLTextAreaElement | null) => {
    if (el) {
      autoResizeTextarea(el, minHeight, maxHeight);
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          el;
      }
    }
  };

  return (
    <textarea
      {...props}
      ref={handleRef}
      onChange={handleChange}
      onInput={handleInput}
      rows={1}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default memo(AutoResizeTextarea);
