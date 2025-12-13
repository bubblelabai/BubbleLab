import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { SignedIn, SignedOut } from './AuthComponents';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  Play,
  FileJson2,
  Edit2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { ExportModal } from '@/components/ExportModal';
import FlowVisualizer from '@/components/flow_visualizer/FlowVisualizer';
import { Tooltip } from '@/components/shared/Tooltip';
import { ConsolidatedSidePanel } from '@/components/ConsolidatedSidePanel';
import { useEditor } from '@/hooks/useEditor';
import { useUIStore } from '@/stores/uiStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useGenerationStore } from '@/stores/generationStore';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useExecutionHistory } from '@/hooks/useExecutionHistory';
import { getFlowNameFromCode } from '@/utils/codeParser';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useRunExecution } from '@/hooks/useRunExecution';
import { filterEmptyInputs } from '@/utils/inputUtils';
import { useRenameFlow } from '@/hooks/useRenameFlow';
import { useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { useNavigate } from '@tanstack/react-router';

export interface FlowIDEViewProps {
  flowId: number;
}

export function FlowIDEView({ flowId }: FlowIDEViewProps) {
  const navigate = useNavigate();

  // ============= Zustand Stores =============
  const {
    showLeftPanel,
    showExportModal,
    showPrompt,
    togglePrompt,
    toggleExportModal,
    selectFlow,
    isConsolidatedPanelOpen,
  } = useUIStore();

  const { generationPrompt, isStreaming } = useGenerationStore();
  const { editor } = useEditor();
  // Use selector to only subscribe to specific fields and prevent unnecessary re-renders
  const executionState = useExecutionStore(
    flowId,
    (state) => ({
      executionInputs: state.executionInputs,
      isValidating: state.isValidating,
      isRunning: state.isRunning,
      pendingCredentials: state.pendingCredentials,
      setAllCredentials: state.setAllCredentials,
    }),
    shallow
  );

  // ============= React Query Hooks =============
  const {
    data: currentFlow,
    error: flowError,
    loading: flowLoading,
  } = useBubbleFlow(flowId);
  const { runFlow, isRunning, canExecute } = useRunExecution(flowId);
  const validateCodeMutation = useValidateCode({ flowId });
  const { data: executionHistory } = useExecutionHistory(flowId, {
    limit: 10,
  });

  // ============= Rename Flow Hook =============
  const {
    isRenaming,
    newFlowName,
    setNewFlowName,
    inputRef,
    startRename,
    submitRename,
    cancelRename,
    handleKeyDown,
  } = useRenameFlow({
    flowId,
    currentName: currentFlow?.name,
  });

  // Sync flow code to editor when flow changes
  useEffect(() => {
    selectFlow(flowId);
    console.log('🚀 [useEffect] currentFlow changed:', currentFlow);
    if (currentFlow) {
      editor.setCode(currentFlow.code);
      const extractedCredentials: Record<string, Record<string, number>> = {};

      Object.entries(currentFlow.bubbleParameters).forEach(
        ([key, bubbleData]) => {
          const bubble = bubbleData as Record<string, unknown>;
          const credentialsParam = (
            bubble.parameters as
              | Array<{ name: string; type?: string; value?: unknown }>
              | undefined
          )?.find((param) => param.name === 'credentials');

          if (
            credentialsParam &&
            credentialsParam.type === 'object' &&
            credentialsParam.value
          ) {
            const credValue = credentialsParam.value as Record<string, unknown>;
            const bubbleCredentials: Record<string, number> = {};

            Object.entries(credValue).forEach(([credType, credId]) => {
              if (typeof credId === 'number') {
                bubbleCredentials[credType] = credId;
              }
            });

            if (Object.keys(bubbleCredentials).length > 0) {
              extractedCredentials[key] = bubbleCredentials;
            }
          }
        }
      );

      if (Object.keys(extractedCredentials).length > 0) {
        executionState.setAllCredentials(extractedCredentials);
      }
    }
  }, [currentFlow?.id]);

  const isRunnable = () => {
    if (!currentFlow) return false;
    const { isValid } = canExecute();
    return isValid && !isRunning;
  };

  const handleExecuteFromMainPage = async () => {
    // Filter out empty values (empty strings, undefined, empty arrays) so defaults are used
    const filteredInputs = filterEmptyInputs(executionState.executionInputs);

    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: filteredInputs,
    });
  };

  const getRunDisabledReason = () => {
    if (!currentFlow) return 'Create or select a flow first';
    if (executionState.isValidating) return 'Validating code...';
    if (isRunning) return 'Working on it...please be patient :)';

    const { isValid, reasons } = canExecute();
    if (!isValid && reasons.length > 0) {
      return reasons[0];
    }

    return '';
  };

  // Check if the error is a 404 (flow not found)
  const isFlowNotFound = () => {
    if (!flowError) return false;
    const errorMessage = flowError.message || '';
    const has404Status = /HTTP\s+404|404/.test(errorMessage);
    const hasNotFoundMessage = errorMessage.includes('BubbleFlow not found');
    return has404Status && hasNotFoundMessage;
  };

  const handleExportClick = () => {
    toggleExportModal();
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {(() => {
              // Show "Flow Not Found" if flow is not found
              if (flowId && isFlowNotFound()) {
                return (
                  <h2 className="text-lg font-semibold text-gray-400 font-sans">
                    Flow Not Found
                  </h2>
                );
              }

              let name = '';
              let hasPrompt = false;

              if (isStreaming && generationPrompt) {
                name = 'New Flow';
                hasPrompt = true;
              } else if (flowId) {
                if (currentFlow) {
                  name = currentFlow.name;
                  hasPrompt = true;
                }
              } else if (currentFlow?.name) {
                name =
                  currentFlow?.name ||
                  getFlowNameFromCode(currentFlow?.code || '');
                hasPrompt = true;
              } else if (generationPrompt.trim()) {
                name = 'New Flow';
                hasPrompt = true;
              } else {
                name = getFlowNameFromCode(editor.getCode());
              }

              if (!name) return null;
              return (
                <div className="flex items-center gap-3">
                  {isRenaming && flowId ? (
                    // Rename Input
                    <div className="flex items-center gap-2">
                      <input
                        title="Rename Flow"
                        ref={inputRef}
                        type="text"
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="px-2 py-1 text-base font-semibold bg-[#0a0a0a] text-gray-100 border border-[#30363d] rounded focus:outline-none focus:border-gray-600"
                        style={{ minWidth: '200px' }}
                      />
                      <button
                        type="button"
                        onClick={submitRename}
                        className="p-1 rounded hover:bg-gray-700/50 text-green-400 hover:text-green-300"
                        title="Confirm (Enter)"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
                        title="Cancel (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    // Flow Name Display
                    <>
                      <h2 className="text-lg font-semibold text-gray-100 font-sans truncate max-w-[50vw]">
                        {name}
                      </h2>
                      {flowId && currentFlow && (
                        <button
                          type="button"
                          onClick={startRename}
                          className="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-all duration-200"
                          title="Rename Flow"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  {hasPrompt && (
                    <button
                      onClick={togglePrompt}
                      className="border border-gray-600/50 hover:border-gray-500/70 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 flex items-center gap-1"
                    >
                      {showPrompt ? (
                        <ChevronUpIcon className="w-3 h-3" />
                      ) : (
                        <ChevronDownIcon className="w-3 h-3" />
                      )}
                      Prompt
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="flex items-center gap-3">
            {/* Authentication buttons - only show when signed out */}
            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 hover:text-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                    <span>🔑</span>
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 hover:text-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2">
                    <span>✨</span>
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>

            <SignedIn>
              {!isStreaming && (
                <>
                  <Tooltip
                    content="Run the flow at least once to enable export"
                    show={
                      (!executionHistory || executionHistory.length === 0) &&
                      !executionState.isRunning
                    }
                    position="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleExportClick}
                      disabled={
                        executionState.isRunning ||
                        !executionHistory ||
                        executionHistory.length === 0
                      }
                      className="border border-gray-600/50 hover:border-gray-500/70 disabled:border-gray-600/30 disabled:cursor-not-allowed px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 disabled:text-gray-500 flex items-center gap-1"
                    >
                      <FileJson2 className="w-3 h-3" />
                      Export
                    </button>
                  </Tooltip>

                  <Tooltip
                    content={getRunDisabledReason()}
                    show={!isRunnable()}
                    position="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleExecuteFromMainPage}
                      disabled={!isRunnable()}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center ${
                        isRunnable()
                          ? 'bg-pink-600/20 hover:bg-pink-600/30 border border-pink-600/50 text-pink-300 hover:text-pink-200 hover:border-pink-500/70 shadow-lg shadow-pink-600/10'
                          : 'bg-gray-600/20 border border-gray-600/50 cursor-not-allowed text-gray-400'
                      }`}
                    >
                      {executionState.isValidating ? (
                        <>
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          Validating...
                        </>
                      ) : executionState.isRunning ? (
                        <>
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          Executing...
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Run
                        </>
                      )}
                    </button>
                  </Tooltip>
                </>
              )}
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <PanelGroup direction="horizontal" autoSaveId="bubbleflow-main-layout">
          {/* Left Panel - Execution History (currently disabled) */}
          {showLeftPanel && (
            <>
              <Panel defaultSize={25} minSize={20} maxSize={40}>
                {/* Left panel content if needed */}
              </Panel>
              <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-white transition-colors" />
            </>
          )}

          {/* Main Content Area */}
          <Panel defaultSize={showLeftPanel ? 75 : 100} minSize={30}>
            <PanelGroup
              direction="vertical"
              autoSaveId="bubbleflow-main-vertical-layout"
              className="h-full"
            >
              {/* Editor/Flow Section */}
              <Panel defaultSize={100} minSize={40}>
                <div className="h-full flex flex-col">
                  {/* Flow Info Header - Shows current flow's prompt */}
                  {(() => {
                    let currentFlowInfo = null;

                    if (isStreaming && generationPrompt) {
                      currentFlowInfo = {
                        name: 'New Flow',
                        prompt: generationPrompt,
                        isFromHistory: false,
                        isGenerating: true,
                      };
                    } else if (flowId) {
                      const flow = currentFlow;
                      if (flow) {
                        currentFlowInfo = {
                          name: flow.name,
                          prompt: flow.prompt || 'No prompt available',
                          isFromHistory: true,
                        };
                      }
                    } else if (generationPrompt.trim()) {
                      currentFlowInfo = {
                        name: 'New Flow',
                        prompt: generationPrompt,
                        isFromHistory: false,
                        isBeingTyped: true,
                      };
                    }

                    return currentFlowInfo && showPrompt ? (
                      <div className="px-6 py-3 border-b border-[#30363d] bg-[#1a1a1a] flex-shrink-0">
                        <p className="text-sm text-gray-100 leading-relaxed font-sans">
                          {currentFlowInfo.prompt}
                        </p>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex-1 min-h-0">
                    <PanelGroup
                      direction="horizontal"
                      autoSaveId="bubbleflow-consolidated-layout"
                      className="h-full"
                    >
                      {/* Flow Visualizer Panel */}
                      <Panel
                        defaultSize={isConsolidatedPanelOpen ? 60 : 100}
                        minSize={30}
                      >
                        <div className="h-full bg-[#1a1a1a] min-h-0">
                          <div className="h-full min-h-0">
                            <div className="h-full bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] relative">
                              {flowId ? (
                                isFlowNotFound() ? (
                                  <div className="h-full flex items-center justify-center p-8">
                                    <div className="max-w-md w-full bg-[#1a1a1a] border border-[#30363d] rounded-2xl p-8 shadow-2xl text-center">
                                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-700/50 rounded-full mb-4">
                                        <AlertCircle className="h-8 w-8 text-gray-400" />
                                      </div>
                                      <h1 className="text-2xl font-bold text-white mb-2 font-sans">
                                        Flow Not Found
                                      </h1>
                                      <p className="text-gray-400 text-base mb-6 font-sans">
                                        The flow you're looking for doesn't
                                        exist or has been deleted.
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          navigate({ to: '/flows' })
                                        }
                                        className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 hover:text-blue-200 rounded-lg text-sm font-medium transition-all duration-200"
                                      >
                                        Go to Flows
                                      </button>
                                    </div>
                                  </div>
                                ) : flowLoading ? (
                                  <div className="h-full flex items-center justify-center">
                                    <div className="text-center">
                                      <div className="w-8 h-8 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                      <p className="text-gray-400 text-sm">
                                        Loading flow...
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <FlowVisualizer
                                    flowId={flowId}
                                    onValidate={() =>
                                      validateCodeMutation.mutateAsync({
                                        code: editor.getCode(),
                                        flowId: flowId,
                                        syncInputsWithFlow: true,
                                        credentials:
                                          executionState.pendingCredentials,
                                        defaultInputs:
                                          executionState.executionInputs,
                                      })
                                    }
                                  />
                                )
                              ) : (
                                <div className="h-full flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-gray-400 text-lg mb-2">
                                      No flow selected
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                      Please select a flow from the sidebar to
                                      view its visualization
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Panel>

                      {/* Consolidated Side Panel */}
                      {isConsolidatedPanelOpen && (
                        <>
                          <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-white transition-colors" />
                          <Panel defaultSize={40} minSize={30} maxSize={50}>
                            <ConsolidatedSidePanel />
                          </Panel>
                        </>
                      )}
                    </PanelGroup>
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={toggleExportModal}
        code={editor.getCode()}
        flowName={(() => {
          if (flowId) {
            const flow = currentFlow;
            if (flow) return flow.name;
          }
          return getFlowNameFromCode(editor.getCode());
        })()}
        flowId={currentFlow?.id}
        inputsSchema={JSON.stringify(currentFlow?.inputSchema)}
        requiredCredentials={currentFlow?.requiredCredentials}
      />
    </div>
  );
}
