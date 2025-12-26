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
  Menu,
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
import { useEffect, useState, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import { ApiHttpError } from '@/lib/api';
import { FlowNotFoundView } from '@/components/FlowNotFoundView';

export interface FlowIDEViewProps {
  flowId: number;
}

export function FlowIDEView({ flowId }: FlowIDEViewProps) {
  // ============= Zustand Stores =============
  const {
    showLeftPanel,
    showExportModal,
    showPrompt,
    togglePrompt,
    toggleExportModal,
    selectFlow,
    isConsolidatedPanelOpen,
    toggleConsolidatedPanel,
  } = useUIStore();

  const { generationPrompt, isStreaming } = useGenerationStore();
  const { editor } = useEditor();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
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

  // ============= Bubble Focus State =============
  const [bubbleToFocus, setBubbleToFocus] = useState<string | null>(null);

  // ============= React Query Hooks =============
  const { data: currentFlow, error, refetch } = useBubbleFlow(flowId);
  const { runFlow, isRunning, canExecute } = useRunExecution(flowId, {
    onFocusBubble: (bubbleVariableId) => {
      setBubbleToFocus(bubbleVariableId);
    },
  });
  const validateCodeMutation = useValidateCode({ flowId });
  const { data: executionHistory } = useExecutionHistory(flowId, {
    limit: 10,
  });

  const isFlowNotFound =
    error instanceof ApiHttpError
      ? error.status === 404
      : error instanceof Error && /^HTTP 404:/.test(error.message);

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

  // ============= Mobile Menu State =============
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Detect desktop view
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsDesktop(e.matches);

    // Set initial value
    setIsDesktop(mql.matches);

    mql.addEventListener(
      'change',
      onChange as (e: MediaQueryListEvent) => void
    );
    return () =>
      mql.removeEventListener(
        'change',
        onChange as (e: MediaQueryListEvent) => void
      );
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Sync flow code to editor when flow changes
  useEffect(() => {
    selectFlow(flowId);
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

  if (isFlowNotFound) {
    return <FlowNotFoundView flowId={flowId} onRetry={() => refetch()} />;
  }

  const isRunnable = () => {
    if (!currentFlow) return false;
    // Disable if no bubble parameters (flow is still generating)
    if (Object.keys(currentFlow.bubbleParameters || {}).length === 0)
      return false;
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
    if (Object.keys(currentFlow.bubbleParameters || {}).length === 0) {
      return 'Flow is still generating...';
    }
    if (executionState.isValidating) return 'Validating code...';
    if (isRunning) return 'Working on it...please be patient :)';

    const { isValid, reasons } = canExecute();
    if (!isValid && reasons.length > 0) {
      return reasons[0];
    }

    return '';
  };

  const handleExportClick = () => {
    toggleExportModal();
  };

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-3 md:px-6 py-3 border-b border-[#30363d] relative">
        <div className="flex items-center justify-between gap-2">
          {/* Left Section - Flow Name */}
          <div className="flex items-center gap-2 md:gap-6 flex-1 min-w-0">
            {(() => {
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
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
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
                        className="px-2 py-1 text-sm md:text-base font-semibold bg-[#0a0a0a] text-gray-100 border border-[#30363d] rounded focus:outline-none focus:border-gray-600 w-full max-w-[200px]"
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
                      <h2 className="text-sm md:text-lg font-semibold text-gray-100 font-sans truncate max-w-[120px] md:max-w-[50vw]">
                        {name}
                      </h2>
                      {flowId && currentFlow && (
                        <button
                          type="button"
                          onClick={startRename}
                          className="hidden md:block p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-all duration-200"
                          title="Rename Flow"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                  {/* Prompt button - hide on mobile */}
                  {hasPrompt && (
                    <button
                      onClick={togglePrompt}
                      className="hidden md:flex border border-gray-600/50 hover:border-gray-500/70 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 items-center gap-1"
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
          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {/* Desktop View - All buttons visible */}
            <div className="hidden md:flex items-center gap-3">
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

            {/* Mobile View - Run button + Hamburger menu */}
            <div className="flex md:hidden items-center gap-2">
              <SignedIn>
                {!isStreaming && (
                  <Tooltip
                    content={getRunDisabledReason()}
                    show={!isRunnable()}
                    position="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleExecuteFromMainPage}
                      disabled={!isRunnable()}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1 ${
                        isRunnable()
                          ? 'bg-pink-600/20 hover:bg-pink-600/30 border border-pink-600/50 text-pink-300 hover:text-pink-200'
                          : 'bg-gray-600/20 border border-gray-600/50 cursor-not-allowed text-gray-400'
                      }`}
                    >
                      {executionState.isValidating ||
                      executionState.isRunning ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </button>
                  </Tooltip>
                )}
              </SignedIn>

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-300 hover:text-gray-100 transition-all duration-200"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div
            className="absolute top-full left-0 right-0 md:hidden bg-[#1a1a1a] border-b border-[#30363d] shadow-lg shadow-black/50 z-30 animate-in slide-in-from-top-2 duration-200"
            ref={mobileMenuRef}
          >
            <div className="flex flex-col gap-2 px-3 py-3">
              {/* Auth Buttons */}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-300 hover:text-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2">
                    <span>🔑</span>
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="w-full bg-green-600/20 hover:bg-green-600/30 border border-green-600/50 text-green-300 hover:text-green-200 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2">
                    <span>✨</span>
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>

              <SignedIn>
                {!isStreaming && (
                  <>
                    {/* Export Button */}
                    <button
                      type="button"
                      onClick={() => {
                        handleExportClick();
                        setIsMobileMenuOpen(false);
                      }}
                      disabled={
                        executionState.isRunning ||
                        !executionHistory ||
                        executionHistory.length === 0
                      }
                      className="w-full border border-gray-600/50 hover:border-gray-500/70 disabled:border-gray-600/30 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 disabled:text-gray-500 flex items-center justify-center gap-2"
                    >
                      <FileJson2 className="w-4 h-4" />
                      Export
                    </button>

                    {/* Prompt Toggle */}
                    {(() => {
                      let hasPrompt = false;
                      if (isStreaming && generationPrompt) hasPrompt = true;
                      else if (flowId && currentFlow) hasPrompt = true;
                      else if (currentFlow?.name) hasPrompt = true;
                      else if (generationPrompt.trim()) hasPrompt = true;

                      if (!hasPrompt) return null;

                      return (
                        <button
                          onClick={() => {
                            togglePrompt();
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full border border-gray-600/50 hover:border-gray-500/70 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 flex items-center justify-center gap-2"
                        >
                          {showPrompt ? (
                            <ChevronUpIcon className="w-4 h-4" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4" />
                          )}
                          {showPrompt ? 'Hide' : 'Show'} Prompt
                        </button>
                      );
                    })()}

                    {/* Rename Button */}
                    {flowId && currentFlow && (
                      <button
                        type="button"
                        onClick={() => {
                          startRename();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full border border-gray-600/50 hover:border-gray-500/70 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Rename Flow
                      </button>
                    )}
                  </>
                )}
              </SignedIn>
            </div>
          </div>
        )}
      </div>

      {/* Mobile View Toggle */}
      <div className="md:hidden border-b border-[#30363d] bg-[#1a1a1a] px-3 py-2">
        <div className="flex bg-[#0a0a0a] rounded-lg p-1 border border-[#30363d]">
          <button
            onClick={() => {
              if (isConsolidatedPanelOpen) toggleConsolidatedPanel();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              !isConsolidatedPanelOpen
                ? 'bg-[#30363d] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <span>Flow</span>
          </button>
          <button
            onClick={() => {
              if (!isConsolidatedPanelOpen) toggleConsolidatedPanel();
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              isConsolidatedPanelOpen
                ? 'bg-[#30363d] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <span>Panel</span>
          </button>
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
                      <div className="px-6 py-3 border-b border-[#30363d] bg-[#1a1a1a] flex-shrink-0 flex items-start justify-between gap-4">
                        <p className="text-sm text-gray-100 leading-relaxed font-sans flex-1">
                          {currentFlowInfo.prompt}
                        </p>
                        <button
                          onClick={togglePrompt}
                          className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-all duration-200 flex-shrink-0"
                          title="Close prompt"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null;
                  })()}

                  <div className="flex-1 min-h-0 relative">
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
                                <FlowVisualizer
                                  flowId={flowId}
                                  bubbleToFocus={bubbleToFocus}
                                  onFocusComplete={() => setBubbleToFocus(null)}
                                  onFocusBubble={(bubbleVariableId) =>
                                    setBubbleToFocus(bubbleVariableId)
                                  }
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

                      {/* Consolidated Side Panel - Desktop: side-by-side, Mobile: full-screen overlay */}
                      {isConsolidatedPanelOpen && isDesktop && (
                        <>
                          {/* Desktop view - resizable panel */}
                          <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-white transition-colors" />
                          <Panel defaultSize={40} minSize={30} maxSize={50}>
                            <ConsolidatedSidePanel />
                          </Panel>
                        </>
                      )}
                    </PanelGroup>

                    {/* Mobile view - full-screen overlay (always mounted to preserve editor state) */}
                    {!isDesktop && (
                      <div
                        className={`absolute inset-0 md:hidden bg-[#1a1a1a] z-10 ${
                          isConsolidatedPanelOpen ? 'block' : 'hidden'
                        }`}
                      >
                        <ConsolidatedSidePanel />
                      </div>
                    )}
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
