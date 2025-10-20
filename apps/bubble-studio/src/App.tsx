import { useEffect, useRef } from 'react';
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
import { useExecutionStream } from '@/hooks/useExecutionStream';
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
import { useSubscription } from '@/hooks/useSubscription';
import { useValidateCode } from '@/hooks/useValidateCode';
import { extractInputSchemaFromCode } from '@/utils/inputSchemaParser';
import { cleanupFlattenedKeys } from '@/utils/codeParser';

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
    hasNewOutputEvents,
    showExportModal,
    showPrompt,
    togglePrompt,
    selectFlow,
    navigateToPage,
    showEditorPanel,
    closeSidebar,
    collapseOutput,
    expandOutput,
    markNewOutputEvents,
    markOutputAsRead,
    toggleExportModal,
    toggleSidebar,
  } = useUIStore();

  // Output Store - Console output
  const { output, setOutput } = useOutputStore();

  // Generation Store - Flow generation state
  const {
    generationPrompt,
    selectedPreset,
    isStreaming,
    setGenerationPrompt,
    setSelectedPreset,
    startStreaming,
    stopStreaming,
  } = useGenerationStore();
  // Editor Store - Monaco editor
  const { closeSidePanel, setExecutionHighlight, openPearlChat } =
    useEditorStore();
  // Per-flow Execution Store
  const executionState = useExecutionStore(selectedFlowId);

  // ============= React Query Hooks =============
  const {
    data: currentFlow,
    loading: currentFlowLoading,
    updateBubbleParameters: updateCurrentBubbleParameters,
    updateRequiredCredentials: updateCurrentRequiredCredentials,
    updateInputSchema: updateCurrentInputSchema,
    updateCode: updateCurrentCode,
  } = useBubbleFlow(selectedFlowId);
  const validateCodeMutation = useValidateCode({ flowId: selectedFlowId });

  const { refetch: refetchSubscriptionStatus } = useSubscription();
  const { data: bubbleFlowList } = useBubbleFlowList();
  const createBubbleFlowMutation = useCreateBubbleFlow();
  const deleteBubbleFlowMutation = useDeleteBubbleFlow();

  // ============= Refs =============
  const navigationLockToastId = 'sidebar-navigation-lock';
  const lastExecutingBubbleRef = useRef<string | null>(null);

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
  const outputRef = useRef<HTMLDivElement>(null);

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
  // Initialize execution stream hook
  const executionStream = useExecutionStream(selectedFlowId, {
    onEvent: () => {
      // Set visual indicator when new events arrive and output is collapsed
      if (isOutputCollapsed) {
        markNewOutputEvents();
      }
    },
    onComplete: () => {
      executionState.stopExecution();
      // Refetech subscription to update token usage
      refetchSubscriptionStatus();
    },
    onError: (error: string, isFatal?: boolean, errorVariableId?: number) => {
      executionState.stopExecution();
      setOutput((prev) => prev + `\n❌ Execution failed: ${error}`);
      // Clear visual indicator when execution fails
      markOutputAsRead();

      // If this is a fatal error, mark the bubble with error
      if (isFatal) {
        console.log(
          'Fatal error received. errorVariableId:',
          errorVariableId,
          'lastExecutingBubble:',
          lastExecutingBubbleRef.current
        );
        // First try to use the variableId from the error event
        if (errorVariableId !== undefined) {
          const bubbleId = String(errorVariableId);
          executionState.setBubbleError(bubbleId);
          console.log(
            '✅ Fatal error detected with variableId, marking bubble:',
            bubbleId
          );
        } else if (lastExecutingBubbleRef.current) {
          // Fallback to last executing bubble
          executionState.setBubbleError(lastExecutingBubbleRef.current);
          console.log(
            '✅ Fatal error detected, marking last executing bubble:',
            lastExecutingBubbleRef.current
          );
        } else {
          console.warn('❌ Fatal error occurred but no bubble ID available');
        }
      }
    },
    onBubbleExecution: (event) => {
      console.log('Bubble execution event:', event);

      // Find the bubble by variableId using the ref to get latest values
      if (event.variableId) {
        const bubble = findBubbleByVariableId(
          currentFlow?.bubbleParameters || {},
          event.variableId
        );
        if (bubble) {
          console.log('Found bubble for execution:', bubble);

          const bubbleId = String(bubble.variableId);

          // Track this as the last executing bubble (use ref to avoid stale closures)
          lastExecutingBubbleRef.current = bubbleId;
          console.log('Tracking last executing bubble:', bubbleId);

          // Highlight the bubble in the flow
          executionState.highlightBubble(bubbleId);

          // Highlight the line range in the editor (validate line numbers)
          if (bubble.location.startLine > 0 && bubble.location.endLine > 0) {
            setExecutionHighlight({
              startLine: bubble.location.startLine,
              endLine: bubble.location.endLine,
            });
          } else {
            console.warn('Invalid line numbers for bubble:', bubble);
          }

          // Keep highlighting until manually deselected
        } else {
          console.warn(
            'Bubble not found for variableId:',
            event.variableId,
            'Available bubbles:',
            Object.keys(currentFlow?.bubbleParameters || {})
          );
        }
      }
    },
    onBubbleExecutionComplete: (event) => {
      console.log('Bubble execution complete event:', event);

      // Also track the last executing bubble on completion
      // This ensures we have the bubble ID even if only completion events fire
      if (event.variableId) {
        const bubble = findBubbleByVariableId(
          currentFlow?.bubbleParameters || {},
          event.variableId
        );
        if (bubble) {
          const bubbleId = String(bubble.variableId);
          executionState.setLastExecutingBubble(bubbleId);
        }
      }
      refetchExecutionHistory();
    },
    onBubbleParametersUpdate: () => {
      executionState.clearHighlighting();
    },
  });

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

  const handleParameterChange = (
    bubbleKey: string | number,
    paramName: string,
    newValue: unknown
  ) => {
    console.log(`Parameter change: ${bubbleKey}.${paramName} =`, newValue);

    // // Update the current bubble parameters
    // updateCurrentBubbleParameters(() => {
    //   const currentBubble = prev[bubbleKey] as ParsedBubbleWithInfo;
    //   if (!currentBubble) return prev;

    //   return {
    //     ...prev,
    //     [bubbleKey]: {
    //       ...currentBubble,
    //       parameters:
    //         currentBubble.parameters?.map((param) =>
    //           param.name === paramName ? { ...param, value: newValue } : param
    //         ) || [],
    //     },
    //   };
    // });

    // Note: Updating the actual code would require complex AST manipulation
    // For now, we just update the visualization data
    // In a future iteration, we could implement code regeneration based on parameter changes
  };

  const updateBubbleParameters = async (
    bubbleFlowId: number,
    bubbleParameters: Record<string, unknown>,
    credentials: Record<string, Record<string, number>>
  ) => {
    try {
      // Add selected credentials to each bubble's parameters
      const updatedParameters = { ...bubbleParameters };

      for (const [bubbleName, bubble] of Object.entries(updatedParameters)) {
        if (
          credentials[bubbleName] &&
          Object.keys(credentials[bubbleName]).length > 0
        ) {
          const bubbleObj = bubble as Record<string, unknown>;
          const params = (bubbleObj.parameters || []) as Array<
            Record<string, unknown>
          >;

          // Remove existing credentials parameter if any
          const filteredParams = params.filter((p) => p.name !== 'credentials');

          // Add new credentials parameter with selected credential IDs
          filteredParams.push({
            name: 'credentials',
            value: credentials[bubbleName],
            type: 'object',
          });

          bubbleObj.parameters = filteredParams;
        }
      }

      console.log(
        'Updating bubble parameters with credentials:',
        updatedParameters
      );

      await api.put(`/bubble-flow/${bubbleFlowId}`, {
        bubbleParameters: updatedParameters,
      });

      return true;
    } catch (error) {
      console.error('Failed to update bubble parameters:', error);
      return false;
    }
  };

  // Centralized function to update credentials: Always fetch fresh data from API
  const updateFlowCredentials = async (
    flowId: number,
    newCredentials: Record<string, Record<string, number>>
  ): Promise<boolean> => {
    try {
      console.log(
        '[updateFlowCredentials] Updating credentials for flow:',
        flowId,
        newCredentials
      );

      // Fetch fresh flow data from getBubbleFlowRoute API
      const flowData = await api.get<BubbleFlowDetailsResponse>(
        `/bubble-flow/${flowId}`
      );
      console.log('[updateFlowCredentials] Fetched fresh flow data from API');

      // Step 1: Update server with bubble parameters from API
      const serverSuccess = await updateBubbleParameters(
        flowId,
        flowData.bubbleParameters || {},
        newCredentials
      );

      if (!serverSuccess) {
        console.error('[updateFlowCredentials] Failed to update server');
        return false;
      }

      console.log('[updateFlowCredentials] Successfully updated credentials');
      return true;
    } catch (error) {
      console.error(
        '[updateFlowCredentials] Error updating credentials:',
        error
      );
      return false;
    }
  };

  const executeWithLiveStreaming = async (
    bubbleFlowId: number,
    credentials: Record<string, Record<string, number>>,
    schemaInputs?: Record<string, unknown>
  ) => {
    // Check if code == flow's code
    if (getEditorCode() !== currentFlow?.code) {
      const isValid = await validateCodeMutation.mutateAsync({
        code: getEditorCode(),
        flowId: bubbleFlowId,
        credentials: credentials,
      });
      if (!isValid) {
        executionState.stopExecution();
        return;
      }
    }
    // Clear any existing visual indicator when starting execution
    markOutputAsRead();
    // Clear error state when starting new execution
    executionState.setBubbleError(null);
    executionState.setLastExecutingBubble(null);
    lastExecutingBubbleRef.current = null;

    try {
      // Prepare execution payload
      const payload = schemaInputs || {};

      // Execute with streaming using the base flow ID (backend expects the original flow ID)
      await executionStream.executeWithStreaming(payload);

      // Create a new flow entry for this execution run
    } catch (error) {
      console.error('Error executing flow:', error);
    } finally {
    }
  };

  // Wrapper function that calls the hook's generateCode with proper parameters
  const generateCode = async () => {
    // Hide the sidebar so the IDE has maximum space during a new generation
    closeSidebar();

    await generateCodeFromHook(generationPrompt, selectedPreset);
  };

  const isExecutionFormValid = () => {
    if (!currentFlow) return false;
    try {
      // Only require fields that actually map to bubble parameters
      let schema = currentFlow.inputSchema!;
      if (typeof schema === 'string') {
        schema = JSON.parse(schema);
      }
      const requiredFields: string[] = Array.isArray(schema.required)
        ? schema.required
        : [];

      const isValid = requiredFields.every((fieldName: string) => {
        return (
          executionState.executionInputs[fieldName] !== undefined &&
          executionState.executionInputs[fieldName] !== ''
        );
      });
      return isValid;
    } catch {
      // If schema parsing fails, assume form is valid
      return true;
    }
  };

  // Determine if a credential type is system-managed (no user selection required)
  const isSystemCredential = (credType: CredentialType) => {
    return SYSTEM_CREDENTIALS.has(credType);
  };
  // Validate that all required, non-system credentials with available options are selected
  const isCredentialsSelectionValid = () => {
    console.log('currentFlow', currentFlow);
    console.log(
      'pendingExecutionCredentials',
      executionState.pendingCredentials
    );
    console.log('availableCredentials', availableCredentials);
    const required = currentFlow?.requiredCredentials || {};
    const requiredEntries = Object.entries(required) as Array<
      [string, string[]]
    >;
    if (requiredEntries.length === 0) return true;

    for (const [bubbleKey, credTypes] of requiredEntries) {
      for (const credType of credTypes) {
        if (isSystemCredential(credType as CredentialType)) continue; // system-managed

        const selectedForBubble =
          executionState.pendingCredentials[bubbleKey] || {};
        const selectedId = selectedForBubble[credType];
        if (selectedId === undefined || selectedId === null) {
          return false;
        }
      }
    }
    return true;
  };

  const isRunnable = () => {
    return (
      !!currentFlow &&
      isExecutionFormValid() &&
      isCredentialsSelectionValid() &&
      !executionState.isRunning &&
      !createBubbleFlowMutation.isLoading &&
      !executionState.isValidating
    );
  };

  const handleExecuteFromMainPage = async () => {
    if (!currentFlow) return;

    executionState.startExecution();

    // Gate execution if required inputs or credentials are missing
    if (!isExecutionFormValid()) {
      toast.error('Please fill all required inputs before running.');
      console.groupEnd();
      return;
    }
    if (!isCredentialsSelectionValid()) {
      toast.error('Please select all required credentials before running.');
      console.groupEnd();
      executionState.stopExecution();
      return;
    }

    // Apply any pending credential changes before executing
    const currentPendingCredentials = executionState.pendingCredentials;
    if (!currentFlow.id) {
      console.error('Cannot execute: No flow ID available');
      toast.error('Cannot execute: No flow ID available');
      return;
    }
    await updateFlowCredentials(currentFlow.id, currentPendingCredentials);

    // Clean up any flattened keys before executing
    const cleanedInputs = cleanupFlattenedKeys(executionState.executionInputs);

    // Payload size estimation
    const payloadSize = JSON.stringify(cleanedInputs).length;
    console.log(
      `📏 Payload size: ${payloadSize} characters (${(payloadSize / 1024).toFixed(2)} KB)`
    );

    console.groupEnd();

    // Always use Live Execution for flow execution, regardless of current tab
    if (typeof currentFlow.id !== 'number') {
      console.error('Invalid flow id for execution:', currentFlow.id);
      toast.error('Cannot execute: Invalid flow ID.');
      return;
    }

    await executeWithLiveStreaming(
      currentFlow.id,
      currentPendingCredentials,
      cleanedInputs
    );
  };

  const getRunDisabledReason = () => {
    if (!currentFlow) return 'Create or select a flow first';
    if (executionState.isValidating) return 'Validating code...';
    if (executionState.isRunning) return 'Execution in progress';
    if (createBubbleFlowMutation.isLoading) return 'Flow creation in progress';
    if (!isExecutionFormValid()) return 'Fill all required inputs';
    if (!isCredentialsSelectionValid()) return 'Select required credentials';
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
    markOutputAsRead();
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

  console.log('🚀 [App] Rendering App');
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
                        if (showEditor) {
                          closeSidePanel();
                        }
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
                                    bubbleParameters={
                                      currentFlow?.bubbleParameters || {}
                                    }
                                    onParameterChange={handleParameterChange}
                                    highlightedBubble={
                                      executionState.highlightedBubble
                                    }
                                    onHighlightChange={(bubbleKey) => {
                                      console.log(
                                        'Bubble highlight changed to:',
                                        bubbleKey
                                      );
                                      executionState.highlightBubble(bubbleKey);

                                      // Clear code highlighting when bubble is deselected
                                      if (bubbleKey === null) {
                                        setExecutionHighlight(null);
                                      }
                                    }}
                                    onBubbleClick={(bubbleKey, bubble) => {
                                      console.log(
                                        'Bubble clicked:',
                                        bubbleKey,
                                        bubble
                                      );

                                      // Highlight the bubble in the flow
                                      executionState.highlightBubble(
                                        String(bubbleKey)
                                      );

                                      // Highlight the line range in the editor (validate line numbers)
                                      if (
                                        bubble.location.startLine > 0 &&
                                        bubble.location.endLine > 0
                                      ) {
                                        setExecutionHighlight({
                                          startLine: bubble.location.startLine,
                                          endLine: bubble.location.endLine,
                                        });
                                      } else {
                                        console.warn(
                                          'Invalid line numbers for clicked bubble:',
                                          bubble
                                        );
                                      }
                                    }}
                                    onParamEditInCode={(
                                      bubbleKey,
                                      bubble,
                                      paramName
                                    ) => {
                                      // Show the editor first
                                      if (!showEditor) {
                                        showEditorPanel();
                                      }

                                      // Set single-line selection using the shared range highlighter
                                      // We'll compute the exact line and then set start=end=that line

                                      // Try to find the parameter's exact line from server-provided param location
                                      try {
                                        const param = (
                                          bubble.parameters || []
                                        ).find(
                                          (p: { name?: string }) =>
                                            p?.name === paramName
                                        ) as
                                          | ((typeof bubble.parameters)[number] & {
                                              location?: {
                                                startLine?: number;
                                              };
                                            })
                                          | undefined;

                                        const paramLine =
                                          param?.location?.startLine;
                                        if (
                                          typeof paramLine === 'number' &&
                                          paramLine > 0
                                        ) {
                                          setExecutionHighlight({
                                            startLine: paramLine,
                                            endLine: paramLine,
                                          });
                                        } else {
                                          // Fallback: scan code between bubble range for the property name
                                          const start = Math.max(
                                            1,
                                            bubble.location.startLine || 1
                                          );
                                          const end = Math.max(
                                            start,
                                            bubble.location.endLine || start
                                          );
                                          const codeLines =
                                            getEditorCode().split('\n');
                                          const searchStart = Math.min(
                                            start - 1,
                                            codeLines.length - 1
                                          );
                                          const searchEnd = Math.min(
                                            end - 1,
                                            codeLines.length - 1
                                          );
                                          let foundLine: number | null = null;
                                          for (
                                            let i = searchStart;
                                            i <= searchEnd;
                                            i++
                                          ) {
                                            const line = codeLines[i];
                                            if (!line) continue;
                                            // match `<paramName>:` allowing spaces and quotes
                                            const re = new RegExp(
                                              `(^|[,{\n\r\t\\s])${paramName}\\s*:`
                                            );
                                            if (re.test(line)) {
                                              foundLine = i + 1; // 1-based
                                              break;
                                            }
                                          }
                                          if (foundLine) {
                                            setExecutionHighlight({
                                              startLine: foundLine,
                                              endLine: foundLine,
                                            });
                                          } else {
                                            // No specific line found; default to highlighting the bubble block
                                            if (
                                              bubble.location.startLine > 0 &&
                                              bubble.location.endLine > 0
                                            ) {
                                              setExecutionHighlight({
                                                startLine:
                                                  bubble.location.startLine,
                                                endLine:
                                                  bubble.location.endLine,
                                              });
                                            }
                                          }
                                        }
                                      } catch (error) {
                                        console.warn(
                                          'Param location resolution failed',
                                          error
                                        );
                                        if (
                                          bubble.location.startLine > 0 &&
                                          bubble.location.endLine > 0
                                        ) {
                                          setExecutionHighlight({
                                            startLine:
                                              bubble.location.startLine,
                                            endLine: bubble.location.endLine,
                                          });
                                        } else {
                                          setExecutionHighlight(null);
                                        }
                                      }

                                      // Keep the flow selection
                                      executionState.highlightBubble(
                                        String(bubbleKey)
                                      );
                                    }}
                                    requiredCredentials={(() => {
                                      return (
                                        currentFlow?.requiredCredentials || {}
                                      );
                                    })()}
                                    availableCredentials={availableCredentials}
                                    selectedCredentials={
                                      executionState.pendingCredentials
                                    }
                                    flowName={
                                      currentFlow?.name ||
                                      getFlowNameFromCode(getEditorCode())
                                    }
                                    inputsSchema={JSON.stringify(
                                      currentFlow?.inputSchema ||
                                        extractInputSchemaFromCode(
                                          getEditorCode()
                                        )
                                    )}
                                    onInputsChange={() => {
                                      //executionState.setInputs
                                    }}
                                    onExecute={handleExecuteFromMainPage}
                                    isExecuting={executionState.isRunning}
                                    isFormValid={isExecutionFormValid()}
                                    executionInputs={
                                      executionState.executionInputs
                                    }
                                    onExecutionInputChange={(field, value) => {
                                      executionState.setInput(field, value);
                                    }}
                                    isLoading={
                                      createBubbleFlowMutation.isLoading ||
                                      currentFlowLoading
                                    }
                                    onValidate={() =>
                                      validateCodeMutation.mutateAsync({
                                        code: getEditorCode(),
                                        flowId: selectedFlowId!,
                                        credentials:
                                          executionState.pendingCredentials,
                                      })
                                    }
                                    isRunning={executionState.isRunning}
                                    bubbleWithError={
                                      executionState.bubbleWithError
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
                              className={showEditor ? '' : 'hidden'}
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
                title={
                  hasNewOutputEvents
                    ? 'Show Live Execution Output - New events available!'
                    : 'Show Live Execution Output'
                }
              >
                <div className="flex items-center gap-2">
                  <span>Live Execution Output</span>
                  {hasNewOutputEvents && (
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
                  isExecuting={executionStream.state.isExecuting}
                  onExecutionStateChange={executionState.startExecution}
                  events={executionStream.state.events}
                  currentLine={executionStream.state.currentLine}
                  executionStats={executionStream.getExecutionStats()}
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
