import { useState, useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { toast } from 'react-toastify';
import { useExecutionHistory } from '../../hooks/useExecutionHistory';
import { useExecutionStore } from '../../stores/executionStore';
import { JsonRenderer } from './JsonRenderer';
import { formatTimestamp } from '../../utils/executionLogsFormatUtils';
import { useEditor } from '../../hooks/useEditor';
import { useValidateCode } from '../../hooks/useValidateCode';
import { getExecutionStore } from '../../stores/executionStore';
import { CodeRestoreModal } from './CodeRestoreModal';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';

interface ExecutionHistoryProps {
  flowId: number | null;
}

const ITEMS_PER_PAGE = 10;

export function ExecutionHistory({ flowId }: ExecutionHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [restoreModal, setRestoreModal] = useState<{
    isOpen: boolean;
    code: string;
    executionId: number;
  }>({ isOpen: false, code: '', executionId: 0 });
  const prevExecutingRef = useRef<boolean>(false);
  const { editor } = useEditor(flowId || undefined);
  const validateCodeMutation = useValidateCode({ flowId });
  const { data: currentFlow } = useBubbleFlow(flowId);

  // Get execution state from store
  const isCurrentlyExecuting = useExecutionStore(
    flowId,
    (state) => state.isRunning
  );

  // Calculate offset from current page
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  // Fetch execution history using React Query
  const {
    data: executionHistory,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useExecutionHistory(flowId, { limit: ITEMS_PER_PAGE, offset });

  // Reset to page 1 when flowId changes
  useEffect(() => {
    setCurrentPage(1);
    prevExecutingRef.current = false;
  }, [flowId]);

  // Reset to page 1 when execution completes (transition from executing to not executing)
  useEffect(() => {
    // Only reset if we transition from executing to not executing
    if (prevExecutingRef.current && !isCurrentlyExecuting && flowId) {
      setCurrentPage(1);
    }
    prevExecutingRef.current = isCurrentlyExecuting;
  }, [isCurrentlyExecuting, flowId]);

  // Determine if we're on the last page (fewer items than limit means last page)
  const isLastPage = executionHistory
    ? executionHistory.length < ITEMS_PER_PAGE
    : false;
  const hasNextPage =
    !isLastPage && executionHistory?.length === ITEMS_PER_PAGE;
  const hasPreviousPage = currentPage > 1;

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviewVersion = (
    code: string | undefined,
    executionId: number
  ) => {
    if (!code) {
      toast.error('No code available for this execution');
      return;
    }

    if (!flowId) {
      toast.error('Cannot restore code: No flow selected');
      return;
    }
    // Open diff preview modal
    setRestoreModal({
      isOpen: true,
      code,
      executionId,
    });
  };

  const handleConfirmRestore = async () => {
    const { code, executionId } = restoreModal;

    if (!flowId || !code) {
      return;
    }

    setRestoreModal({ isOpen: false, code: '', executionId: 0 });
    try {
      // Automatically validate and sync the code
      const validationResult = await validateCodeMutation.mutateAsync({
        code,
        flowId,
        credentials: getExecutionStore(flowId).pendingCredentials,
        syncInputsWithFlow: true,
      });

      if (validationResult && validationResult.valid) {
        toast.success(`Code applied from execution #${executionId}`, {
          autoClose: 3000,
        });
        // Set code in editor after validation
        editor.setCode(code);
      } else {
        toast.warning(
          `Code validation failed for execution #${executionId} and cannot be applied`,
          {
            autoClose: 5000,
          }
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to sync applied code: ${errorMessage}`);
    }
  };

  const handleCloseModal = () => {
    if (!validateCodeMutation.isPending) {
      setRestoreModal({ isOpen: false, code: '', executionId: 0 });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0f1115]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#30363d] p-4">
        <div className="flex items-center gap-3">
          <ClockIcon className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-100">
            Execution History
          </h3>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-y-auto thin-scrollbar p-4">
          {historyLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-sm">Loading execution history...</p>
              </div>
            </div>
          ) : historyError ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <ExclamationCircleIcon className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-lg mb-2">Failed to load history</p>
                <p className="text-sm mb-4">{historyError.message}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    refetchHistory();
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !executionHistory || executionHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <ClockIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-lg mb-2">No execution history</p>
                <p className="text-sm">
                  {!flowId
                    ? 'Select a flow to view its execution history'
                    : 'Execute this flow to see its history here'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {executionHistory.map((execution) => (
                <div
                  key={execution.id}
                  className="rounded-lg border border-[#30363d] bg-[#21262d] p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {isCurrentlyExecuting ? (
                          <div className="h-5 w-5 bg-amber-500 rounded-full animate-pulse"></div>
                        ) : execution.status === 'success' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-400" />
                        ) : execution.status === 'error' ? (
                          <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
                        ) : (
                          <div className="h-5 w-5 bg-yellow-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-gray-400">
                            #{execution.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              isCurrentlyExecuting
                                ? 'bg-amber-900/30 text-amber-300'
                                : execution.status === 'success'
                                  ? 'bg-green-900/30 text-green-300'
                                  : execution.status === 'error'
                                    ? 'bg-red-900/30 text-red-300'
                                    : 'bg-yellow-900/30 text-yellow-300'
                            }`}
                          >
                            {isCurrentlyExecuting
                              ? 'executing'
                              : execution.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Started: {formatTimestamp(execution.startedAt)}
                          {execution.completedAt && (
                            <span className="ml-2">
                              • Completed:{' '}
                              {formatTimestamp(execution.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {execution.code && (
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVersion(execution.code, execution.id);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/30 border border-blue-700/30 hover:border-blue-600/40 rounded transition-colors"
                        >
                          <ArrowPathIcon className="w-3.5 h-3.5" />
                          Use Version
                        </button>
                        <span className="text-[10px] text-gray-500">
                          Preview changes before applying
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Execution Details */}
                  {execution.error && (
                    <div className="mb-3 p-3 bg-red-900/20 border border-red-700/30 rounded">
                      <p className="text-sm text-red-300 font-medium mb-1">
                        Error:
                      </p>
                      <p className="text-sm text-red-200">{execution.error}</p>
                    </div>
                  )}

                  {/* Result */}
                  {execution.result && (
                    <details className="mb-3">
                      <summary
                        className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Execution Result
                      </summary>
                      <pre className="json-output text-xs p-3 bg-[#0d0f13] border border-[#30363d] rounded-md overflow-x-auto whitespace-pre leading-relaxed">
                        <JsonRenderer
                          data={execution.result}
                          flowId={flowId}
                          executionId={execution.id}
                          timestamp={execution.startedAt}
                        />
                      </pre>
                    </details>
                  )}

                  {/* Payload */}
                  {execution.payload &&
                    Object.keys(execution.payload).length > 0 && (
                      <details className="mb-3">
                        <summary
                          className="text-xs text-blue-400 cursor-pointer hover:text-blue-300 font-medium mb-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Execution Payload
                        </summary>
                        <pre className="json-output text-xs p-3 bg-[#0d0f13] border border-[#30363d] rounded-md whitespace-pre-wrap break-words leading-relaxed">
                          <JsonRenderer
                            data={execution.payload}
                            flowId={flowId}
                            executionId={execution.id}
                            timestamp={execution.startedAt}
                          />
                        </pre>
                      </details>
                    )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {executionHistory && executionHistory.length > 0 && (
          <div className="flex-shrink-0 border-t border-[#30363d] bg-[#0f1115] px-4 py-3 flex items-center justify-between">
            <div className="text-xs text-gray-400">Page {currentPage}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage || historyLoading}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                  hasPreviousPage && !historyLoading
                    ? 'bg-[#21262d] text-gray-300 hover:bg-[#30363d] border border-[#30363d]'
                    : 'bg-[#21262d] text-gray-600 cursor-not-allowed border border-[#30363d] opacity-50'
                }`}
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                disabled={!hasNextPage || historyLoading}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                  hasNextPage && !historyLoading
                    ? 'bg-[#21262d] text-gray-300 hover:bg-[#30363d] border border-[#30363d]'
                    : 'bg-[#21262d] text-gray-600 cursor-not-allowed border border-[#30363d] opacity-50'
                }`}
              >
                Next
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Code Restore Modal */}
      <CodeRestoreModal
        isOpen={restoreModal.isOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmRestore}
        currentCode={currentFlow?.code || ''}
        restoredCode={restoreModal.code}
        executionId={restoreModal.executionId}
        isApplying={validateCodeMutation.isPending}
      />
    </div>
  );
}
