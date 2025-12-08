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
>(
  (
    {
      minHeight = 36,
      maxHeight = 200,
      onChange,
      onInput,
      onMouseDown,
      onPointerDown,
      onDragStart,
      ...props
    },
    ref
  ) => {
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

    const handleMouseDown = (e: React.MouseEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      onMouseDown?.(e);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      onPointerDown?.(e);
    };

    const handleDragStart = (e: React.DragEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      onDragStart?.(e);
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
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
        onDragStart={handleDragStart}
        rows={1}
        className={`nodrag ${props.className || ''}`}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default memo(AutoResizeTextarea);
