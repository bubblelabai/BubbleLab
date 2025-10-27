import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { SignedIn, SignedOut } from './AuthComponents';
import {
  Code,
  ChevronUpIcon,
  ChevronDownIcon,
  Play,
  Bot,
  FileJson2,
} from 'lucide-react';
import { MonacoEditor } from '@/components/MonacoEditor';
import { ExportModal } from '@/components/ExportModal';
import FlowVisualizer from '@/components/FlowVisualizer';
import LiveOutput from '@/components/execution_logs/LiveOutput';
import { FlowGeneration } from '@/components/FlowGeneration';
import { Tooltip } from '@/components/Tooltip';
import { useEditor } from '@/hooks/useEditor';
import { useUIStore } from '@/stores/uiStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useExecutionHistory } from '@/hooks/useExecutionHistory';
import { getFlowNameFromCode } from '@/utils/codeParser';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useRunExecution } from '@/hooks/useRunExecution';
import { useEffect } from 'react';

export interface FlowIDEViewProps {
  flowId: number;
}

export function FlowIDEView({ flowId }: FlowIDEViewProps) {
  // ============= Zustand Stores =============
  const {
    showEditor,
    toggleEditor,
    showLeftPanel,
    isOutputCollapsed,
    showExportModal,
    showPrompt,
    togglePrompt,
    collapseOutput,
    expandOutput,
    toggleExportModal,
    selectFlow,
  } = useUIStore();

  const { output } = useOutputStore();
  const { generationPrompt, isStreaming } = useGenerationStore();
  const { editor } = useEditor();
  const { openPearlChat } = useUIStore();
  const executionState = useExecutionStore(flowId);

  // ============= React Query Hooks =============
  const { data: currentFlow } = useBubbleFlow(flowId);
  const { runFlow, isRunning, canExecute } = useRunExecution(flowId);
  const validateCodeMutation = useValidateCode({ flowId });
  const { data: executionHistory } = useExecutionHistory(flowId, {
    limit: 50,
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
    await runFlow({
      validateCode: true,
      updateCredentials: true,
      inputs: executionState.executionInputs,
    });
  };

  const getRunDisabledReason = () => {
    if (!currentFlow) return 'Create or select a flow first';
    if (executionState.isValidating) return 'Validating code...';
    if (isRunning) return 'Execution in progress...';

    const { isValid, reasons } = canExecute();
    if (!isValid && reasons.length > 0) {
      return reasons[0];
    }

    return '';
  };

  const handleOpenOutputPanel = () => {
    expandOutput();
  };

  const handleExportClick = () => {
    toggleExportModal();
  };

  const CodeEditorPanel = (
    <div className="h-full bg-[#1a1a1a] min-h-0">
      <div className="h-full min-h-0">
        <div className="h-full relative">
          <MonacoEditor />
          {/* Code editor overlay with line count */}
          <div className="absolute top-2 right-2 bg-[#1a1a1a] border border-[#30363d] px-2 py-1 rounded text-xs text-gray-400">
            {editor.getCode().split('\n').length} lines
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
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
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-100 font-sans truncate max-w-[50vw]">
                    {name}
                  </h2>
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
                  <button
                    type="button"
                    onClick={() => {
                      openPearlChat();
                    }}
                    className="border border-gray-600/50 hover:border-gray-500/70 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 flex items-center gap-1"
                  >
                    <Bot className="w-3 h-3" />
                    AI Assistant
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toggleEditor();
                    }}
                    className="border border-gray-600/50 hover:border-gray-500/70 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200 flex items-center gap-1"
                  >
                    <Code className="w-3 h-3" />
                    {showEditor ? 'Hide Code' : 'Show Code'}
                  </button>

                  <Tooltip
                    content="⚡ Run the flow at least once to enable export"
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
              <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-blue-500 transition-colors" />
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
                    {isStreaming ? (
                      <FlowGeneration
                        isStreaming={isStreaming}
                        output={output}
                        isRunning={executionState.isRunning}
                      />
                    ) : (
                      <PanelGroup
                        direction="horizontal"
                        autoSaveId="bubbleflow-editor-flow-layout"
                        className="h-full"
                      >
                        {/* Flow Panel */}
                        <Panel defaultSize={showEditor ? 50 : 100} minSize={30}>
                          <div className="h-full bg-[#1a1a1a] min-h-0">
                            <div className="h-full min-h-0">
                              <div className="h-full bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] relative">
                                {flowId ? (
                                  <FlowVisualizer
                                    flowId={flowId}
                                    onValidate={() =>
                                      validateCodeMutation.mutateAsync({
                                        code: editor.getCode(),
                                        flowId: flowId,
                                        syncInputsWithFlow: true,
                                        credentials:
                                          executionState.pendingCredentials,
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

                        <>
                          {showEditor && (
                            <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-blue-500 transition-colors" />
                          )}

                          {/* Editor Panel */}
                          <Panel
                            defaultSize={showEditor ? 20 : 0}
                            minSize={showEditor ? 30 : 0}
                            maxSize={showEditor ? 100 : 0}
                            style={{
                              visibility: showEditor ? 'visible' : 'hidden',
                              opacity: showEditor ? 1 : 0,
                              transition: 'opacity 0.2s ease-in-out',
                            }}
                          >
                            {CodeEditorPanel}
                          </Panel>
                        </>
                      </PanelGroup>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>

        {/* Bottom floating drawer for Live Output */}
        {isOutputCollapsed ? (
          <div className="absolute bottom-0 left-0 right-0 z-40 px-4">
            <button
              onClick={handleOpenOutputPanel}
              className="w-full border border-b-0 px-4 py-4 text-sm font-medium rounded-t-md shadow-lg flex items-center justify-between transition-all duration-200 bg-[#0f1115] border-[#30363d] text-gray-300 hover:text-gray-200 hover:bg-[#161b22]"
              title="Show Live Execution Output"
            >
              <div className="flex items-center gap-2">
                <span>Live Execution Output</span>
                {executionState.isRunning && (
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-ping"></div>
                )}
              </div>
              <ChevronUpIcon className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 z-40 px-4">
            <div className="h-[55vh] min-h-[260px] bg-[#0f1115] border border-[#30363d] rounded-t-lg shadow-2xl overflow-hidden transition-transform duration-300 ease-out translate-y-0">
              <LiveOutput
                flowId={currentFlow?.id}
                events={executionState.events}
                currentLine={executionState.currentLine}
                executionStats={executionState.getExecutionStats()}
                onToggleCollapse={collapseOutput}
              />
            </div>
          </div>
        )}
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
