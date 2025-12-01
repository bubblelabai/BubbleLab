import { useEffect, useCallback } from 'react';

interface UseOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  /** Whether to prevent body scroll when open. Defaults to true */
  preventScroll?: boolean;
  /** Whether to close on Escape key. Defaults to true */
  closeOnEscape?: boolean;
}

/**
 * Hook for managing overlay/modal behavior
 *
 * Handles:
 * - Escape key to close
 * - Body scroll prevention
 *
 * @example
 * useOverlay({
 *   isOpen,
 *   onClose,
 *   preventScroll: true,
 *   closeOnEscape: true,
 * });
 */
export function useOverlay({
  isOpen,
  onClose,
  preventScroll = true,
  closeOnEscape = true,
}: UseOverlayOptions): void {
  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Handle body scroll prevention
    let originalOverflow: string | undefined;
    if (preventScroll) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    // Add escape key listener
    if (closeOnEscape) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      // Restore body scroll
      if (preventScroll && originalOverflow !== undefined) {
        document.body.style.overflow = originalOverflow;
      }
      // Remove escape key listener
      if (closeOnEscape) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, preventScroll, closeOnEscape, handleKeyDown]);
}
