import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { bubbleFlowApi } from '@/services/bubbleFlowApi';

interface UseRenameFlowOptions {
  flowId?: number;
  currentName?: string;
}

export function useRenameFlow({ flowId, currentName }: UseRenameFlowOptions) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const hasInitialized = useRef(false);

  const startRename = () => {
    if (currentName) {
      setIsRenaming(true);
      setNewFlowName(currentName);
      hasInitialized.current = false; // Reset for next rename
    }
  };

  const submitRename = async () => {
    if (!newFlowName.trim() || !flowId) {
      return false;
    }

    try {
      await bubbleFlowApi.updateBubbleFlowName(flowId, newFlowName.trim());

      // Invalidate and refetch both the flow list and the individual flow details
      queryClient.invalidateQueries({ queryKey: ['bubbleFlowList'] });
      queryClient.invalidateQueries({ queryKey: ['bubbleFlow', flowId] });

      setIsRenaming(false);
      setNewFlowName('');
      hasInitialized.current = false; // Reset for next rename
      return true;
    } catch (error) {
      console.error('Failed to rename flow:', error);
      return false;
    }
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setNewFlowName('');
    hasInitialized.current = false; // Reset for next rename
  };

  const handleKeyDown = async (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      const success = await submitRename();
      return success;
    } else if (event.key === 'Escape') {
      cancelRename();
      return false;
    }
    return false;
  };

  // Auto-populate newFlowName when currentName is provided (for external state management like HomePage)
  useEffect(() => {
    if (currentName && flowId && !newFlowName && !hasInitialized.current) {
      setNewFlowName(currentName);
    }
  }, [currentName, flowId, newFlowName]);

  // Focus and select input when entering rename mode (only once per session)
  // This runs when newFlowName gets populated and we haven't initialized yet
  useEffect(() => {
    if (
      (isRenaming || flowId) &&
      inputRef.current &&
      newFlowName &&
      !hasInitialized.current
    ) {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 0);
      hasInitialized.current = true;
    }
  }, [isRenaming, flowId, newFlowName]);

  return {
    isRenaming,
    newFlowName,
    setNewFlowName,
    inputRef,
    startRename,
    submitRename,
    cancelRename,
    handleKeyDown,
  };
}
