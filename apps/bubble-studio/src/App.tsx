import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SignInButton, SignUpButton } from '@clerk/clerk-react';
import { SignedIn, SignedOut } from './components/AuthComponents';
import {
  Code,
  Trash2,
  FileJson2,
  ChevronUpIcon,
  ChevronDownIcon,
  Play,
  Bot,
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MonacoEditor } from '@/components/MonacoEditor';
import { ExportModal } from '@/components/ExportModal';
import FlowVisualizer from '@/components/FlowVisualizer';
import { BubbleSidePanel } from '@/components/BubbleSidePanel';
import { CredentialsPage } from '@/pages/CredentialsPage';
import { OAuthCallback } from '@/components/OAuthCallback';
import { DashboardPage } from '@/pages/DashboardPage';
import { HomePage } from '@/pages/HomePage';
import LiveOutput from '@/components/execution_logs/LiveOutput';
import { FlowGeneration } from '@/components/FlowGeneration';
import { useFlowGeneration } from '@/hooks/useFlowGeneration';
import { Sidebar } from '@/components/Sidebar';
import { Tooltip } from '@/components/Tooltip';
import {
  useEditorStore,
  getEditorCode,
  setEditorCode,
} from '@/stores/editorStore';
import { useUIStore } from '@/stores/uiStore';
import { useExecutionStore } from '@/stores/executionStore';
import { useGenerationStore } from '@/stores/generationStore';
import { useOutputStore } from '@/stores/outputStore';
import { useCredentials } from '@/hooks/useCredentials';
import { useClerkTokenSync } from '@/hooks/useClerkTokenSync';
import { useBubbleFlow } from '@/hooks/useBubbleFlow';
import { useBubbleFlowList } from '@/hooks/useBubbleFlowList';
import { useCreateBubbleFlow } from '@/hooks/useCreateBubbleFlow';
import { useDeleteBubbleFlow } from '@/hooks/useDeleteBubbleFlow';
import { useExecutionHistory } from '@/hooks/useExecutionHistory';
import { api } from '@/lib/api';
import type {
  BubbleFlowDetailsResponse,
  CredentialType,
} from '@bubblelab/shared-schemas';
import { getFlowNameFromCode } from '@/utils/codeParser';
import { findBubbleByVariableId } from '@/utils/bubbleUtils';
import { API_BASE_URL } from '@/env';
import { SYSTEM_CREDENTIALS } from '@bubblelab/shared-schemas';
import { useSubscription } from './hooks/useSubscription';
import { cleanupFlattenedKeys } from '@/utils/codeParser';
import { extractInputSchemaFromCode } from '@/utils/inputSchemaParser';
import { useValidateCode } from '@/hooks/useValidateCode';
import { useRunExecution } from '@/hooks/useRunExecution';

function App() {
  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback =
    (urlParams.has('code') && urlParams.has('state')) ||
    urlParams.has('success') ||
    urlParams.has('error');

  // ============= Zustand Stores =============

  // UI Store - Navigation and panel state
  const {
    selectedFlowId,
    currentPage,
    showEditor,
    toggleEditor,
    showLeftPanel,
    isSidebarOpen,
    isOutputCollapsed,
    showExportModal,
    showPrompt,
    togglePrompt,
    selectFlow,
    navigateToPage,
    showEditorPanel,
    closeSidebar,
    collapseOutput,
    expandOutput,
    toggleExportModal,
    toggleSidebar,
  } = useUIStore();

  // Output Store - Console output
  const { output, setOutput } = useOutputStore();

  // Generation Store - Flow generation state
  const {
    generationPrompt,
    selectedPreset,
    setGenerationPrompt,
    isStreaming,
    setSelectedPreset,
  } = useGenerationStore();
  // Editor Store - Monaco editor
  const { closeSidePanel, openPearlChat } = useEditorStore();
  // Per-flow Execution Store
  const executionState = useExecutionStore(selectedFlowId);

  // ============= React Query Hooks =============
  const queryClient = useQueryClient();
  const { data: currentFlow, loading: currentFlowLoading } =
    useBubbleFlow(selectedFlowId);
  const { runFlow, isRunning, canExecute } = useRunExecution(selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });
  const { data: bubbleFlowList } = useBubbleFlowList();
  const createBubbleFlowMutation = useCreateBubbleFlow();
  const deleteBubbleFlowMutation = useDeleteBubbleFlow();

  // ============= Refs =============
  const navigationLockToastId = 'sidebar-navigation-lock';

  // ============= Auto-behaviors =============
  // TODO: replace with actual proper behavior
  // Auto-show editor when flow is running
  // useEffect(() => {
  //   if (executionState.isRunning && !showEditor) {
  //     showEditorPanel();
  //   }
  // }, [executionState.isRunning, showEditor, showEditorPanel]);

  // // If bubbleflowlist changes, set the selected flow to the first flow
  // useEffect(() => {
  //   if (bubbleFlowList && bubbleFlowList.bubbleFlows.length > 0) {
  //     selectFlow(bubbleFlowList.bubbleFlows[0].id);
  //   } else {
  //     selectFlow(null);
  //     navigateToPage('prompt');
  //   }
  // }, [bubbleFlowList, selectFlow, navigateToPage]);

  // // Auto-close sidebar when flow is running
  // useEffect(() => {
  //   if (executionState.isRunning && isSidebarOpen) {
  //     closeSidebar();
  //   }
  // }, [executionState.isRunning, isSidebarOpen, closeSidebar]);

  // Auto-scroll output when new content is added - MUST be called before any early returns
  // useEffect(() => {
  //   if (outputRef.current) {
  //     outputRef.current.scrollTop = outputRef.current.scrollHeight;
  //   }
  // }, [output]);

  // // Cleanup execution stores for deleted flows
  // useEffect(() => {
  //   if (bubbleFlowList) {
  //     const activeFlowIds = bubbleFlowList.bubbleFlows.map((f) => f.id);
  //     cleanupDeletedFlows(activeFlowIds);
  //   }
  // }, [bubbleFlowList]);

  // Ref for auto-scrolling output
  // const outputRef = useRef<HTMLDivElement>(null);

  const API_BASE_URL_LOCAL = API_BASE_URL;

  // Initialize Clerk token synchronization for authenticated API calls
  useClerkTokenSync();

  // Use React Query for credentials fetching - MUST be called before any early returns
  const { data: availableCredentials = [] } =
    useCredentials(API_BASE_URL_LOCAL);

  // Fetch execution history to check if flow has been executed (limit to 1 for performance)
  const { data: executionHistory, refetch: refetchExecutionHistory } =
    useExecutionHistory(selectedFlowId, { limit: 50 });
  // Use the FlowGeneration hook to get the generateCode function
  const { generateCode: generateCodeFromHook } = useFlowGeneration();
  // Initialize execution hook with all the callbacks

  useEffect(() => {
    console.log('🚀 [useEffect] currentFlow changed:', currentFlow);
    if (currentFlow) {
      setEditorCode(currentFlow.code);
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
              // Use the bubble name as the key
              extractedCredentials[key] = bubbleCredentials;
            }
          }
        }
      );

      // Only update if there are extracted credentials and current state is empty
      if (Object.keys(extractedCredentials).length > 0) {
        executionState.setAllCredentials(extractedCredentials);
      }
    }
  }, [currentFlow]);

  // OAuth completion is now handled by the individual modals/components
  // No need for global navigation since we want to stay where we were

  // Handle OAuth callback - moved after all hook calls
  if (isOAuthCallback) {
    return <OAuthCallback apiBaseUrl={API_BASE_URL_LOCAL} />;
  }

  // Wrapper function that calls the hook's generateCode with proper parameters
  const generateCode = async () => {
    // Hide the sidebar so the IDE has maximum space during a new generation
    closeSidebar();

    await generateCodeFromHook(generationPrompt, selectedPreset);
  };

  const isRunnable = () => {
    if (!currentFlow) return false;
    const { isValid } = canExecute();
    return isValid && !createBubbleFlowMutation.isLoading && !isRunning;
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
    if (createBubbleFlowMutation.isLoading) return 'Creating flow...';

    const { isValid, reasons } = canExecute();
    if (!isValid && reasons.length > 0) {
      return reasons[0];
    }

    return '';
  };

  const deleteFlow = async (flowId: number, event: React.MouseEvent) => {
    // Prevent the click from propagating to selectFlow
    event.stopPropagation();

    // Show confirmation dialog
    const flowName = bubbleFlowList?.bubbleFlows.find(
      (flow) => flow.id === flowId
    )?.name;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${flowName}"?\n\nThis action cannot be undone.`
    );

    if (confirmed) {
      try {
        console.log('[deleteFlow] Deleting flow with ID:', flowId);

        // Use the delete mutation with optimistic updates
        await deleteBubbleFlowMutation.mutateAsync(flowId);
        setOutput(
          (prev) => prev + `\n✅ Flow "${flowName}" deleted successfully.`
        );

        console.log('[deleteFlow] Flow deletion completed successfully');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('[deleteFlow] Error deleting flow:', error);

        setOutput(
          (prev) =>
            prev + `\n❌ Failed to delete flow "${flowName}": ${errorMessage}`
        );
      }
    }
  };

  const notifyNavigationLocked = () => {
    if (!toast.isActive(navigationLockToastId)) {
      toast.info(
        'Flow generation in progress. Please wait until it completes before navigating.',
        {
          toastId: navigationLockToastId,
          autoClose: 3000,
        }
      );
    }
  };

  const handleSidebarPageChange = (
    page: 'prompt' | 'ide' | 'credentials' | 'flow-summary' | 'home'
  ) => {
    if (isStreaming) {
      notifyNavigationLocked();
      return;
    }
    navigateToPage(page);
  };

  const handleSidebarFlowSelect = (flow: number) => {
    if (isStreaming) {
      notifyNavigationLocked();
      return;
    }
    selectFlow(flow);
    navigateToPage('ide');
  };

  const handleSidebarFlowDelete = (flowId: number, event: React.MouseEvent) => {
    if (isStreaming) {
      event.stopPropagation();
      notifyNavigationLocked();
      return;
    }
    // Block deletion while a flow is being created to avoid race conditions
    if (createBubbleFlowMutation.isLoading) {
      event.stopPropagation();
      if (!toast.isActive('creation-lock-toast')) {
        toast.info(
          'Flow creation in progress. Please wait until it completes before deleting.',
          {
            toastId: 'creation-lock-toast',
            autoClose: 3000,
          }
        );
      }
      return;
    }
    deleteFlow(flowId, event);
  };

  // Handle opening the output panel and clearing the visual indicator
  const handleOpenOutputPanel = () => {
    expandOutput();
  };

  const handleExportClick = () => {
    toggleExportModal();
  };

  // Removed unused function getCredentialsForType

  // Render Home page (My Flows)
  if (currentPage === 'home') {
    console.log('🚀 [HomePage] Rendering HomePage');
    return (
      <>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onPageChange={handleSidebarPageChange}
        />
        <div
          className={`h-screen flex flex-col bg-[#1a1a1a] text-gray-100 ${isSidebarOpen ? 'pl-56' : 'pl-14'}`}
        >
          <div className="flex-1 min-h-0">
            <HomePage
              onFlowSelect={handleSidebarFlowSelect}
              onFlowDelete={handleSidebarFlowDelete}
              onNavigateToDashboard={() => navigateToPage('prompt')}
            />
          </div>
        </div>
      </>
    );
  }

  // Render Dashboard page
  if (currentPage === 'prompt') {
    console.log('🚀 [DashboardPage] Rendering DashboardPage');
    return (
      <DashboardPage
        isStreaming={isStreaming}
        generationPrompt={generationPrompt}
        setGenerationPrompt={setGenerationPrompt}
        selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}
        onGenerateCode={generateCode}
        // Sidebar props
        isSidebarOpen={isSidebarOpen}
        onSidebarToggle={toggleSidebar}
        onPageChange={handleSidebarPageChange}
        selectedFlow={selectedFlowId}
        onFlowSelect={handleSidebarFlowSelect}
        onFlowDelete={handleSidebarFlowDelete}
      />
    );
  }

  // Render Credentials page
  if (currentPage === 'credentials') {
    console.log('🚀 [CredentialsPage] Rendering CredentialsPage');
    return (
      <>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onPageChange={handleSidebarPageChange}
        />
        <div
          className={`h-screen flex flex-col bg-[#1a1a1a] text-gray-100 ${isSidebarOpen ? 'pl-56' : 'pl-14'}`}
        >
          <div className="flex-1 min-h-0">
            <CredentialsPage apiBaseUrl={API_BASE_URL} />
          </div>
        </div>
      </>
    );
  }

  const CodeEditorPanel = (
    <div className="h-full bg-[#1a1a1a] min-h-0">
      <div className="h-full min-h-0">
        <div className="h-full relative">
          <MonacoEditor />
          {/* Code editor overlay with line count */}
          <div className="absolute top-2 right-2 bg-[#1a1a1a] border border-[#30363d] px-2 py-1 rounded text-xs text-gray-400">
            {getEditorCode().split('\n').length} lines
          </div>
        </div>
      </div>
    </div>
  );

  // Flow summary is now handled inline in the main page, no separate page needed

  return (
    <>
      {/* Left Sidebar - Always render */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onPageChange={handleSidebarPageChange}
      />

      <div
        className={`h-screen flex flex-col bg-[#1a1a1a] text-gray-100 ${isSidebarOpen ? 'pl-56' : 'pl-14'}`}
      >
        {/* Header - Always render */}
        <div className="bg-[#1a1a1a] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {(() => {
                let name = '';
                let hasPrompt = false;

                if (isStreaming && generationPrompt) {
                  name = 'New Flow';
                  hasPrompt = true;
                } else if (selectedFlowId) {
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
                  name = getFlowNameFromCode(getEditorCode());
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

                    {/* Run button removed; execution is handled via the entry bubble */}

                    {/* Execute Flow Button moved into entry bubble */}
                  </>
                )}
              </SignedIn>
            </div>
          </div>
        </div>

        {/* Main content - Always render */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <PanelGroup
            direction="horizontal"
            autoSaveId="bubbleflow-main-layout"
          >
            {/* Left Panel - Execution History */}
            {showLeftPanel && (
              <>
                <Panel defaultSize={25} minSize={20} maxSize={40}>
                  <div className="h-full flex flex-col min-h-0 bg-[#1a1a1a]">
                    <div className="px-6 py-4 border-b border-[#30363d] bg-[#1a1a1a] flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-200">
                          History
                        </h3>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-auto thin-scrollbar p-4">
                      {bubbleFlowList?.bubbleFlows.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                            <span className="text-gray-500 text-xl">📎</span>
                          </div>
                          <p className="text-gray-400 text-sm mb-2">
                            No BubbleFlow yet
                          </p>
                          <p className="text-gray-500 text-xs">
                            Generate a flow to see it here
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bubbleFlowList?.bubbleFlows.map((flow) => (
                            <div
                              key={flow.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                selectedFlowId === flow.id
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : 'border-[#30363d] bg-[#161b22] hover:border-[#444c56] hover:bg-[#21262d]'
                              }`}
                              onClick={() => {
                                selectFlow(flow.id);
                              }}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-gray-200">
                                  {flow.name || 'Untitled Flow'}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(
                                    flow.createdAt
                                  ).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">
                                    {currentFlow?.code.split('\n').length} lines
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    title="Delete flow"
                                    onClick={() => {
                                      // TODO: Optimistic delete the flow
                                      if (selectedFlowId === flow.id) {
                                        selectFlow(null);
                                      }
                                    }}
                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
                {/* Editor/Flow Section - Shows Live Generation when streaming, otherwise Editor/Flow */}
                <Panel defaultSize={100} minSize={40}>
                  <div className="h-full flex flex-col">
                    {/* Flow Info Header - Shows current flow's prompt and title */}
                    {(() => {
                      // Determine which flow info to show
                      let currentFlowInfo = null;

                      if (isStreaming && generationPrompt) {
                        // Show info for flow currently being generated
                        currentFlowInfo = {
                          name: 'New Flow',
                          prompt: generationPrompt,
                          isFromHistory: false,
                          isGenerating: true,
                        };
                      } else if (selectedFlowId) {
                        // Show info for selected flow from history
                        const flow = currentFlow;
                        if (flow) {
                          currentFlowInfo = {
                            name: flow.name,
                            prompt: flow.prompt || 'No prompt available',
                            isFromHistory: true,
                          };
                        }
                      } else if (generationPrompt.trim()) {
                        // Show current prompt being typed
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
                        // Live Generation Section - now handled by FlowGeneration component
                        <FlowGeneration
                          isStreaming={isStreaming}
                          output={output}
                          isRunning={executionState.isRunning}
                        />
                      ) : (
                        // Normal Editor/Flow Section
                        <PanelGroup
                          direction="horizontal"
                          autoSaveId="bubbleflow-editor-flow-layout"
                          className="h-full"
                        >
                          {/* Flow Panel */}
                          <Panel
                            defaultSize={showEditor ? 50 : 100}
                            minSize={30}
                          >
                            <div className="h-full bg-[#1a1a1a] min-h-0">
                              <div className="h-full min-h-0">
                                <div className="h-full bg-gradient-to-br from-[#1a1a1a] to-[#1a1a1a] relative">
                                  <FlowVisualizer
                                    flowId={selectedFlowId}
                                    onValidate={() =>
                                      validateCodeMutation.mutateAsync({
                                        code: getEditorCode(),
                                        flowId: selectedFlowId!,
                                        credentials:
                                          executionState.pendingCredentials,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </Panel>

                          <>
                            {showEditor && (
                              <PanelResizeHandle className="w-2 bg-[#30363d] hover:bg-blue-500 transition-colors" />
                            )}

                            {/* Editor Panel - always mounted but hidden when showEditor is false */}
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

                {/* Flow Execution Configuration Section removed; inputs now inline in Flow */}
              </PanelGroup>
            </Panel>
          </PanelGroup>
          {/* Bottom floating drawer for Live Output - spans full width */}
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
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={toggleExportModal}
        code={getEditorCode()}
        flowName={(() => {
          // Get flow name from selected flow or generate from code
          if (selectedFlowId) {
            const flow = currentFlow;
            if (flow) return flow.name;
          }
          return getFlowNameFromCode(getEditorCode());
        })()}
        flowId={currentFlow?.id}
        inputsSchema={JSON.stringify(currentFlow?.inputSchema)}
        requiredCredentials={currentFlow?.requiredCredentials}
      />

      {/* Bubble Side Panel for adding bubbles */}
      <BubbleSidePanel />

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
}

export default App;
