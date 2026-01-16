import React, { useRef, useMemo, useState } from 'react';
import { PlayIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  ChevronDown,
  ChevronRight,
  Workflow,
} from 'lucide-react';
import type { StreamingLogEvent } from '@bubblelab/shared-schemas';
import { findLogoForBubble } from '../../lib/integrations';
import { getVariableNameForDisplay } from '../../utils/bubbleUtils';
import { useBubbleFlow } from '../../hooks/useBubbleFlow';
import { useLiveOutput } from '../../hooks/useLiveOutput';
import { usePearlChatStore } from '../../hooks/usePearlChatStore';
import { useUIStore } from '../../stores/uiStore';
import { useExecutionStore } from '../../stores/executionStore';
import type { TabType } from '../../stores/liveOutputStore';
import { extractStepGraph, type StepData } from '../../utils/workflowToSteps';
import { BubbleExecutionCard } from './BubbleExecutionCard';
import { pairBubbleEvents } from './pairBubbleEvents';

interface AllEventsViewProps {
  orderedItems: Array<
    | {
        kind: 'group';
        name: string;
        events: StreamingLogEvent[];
        firstTs: number;
      }
    | { kind: 'global'; event: StreamingLogEvent; firstTs: number }
  >;
  currentLine: number | null;
  getEventIcon: (event: StreamingLogEvent) => React.ReactElement;
  formatTimestamp: (timestamp: string) => string;
  formatEventMessage: (event: StreamingLogEvent) => string;
  makeLinksClickable: (text: string | null) => (string | React.ReactElement)[];
  renderJson: React.ComponentType<{
    data: unknown;
    flowId?: number | null;
    executionId?: number;
    timestamp?: string;
  }>;
  flowId?: number | null;
  events: StreamingLogEvent[]; // NEW: All events for filtering
  warningCount: number; // NEW: For badge
  errorCount: number; // NEW: For badge
  isRunning?: boolean; // NEW: Execution state
}

export default function AllEventsView({
  orderedItems,
  currentLine,
  getEventIcon,
  formatTimestamp,
  formatEventMessage,
  makeLinksClickable,
  renderJson: JsonRenderer,
  flowId = null,
  events,
  warningCount,
  errorCount,
  isRunning = false,
}: AllEventsViewProps) {
  // Get bubble flow data to access bubble parameters
  const currentFlow = useBubbleFlow(flowId);
  const bubbleParameters = currentFlow.data?.bubbleParameters || {};

  // Use LiveOutput hook for state management
  const {
    selectedTab,
    setSelectedTab,
    selectedEventIndexByVariableId,
    setSelectedEventIndex,
    selectBubbleInConsole,
  } = useLiveOutput(flowId);

  // Pearl chat integration for error fixing
  const pearl = usePearlChatStore(flowId);
  const { openConsolidatedPanelWith } = useUIStore();

  // Get execution state for bubble status
  const executionState = useExecutionStore(flowId);
  const {
    runningBubbles,
    completedBubbles,
    bubbleWithError,
    bubbleResults,
    isEvaluating,
    evaluationResult,
    activeBrowserSession,
  } = executionState;

  const eventsEndRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const contentScrollRef = useRef<HTMLDivElement>(null);

  // State for expanded bubbles (bubbles with sub-bubbles can be expanded)
  const [expandedBubbles, setExpandedBubbles] = useState<Set<string>>(
    new Set()
  );

  // View mode: 'unified' shows input/output together, 'timeline' shows original slider view
  const [viewMode, setViewMode] = useState<'unified' | 'timeline'>('unified');

  // Memoized paired executions for unified view
  const pairedExecutions = useMemo(() => {
    return pairBubbleEvents(events, bubbleParameters);
  }, [events, bubbleParameters]);

  const toggleBubbleExpansion = (bubbleId: string) => {
    setExpandedBubbles((prev) => {
      const next = new Set(prev);
      if (next.has(bubbleId)) {
        next.delete(bubbleId);
      } else {
        next.add(bubbleId);
      }
      return next;
    });
  };

  // Extract step graph from workflow
  const stepGraph = useMemo(() => {
    if (!currentFlow.data?.workflow || !bubbleParameters) {
      return { steps: [], edges: [] };
    }
    // Convert bubbleParameters to the expected format (Record<number, ParsedBubbleWithInfo>)
    const bubblesRecord: Record<number, (typeof bubbleParameters)[string]> = {};
    for (const [key, value] of Object.entries(bubbleParameters)) {
      bubblesRecord[parseInt(key, 10)] = value;
    }
    return extractStepGraph(currentFlow.data.workflow, bubblesRecord);
  }, [currentFlow.data?.workflow, bubbleParameters]);

  // Helper to get bubble execution status
  const getBubbleStatus = (
    variableId: string
  ): 'pending' | 'running' | 'complete' | 'error' => {
    // Check for error state first (either via bubbleWithError or failed result)
    if (bubbleWithError === variableId || bubbleResults[variableId] === false)
      return 'error';
    // Check if completed
    if (completedBubbles[variableId]) return 'complete';
    // Check if running
    if (runningBubbles.has(variableId)) return 'running';
    return 'pending';
  };

  // Helper to get step execution status (based on its bubbles OR its own variableId for transformation functions)
  const getStepStatus = (
    step: StepData
  ): 'pending' | 'running' | 'complete' | 'error' => {
    // For transformation functions or steps with no bubbles, check the step's own variableId
    const stepVariableId =
      step.variableId ?? step.transformationData?.variableId;
    if (step.bubbleIds.length === 0 && stepVariableId) {
      return getBubbleStatus(String(stepVariableId));
    }

    // For steps with bubbles, check all bubble statuses
    const bubbleStatuses = step.bubbleIds.map((id) =>
      getBubbleStatus(String(id))
    );
    if (bubbleStatuses.includes('error')) return 'error';
    if (bubbleStatuses.includes('running')) return 'running';
    if (
      bubbleStatuses.every((s) => s === 'complete') &&
      bubbleStatuses.length > 0
    )
      return 'complete';
    if (bubbleStatuses.some((s) => s === 'complete')) return 'running'; // Partially complete
    return 'pending';
  };

  // Status indicator component
  const StatusIndicator = ({
    status,
    size = 'normal',
  }: {
    status: 'pending' | 'running' | 'complete' | 'error';
    size?: 'small' | 'normal';
  }) => {
    const sizeClass = size === 'small' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    switch (status) {
      case 'running':
        return (
          <Loader2 className={`${sizeClass} text-blue-400 animate-spin`} />
        );
      case 'complete':
        return <CheckCircle2 className={`${sizeClass} text-emerald-400`} />;
      case 'error':
        return <XCircle className={`${sizeClass} text-red-400`} />;
      default:
        return (
          <Circle
            className={`${size === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-gray-600`}
          />
        );
    }
  };

  // Count info events (exclude log_line from info grouping)
  const infoCount = events.filter(
    (e) => e.type === 'info' || e.type === 'debug' || e.type === 'trace'
  ).length;

  // Total count for Results tab (all global events)
  const totalGlobalCount = infoCount + warningCount + errorCount;

  // Generate unified tabs: Bubble execution tabs + Results tab at the end
  const allTabs: Array<{
    id: string;
    label: string;
    badge?: number;
    icon: React.ReactElement;
    type: TabType;
  }> = [];

  // Add bubble execution tabs first
  orderedItems.forEach((item, index) => {
    if (item.kind === 'group') {
      const varId = item.name;
      const bubbleName = (item.events[0] as { bubbleName?: string }).bubbleName;
      const logo = findLogoForBubble({ bubbleName: bubbleName });
      allTabs.push({
        id: `bubble-${varId}`,
        label: getVariableNameForDisplay(varId, item.events, bubbleParameters),
        badge: item.events.length,
        icon: logo ? (
          <img
            src={logo.file}
            alt={`${logo.name} logo`}
            className="h-4 w-4 opacity-80"
            loading="lazy"
          />
        ) : (
          <PlayIcon className="h-4 w-4 text-blue-400" />
        ),
        type: { kind: 'item', index },
      });
    }
  });

  // Add Results tab at the end - only when execution is complete
  if (!isRunning) {
    allTabs.push({
      id: 'results',
      label: 'Results',
      badge: totalGlobalCount,
      icon: <InformationCircleIcon className="h-4 w-4 text-blue-300" />,
      type: { kind: 'results' },
    });
  }

  // Determine if current tab matches
  const isTabSelected = (tabType: TabType) => {
    if (selectedTab.kind !== tabType.kind) return false;
    if (selectedTab.kind === 'item' && tabType.kind === 'item') {
      return selectedTab.index === tabType.index;
    }
    return true;
  };

  // Handler for "Fix with Pearl" CTA - used in both Results tab and individual bubble views
  const handleFixWithPearl = (issueDetails?: string) => {
    if (!flowId) return;

    // Use specific issue details if provided, otherwise use generic message
    const prompt = issueDetails
      ? `The workflow check found the following issue:\n\n${issueDetails}\n\nPlease help me fix this issue in my workflow.`
      : `I'm seeing error(s) in my workflow execution. Can you tell me what I can do address these errors / fix any issues in the workflow as you see fit?`;

    // Trigger Pearl generation (component doesn't subscribe to Pearl state)
    pearl.startGeneration(prompt);

    // Open Pearl panel
    openConsolidatedPanelWith('pearl');
  };

  return (
    <div className="flex h-full bg-[#0d1117]">
      {/* Vertical Sidebar with Step Hierarchy */}
      <div
        ref={tabsRef}
        className="flex-shrink-0 border-r border-[#21262d] bg-[#0d1117] overflow-y-auto thin-scrollbar w-56"
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-[#21262d] bg-[#161b22]/50">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Execution Steps
          </span>
        </div>

        {/* Step Hierarchy */}
        <div className="py-2">
          {stepGraph.steps.length > 0
            ? // Show steps with bubbles grouped under them
              stepGraph.steps.map((step, stepIndex) => {
                const stepStatus = getStepStatus(step);
                // Find bubble tabs that belong to this step
                const stepBubbleTabs = allTabs.filter((tab) => {
                  if (tab.type.kind !== 'item') return false;
                  const item = orderedItems[tab.type.index];
                  if (item?.kind !== 'group') return false;
                  return step.bubbleIds.includes(parseInt(item.name, 10));
                });

                // Get the step's variableId (from step.variableId for regular functions, or transformationData for transformations)
                const stepVariableId =
                  step.variableId ?? step.transformationData?.variableId;

                // Check if this step is selected
                const isStepSelected = (() => {
                  if (stepVariableId) {
                    if (selectedTab.kind === 'item') {
                      const item = orderedItems[selectedTab.index];
                      return (
                        item?.kind === 'group' &&
                        item.name === String(stepVariableId)
                      );
                    }
                    return false;
                  }
                  return stepBubbleTabs.some((tab) => isTabSelected(tab.type));
                })();

                // Click handler for step - selects the step's output in console
                const handleStepClick = () => {
                  // Use step's variableId if available
                  if (stepVariableId) {
                    selectBubbleInConsole(String(stepVariableId));
                  } else if (stepBubbleTabs.length > 0) {
                    // Fallback: select the first bubble
                    setSelectedTab(stepBubbleTabs[0].type);
                  }
                };

                return (
                  <div key={step.id} className="mb-1">
                    {/* Step Header - Clickable */}
                    <button
                      type="button"
                      onClick={handleStepClick}
                      className={`w-full flex items-center gap-2 px-3 py-2 transition-all group ${
                        isStepSelected
                          ? 'bg-[#1f6feb]/10'
                          : 'bg-[#161b22]/30 hover:bg-[#161b22]/60'
                      }`}
                    >
                      {/* Step number */}
                      <div
                        className={`
                      flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                      ${
                        stepStatus === 'running'
                          ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                          : stepStatus === 'complete'
                            ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                            : stepStatus === 'error'
                              ? 'bg-red-500/20 border border-red-500 text-red-400'
                              : 'bg-[#21262d] text-gray-500'
                      }
                    `}
                      >
                        {stepIndex + 1}
                      </div>
                      {/* Step name */}
                      <div className="flex-1 min-w-0 text-left">
                        <span
                          className={`text-[11px] font-medium truncate block ${
                            isStepSelected
                              ? 'text-[#58a6ff]'
                              : 'text-gray-300 group-hover:text-gray-200'
                          }`}
                        >
                          {step.functionName}
                        </span>
                        {step.description && (
                          <span className="text-[9px] text-gray-500 truncate block">
                            {step.description}
                          </span>
                        )}
                      </div>
                      <StatusIndicator status={stepStatus} size="small" />
                    </button>

                    {/* Bubbles under this step */}
                    <div className="relative ml-5 border-l border-[#30363d]">
                      {stepBubbleTabs.map((tab) => {
                        const isSelected = isTabSelected(tab.type);
                        const item =
                          orderedItems[
                            (tab.type as { kind: 'item'; index: number }).index
                          ];
                        const bubbleId =
                          item?.kind === 'group' ? item.name : '';
                        const bubbleStatus =
                          item?.kind === 'group'
                            ? getBubbleStatus(item.name)
                            : 'pending';

                        // Check if this bubble has sub-bubbles via dependencyGraph
                        const bubbleParam = bubbleParameters[bubbleId];
                        const dependencyGraph = (
                          bubbleParam as {
                            dependencyGraph?: {
                              dependencies?: Array<{
                                variableId?: number;
                                name?: string;
                              }>;
                            };
                          }
                        )?.dependencyGraph;
                        const subBubbleDeps =
                          dependencyGraph?.dependencies || [];
                        const hasSubBubbles = subBubbleDeps.length > 0;
                        const isExpanded = expandedBubbles.has(bubbleId);

                        // Find sub-bubble tabs in allTabs that match the dependency variableIds
                        const subBubbleTabs = hasSubBubbles
                          ? allTabs.filter((t) => {
                              if (t.type.kind !== 'item') return false;
                              const subItem = orderedItems[t.type.index];
                              if (subItem?.kind !== 'group') return false;
                              // Check if this item's variableId matches any dependency
                              return subBubbleDeps.some(
                                (dep) => String(dep.variableId) === subItem.name
                              );
                            })
                          : [];

                        return (
                          <div key={tab.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedTab(tab.type)}
                              className={`relative w-full flex items-center gap-2 pl-4 pr-3 py-1.5 transition-all group ${
                                isSelected
                                  ? 'bg-[#1f6feb]/10'
                                  : 'hover:bg-[#161b22]'
                              }`}
                            >
                              {/* Connecting dot */}
                              <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#30363d]" />

                              {/* Expand/collapse button for bubbles with sub-bubbles */}
                              {hasSubBubbles && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleBubbleExpansion(bubbleId);
                                  }}
                                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              )}

                              {/* Bubble icon */}
                              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                                {tab.icon}
                              </div>

                              {/* Bubble name */}
                              <span
                                className={`text-[10px] truncate flex-1 text-left ${
                                  isSelected
                                    ? 'text-[#58a6ff]'
                                    : 'text-gray-400 group-hover:text-gray-300'
                                }`}
                              >
                                {tab.label}
                              </span>

                              {/* Sub-bubble count badge */}
                              {hasSubBubbles && (
                                <span className="text-[9px] text-gray-500 bg-[#21262d] px-1.5 py-0.5 rounded">
                                  {subBubbleDeps.length}
                                </span>
                              )}

                              {/* Status */}
                              <StatusIndicator
                                status={bubbleStatus}
                                size="small"
                              />
                            </button>

                            {/* Sub-bubbles - nested under parent when expanded */}
                            {hasSubBubbles &&
                              isExpanded &&
                              subBubbleTabs.length > 0 && (
                                <div className="relative ml-6 border-l border-[#30363d]/50">
                                  {subBubbleTabs.map((subTab) => {
                                    const subIsSelected = isTabSelected(
                                      subTab.type
                                    );
                                    const subItem =
                                      orderedItems[
                                        (
                                          subTab.type as {
                                            kind: 'item';
                                            index: number;
                                          }
                                        ).index
                                      ];
                                    const subBubbleStatus =
                                      subItem?.kind === 'group'
                                        ? getBubbleStatus(subItem.name)
                                        : 'pending';

                                    return (
                                      <button
                                        key={subTab.id}
                                        type="button"
                                        onClick={() =>
                                          setSelectedTab(subTab.type)
                                        }
                                        className={`relative w-full flex items-center gap-2 pl-4 pr-3 py-1 transition-all group ${
                                          subIsSelected
                                            ? 'bg-[#1f6feb]/10'
                                            : 'hover:bg-[#161b22]'
                                        }`}
                                      >
                                        {/* Connecting dot */}
                                        <div className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#30363d]/70" />

                                        {/* Sub-bubble icon */}
                                        <div className="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center opacity-75">
                                          {subTab.icon}
                                        </div>

                                        {/* Sub-bubble name */}
                                        <span
                                          className={`text-[9px] truncate flex-1 text-left ${
                                            subIsSelected
                                              ? 'text-[#58a6ff]'
                                              : 'text-gray-500 group-hover:text-gray-400'
                                          }`}
                                        >
                                          {subTab.label}
                                        </span>

                                        {/* Status */}
                                        <StatusIndicator
                                          status={subBubbleStatus}
                                          size="small"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            : // Fallback: Show flat list of bubbles (no step info available)
              allTabs
                .filter((t) => t.type.kind === 'item')
                .map((tab) => {
                  const isSelected = isTabSelected(tab.type);
                  const item =
                    orderedItems[
                      (tab.type as { kind: 'item'; index: number }).index
                    ];
                  const bubbleStatus =
                    item?.kind === 'group'
                      ? getBubbleStatus(item.name)
                      : 'pending';

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedTab(tab.type)}
                      className={`relative w-full flex items-center gap-2 px-3 py-2 transition-all group ${
                        isSelected ? 'bg-[#1f6feb]/10' : 'hover:bg-[#161b22]'
                      }`}
                    >
                      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {tab.icon}
                      </div>
                      <span
                        className={`text-[10px] truncate flex-1 text-left ${
                          isSelected
                            ? 'text-[#58a6ff]'
                            : 'text-gray-400 group-hover:text-gray-300'
                        }`}
                      >
                        {tab.label}
                      </span>
                      <StatusIndicator status={bubbleStatus} size="small" />
                    </button>
                  );
                })}

          {/* Workflow Check - Show when checking or check is complete */}
          {(isEvaluating || evaluationResult) && (
            <div className="mt-2 pt-2 border-t border-[#21262d]">
              <button
                type="button"
                onClick={() => setSelectedTab({ kind: 'evaluation' })}
                className={`relative w-full flex items-center gap-2 px-3 py-2 transition-all group ${
                  selectedTab.kind === 'evaluation'
                    ? 'bg-[#1f6feb]/10'
                    : 'hover:bg-[#161b22]'
                }`}
              >
                {/* Check icon/status */}
                <div className="flex-shrink-0">
                  {isEvaluating ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  ) : evaluationResult?.working ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-[11px] font-medium flex-1 text-left ${
                    selectedTab.kind === 'evaluation'
                      ? 'text-[#58a6ff]'
                      : 'text-gray-400 group-hover:text-gray-300'
                  }`}
                >
                  {isEvaluating ? 'Checking...' : 'Check Results'}
                </span>
                {/* Rating badge when complete */}
                {evaluationResult && !isEvaluating && (
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      evaluationResult.rating >= 7
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : evaluationResult.rating >= 4
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {evaluationResult.rating}/10
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Results Tab - Always at the end */}
          {!isRunning && (
            <div
              className={`${isEvaluating || evaluationResult ? '' : 'mt-2 pt-2 border-t border-[#21262d]'}`}
            >
              <button
                type="button"
                onClick={() => setSelectedTab({ kind: 'results' })}
                className={`relative w-full flex items-center gap-2 px-3 py-2 transition-all group ${
                  selectedTab.kind === 'results'
                    ? 'bg-[#1f6feb]/10'
                    : 'hover:bg-[#161b22]'
                }`}
              >
                <InformationCircleIcon className="w-4 h-4 text-blue-400" />
                <span
                  className={`text-[11px] font-medium ${
                    selectedTab.kind === 'results'
                      ? 'text-[#58a6ff]'
                      : 'text-gray-400'
                  }`}
                >
                  Results
                </span>
                {totalGlobalCount > 0 && (
                  <span className="text-[9px] text-gray-500">
                    ({totalGlobalCount})
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Event Details */}
      <div
        ref={contentScrollRef}
        className="flex-1 overflow-y-auto thin-scrollbar"
      >
        {(() => {
          // Handle Results tab - show ALL executions as unified cards + global events
          if (selectedTab.kind === 'results') {
            // Filter for all global events (info, warn, error, fatal, debug, trace)
            const globalEvents = events.filter((e) => {
              return (
                e.type === 'info' ||
                e.type === 'debug' ||
                e.type === 'trace' ||
                e.type === 'warn' ||
                e.type === 'error' ||
                e.type === 'fatal' ||
                e.type === 'execution_complete'
              );
            });

            if (globalEvents.length === 0 && pairedExecutions.length === 0) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-600">
                    <InformationCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No events</p>
                  </div>
                </div>
              );
            }

            // Separate execution_complete events and other events
            const executionCompleteEvents = globalEvents.filter(
              (e) => e.type === 'execution_complete'
            );

            const errorEvents = globalEvents
              .filter((e) => e.type === 'error' || e.type === 'fatal')
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            const warningEvents = globalEvents
              .filter((e) => e.type === 'warn')
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            const infoEvents = globalEvents
              .filter(
                (e) =>
                  e.type === 'info' || e.type === 'debug' || e.type === 'trace'
              )
              .sort(
                (a, b) =>
                  new Date(a.timestamp).getTime() -
                  new Date(b.timestamp).getTime()
              );

            // Extract execution summary from execution_complete event
            const completionEvent = executionCompleteEvents[0];
            const executionMessage = completionEvent
              ? formatEventMessage(completionEvent)
              : null;
            const hasErrors = errorEvents.length > 0;
            const hasWarnings = warningEvents.length > 0;

            return (
              <div className="flex flex-col h-full">
                {/* ═══════════════════════════════════════════════════════════════
                    SUMMARY HEADER - Prominent execution status bar
                    ═══════════════════════════════════════════════════════════════ */}
                {executionMessage && (
                  <div
                    className={`
                    flex-shrink-0 px-4 py-3 border-b
                    ${
                      hasErrors
                        ? 'bg-gradient-to-r from-red-950/40 via-red-950/20 to-transparent border-red-500/20'
                        : hasWarnings
                          ? 'bg-gradient-to-r from-yellow-950/30 via-yellow-950/10 to-transparent border-yellow-500/20'
                          : 'bg-gradient-to-r from-emerald-950/40 via-emerald-950/20 to-transparent border-emerald-500/20'
                    }
                  `}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div
                        className={`
                        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                        ${
                          hasErrors
                            ? 'bg-red-500/20 ring-1 ring-red-500/30'
                            : hasWarnings
                              ? 'bg-yellow-500/20 ring-1 ring-yellow-500/30'
                              : 'bg-emerald-500/20 ring-1 ring-emerald-500/30'
                        }
                      `}
                      >
                        {hasErrors ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : hasWarnings ? (
                          <svg
                            className="w-4 h-4 text-yellow-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>

                      {/* Summary Text */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`
                          text-sm font-medium font-mono tracking-tight
                          ${hasErrors ? 'text-red-300' : hasWarnings ? 'text-yellow-300' : 'text-emerald-300'}
                        `}
                        >
                          {executionMessage}
                        </p>
                      </div>

                      {/* Quick Stats Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {errorEvents.length > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded border border-red-500/30">
                            {errorEvents.length} error
                            {errorEvents.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {warningEvents.length > 0 && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30">
                            {warningEvents.length} warning
                            {warningEvents.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════
                    SCROLLABLE CONTENT
                    ═══════════════════════════════════════════════════════════════ */}
                <div className="flex-1 overflow-y-auto thin-scrollbar">
                  <div className="py-4 space-y-5">
                    {/* ─────────────────────────────────────────────────────────────
                        FINAL OUTPUT SECTION
                        ───────────────────────────────────────────────────────────── */}
                    {executionCompleteEvents.length > 0 && (
                      <div className="px-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-4 bg-blue-500 rounded-full" />
                          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Final Output
                          </h3>
                        </div>
                        <div className="space-y-3">
                          {executionCompleteEvents.map((event, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden"
                            >
                              {event.additionalData &&
                                Object.keys(event.additionalData).length >
                                  0 && (
                                  <pre className="json-output text-xs p-4 bg-[#0d1117]/50 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto max-h-[50vh]">
                                    <JsonRenderer
                                      data={event.additionalData}
                                      flowId={flowId}
                                      timestamp={event.timestamp}
                                    />
                                  </pre>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        ERRORS SECTION
                        ───────────────────────────────────────────────────────────── */}
                    {errorEvents.length > 0 && (
                      <div className="px-4">
                        {/* Fix with Pearl Banner */}
                        <div className="mb-4 p-3 bg-gradient-to-r from-orange-950/30 to-transparent border border-orange-500/20 rounded-lg">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-orange-400" />
                              </div>
                              <div>
                                <h4 className="text-xs font-medium text-gray-200">
                                  Need help fixing these errors?
                                </h4>
                                <p className="text-[10px] text-gray-500">
                                  Pearl can analyze and suggest fixes
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleFixWithPearl()}
                              disabled={pearl.isPending}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-all shadow-lg shadow-orange-900/20"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {pearl.isPending
                                ? 'Analyzing...'
                                : 'Fix with Pearl'}
                            </button>
                          </div>
                        </div>

                        {/* Errors Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-1 h-4 bg-red-500 rounded-full" />
                          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                            Errors
                          </h3>
                          <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            {errorEvents.length}
                          </span>
                        </div>

                        {/* Errors List */}
                        <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-950/10 p-2">
                          {errorEvents.map((event, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-2 rounded-md bg-[#0d1117]/60 border-l-2 border-red-500/60"
                            >
                              <div className="flex items-start gap-2">
                                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-300 break-words">
                                    {makeLinksClickable(
                                      formatEventMessage(event)
                                    )}
                                  </p>
                                  <span className="text-[9px] text-gray-600 font-mono">
                                    {formatTimestamp(event.timestamp)}
                                  </span>
                                </div>
                              </div>
                              {event.additionalData &&
                                Object.keys(event.additionalData).length >
                                  0 && (
                                  <pre className="json-output text-[11px] mt-2 p-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                    <JsonRenderer
                                      data={event.additionalData}
                                      flowId={flowId}
                                      timestamp={event.timestamp}
                                    />
                                  </pre>
                                )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        WARNINGS SECTION (Collapsible)
                        ───────────────────────────────────────────────────────────── */}
                    {warningEvents.length > 0 && (
                      <div className="px-4">
                        <details
                          className="group"
                          open={warningEvents.length <= 3}
                        >
                          <summary className="flex items-center gap-2 mb-2 cursor-pointer select-none hover:opacity-80 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-gray-500 transition-transform group-open:rotate-90" />
                            <div className="w-1 h-4 bg-yellow-500 rounded-full" />
                            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                              Warnings
                            </h3>
                            <span className="text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                              {warningEvents.length}
                            </span>
                          </summary>
                          <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-950/10 p-2 mt-2">
                            {warningEvents.map((event, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-2 rounded-md bg-[#0d1117]/60 border-l-2 border-yellow-500/60"
                              >
                                <div className="flex items-start gap-2">
                                  <svg
                                    className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                  </svg>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-300 break-words">
                                      {makeLinksClickable(
                                        formatEventMessage(event)
                                      )}
                                    </p>
                                    <span className="text-[9px] text-gray-600 font-mono">
                                      {formatTimestamp(event.timestamp)}
                                    </span>
                                  </div>
                                </div>
                                {event.additionalData &&
                                  Object.keys(event.additionalData).length >
                                    0 && (
                                    <pre className="json-output text-[11px] mt-2 p-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                      <JsonRenderer
                                        data={event.additionalData}
                                        flowId={flowId}
                                        timestamp={event.timestamp}
                                      />
                                    </pre>
                                  )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* ─────────────────────────────────────────────────────────────
                        DIAGNOSTIC LOGS (Collapsed by default)
                        ───────────────────────────────────────────────────────────── */}
                    {infoEvents.length > 0 && (
                      <div className="px-4">
                        <details className="group">
                          <summary className="flex items-center gap-2 mb-2 cursor-pointer select-none hover:opacity-80 transition-opacity">
                            <ChevronRight className="w-3 h-3 text-gray-500 transition-transform group-open:rotate-90" />
                            <div className="w-1 h-4 bg-gray-500 rounded-full" />
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                              Diagnostic Logs
                            </h3>
                            <span className="text-[10px] text-gray-500 bg-gray-500/10 px-1.5 py-0.5 rounded">
                              {infoEvents.length}
                            </span>
                          </summary>
                          <div className="space-y-1.5 rounded-lg border border-[#30363d] bg-[#161b22]/50 p-2 mt-2">
                            {infoEvents.map((event, idx) => (
                              <div
                                key={idx}
                                className="px-3 py-1.5 rounded bg-[#0d1117]/40"
                              >
                                <div className="flex items-start gap-2">
                                  <InformationCircleIcon className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-[11px] text-gray-400 break-words flex-1">
                                        {makeLinksClickable(
                                          formatEventMessage(event)
                                        )}
                                      </p>
                                      <span className="text-[9px] text-gray-600 font-mono whitespace-nowrap">
                                        {formatTimestamp(event.timestamp)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {event.additionalData &&
                                  Object.keys(event.additionalData).length >
                                    0 && (
                                    <pre className="json-output text-[10px] mt-1.5 p-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                      <JsonRenderer
                                        data={event.additionalData}
                                        flowId={flowId}
                                        timestamp={event.timestamp}
                                      />
                                    </pre>
                                  )}
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          // Handle Check Results tab
          if (selectedTab.kind === 'evaluation') {
            // Show loading state while checking
            if (isEvaluating) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-400 animate-spin" />
                    <p className="text-lg text-gray-300 mb-2">
                      Checking your workflow
                    </p>
                    <p className="text-sm text-gray-500">
                      This one-time check helps ensure smooth execution
                    </p>
                  </div>
                </div>
              );
            }

            // Show check results
            if (evaluationResult) {
              const getRatingColor = (rating: number) => {
                if (rating >= 7)
                  return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
                if (rating >= 4)
                  return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
                return 'text-red-400 bg-red-500/20 border-red-500/30';
              };

              const getRatingLabel = (rating: number) => {
                if (rating >= 9) return 'Excellent';
                if (rating >= 7) return 'Good';
                if (rating >= 5) return 'Fair';
                if (rating >= 3) return 'Poor';
                return 'Critical';
              };

              return (
                <div className="p-4 space-y-4">
                  {/* Status Header */}
                  <div
                    className={`p-4 rounded-lg border ${
                      evaluationResult.working
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {evaluationResult.working ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-400" />
                      )}
                      <div>
                        <h3
                          className={`text-lg font-semibold ${
                            evaluationResult.working
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {evaluationResult.working
                            ? 'Workflow Check Passed'
                            : 'Issues Detected'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {evaluationResult.working
                            ? 'The workflow executed as expected with no critical issues.'
                            : 'The check found problems that may need attention.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quality Score */}
                  <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">
                      Quality Score
                    </h4>
                    <div className="flex items-center gap-4">
                      <div
                        className={`text-4xl font-bold px-4 py-2 rounded-lg border ${getRatingColor(evaluationResult.rating)}`}
                      >
                        {evaluationResult.rating}
                        <span className="text-lg opacity-60">/10</span>
                      </div>
                      <div>
                        <p
                          className={`text-lg font-medium ${getRatingColor(evaluationResult.rating).split(' ')[0]}`}
                        >
                          {getRatingLabel(evaluationResult.rating)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {evaluationResult.rating >= 7
                            ? 'Working well with minor or no issues'
                            : evaluationResult.rating >= 4
                              ? 'Partially functional, some problems detected'
                              : 'Significant issues need attention'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {evaluationResult.summary && (
                    <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">
                        {evaluationResult.working ? 'Summary' : 'Issue Details'}
                      </h4>
                      <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                        {evaluationResult.summary}
                      </p>
                    </div>
                  )}

                  {/* Fix with Pearl CTA - Only show for workflow issues (not setup or input) */}
                  {!evaluationResult.working &&
                    evaluationResult.issueType === 'workflow' && (
                      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-200 mb-1">
                              Need help fixing these issues?
                            </h4>
                            <p className="text-xs text-gray-400">
                              Pearl can analyze the results and suggest fixes
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleFixWithPearl(evaluationResult.summary)
                            }
                            disabled={pearl.isPending}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                          >
                            <Sparkles className="w-4 h-4" />
                            {pearl.isPending
                              ? 'Analyzing...'
                              : 'Fix with Pearl'}
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Help text for setup/input issues */}
                  {!evaluationResult.working &&
                    evaluationResult.issueType !== 'workflow' && (
                      <div className="bg-[#161b22] rounded-lg border border-[#30363d] p-4">
                        <p className="text-sm text-gray-400">
                          {evaluationResult.issueType === 'setup'
                            ? 'This is a setup issue. Please update your settings or credentials to resolve it.'
                            : 'This is an input issue. Please provide valid input data and try again.'}
                        </p>
                      </div>
                    )}
                </div>
              );
            }

            // No check result yet
            return (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-600">
                  <Circle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No check results available</p>
                </div>
              </div>
            );
          }

          // Handle item-based tabs (bubble groups and global events)
          if (selectedTab.kind === 'item') {
            const item = orderedItems[selectedTab.index];
            if (!item) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-600">
                    <PlayIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No event selected</p>
                  </div>
                </div>
              );
            }

            if (item.kind === 'global') {
              const event = item.event;
              return (
                <div className="py-2">
                  <div
                    className={`px-3 py-2 rounded border-l-2 ${
                      event.lineNumber === currentLine
                        ? 'border-yellow-500'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getEventIcon(event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <p className="text-sm text-gray-300 break-words flex-1 min-w-0">
                            {makeLinksClickable(formatEventMessage(event))}
                          </p>
                          <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {event.additionalData &&
                      Object.keys(event.additionalData).length > 0 && (
                        <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                          <JsonRenderer
                            data={event.additionalData}
                            flowId={flowId}
                            timestamp={event.timestamp}
                          />
                        </pre>
                      )}
                  </div>
                </div>
              );
            } else {
              // Bubble group - show unified input/output view
              const varId = item.name;
              const evs = item.events;
              const selectedIndex = Math.min(
                selectedEventIndexByVariableId[varId] ?? evs.length - 1,
                evs.length - 1
              );
              const selectedEvent = evs[selectedIndex];

              // Find the paired execution for this bubble
              const pairedExecution = pairedExecutions.find(
                (pe) => pe.variableId === varId
              );

              // Check if this bubble has any errors
              const hasErrorInBubble = evs.some((e) => {
                // Check for error/fatal events
                if (e.type === 'error' || e.type === 'fatal') return true;
                // Check for bubble_execution_complete with result.success === false
                if (e.type === 'bubble_execution_complete') {
                  const result = e.additionalData?.result as
                    | { success?: boolean }
                    | undefined;
                  return result && result.success === false;
                }
                return false;
              });

              return (
                <div className="flex flex-col h-full">
                  {/* View Mode Toggle Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#21262d]">
                    <div className="flex items-center gap-3">
                      <Workflow className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-400 font-medium">
                        Execution Details
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-[#0d1117] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('unified')}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          viewMode === 'unified'
                            ? 'bg-[#21262d] text-gray-200'
                            : 'text-gray-500 hover:text-gray-400'
                        }`}
                      >
                        Unified
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('timeline')}
                        className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                          viewMode === 'timeline'
                            ? 'bg-[#21262d] text-gray-200'
                            : 'text-gray-500 hover:text-gray-400'
                        }`}
                      >
                        Timeline
                      </button>
                    </div>
                  </div>

                  {/* Fix with Pearl Banner - Show if bubble has errors */}
                  {hasErrorInBubble && (
                    <div className="px-4 pt-3 pb-2">
                      <div className="p-3 bg-[#161b22] border border-[#30363d] rounded-lg">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-gray-200 mb-1">
                              Need help fixing this error?
                            </h4>
                            <p className="text-[10px] text-gray-400">
                              Please wait until the flow finishes executing
                              before fixing!
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleFixWithPearl()}
                            disabled={pearl.isPending}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-600/50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            {pearl.isPending
                              ? 'Analyzing...'
                              : 'Fix with Pearl'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UNIFIED VIEW - Shows input/output together */}
                  {viewMode === 'unified' && pairedExecution ? (
                    <div className="flex-1 p-4 overflow-y-auto thin-scrollbar">
                      <BubbleExecutionCard
                        key={pairedExecution.variableId}
                        execution={pairedExecution}
                        renderJson={JsonRenderer}
                        flowId={flowId}
                        activeBrowserSession={activeBrowserSession}
                      />
                    </div>
                  ) : viewMode === 'unified' && !pairedExecution ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-gray-600">
                        <Workflow className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Loading execution data...</p>
                      </div>
                    </div>
                  ) : (
                    /* TIMELINE VIEW - Original slider-based view */
                    <>
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0d1117] border-b border-[#21262d]">
                        <span className="text-xs text-gray-500 font-medium">
                          Event
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, evs.length - 1)}
                          value={selectedIndex}
                          onChange={(e) =>
                            setSelectedEventIndex(varId, Number(e.target.value))
                          }
                          className="flex-1 max-w-xs"
                          aria-label={`Select output for variable ${varId}`}
                        />
                        <span className="text-xs text-gray-500 font-mono tabular-nums">
                          {selectedIndex + 1}/{evs.length}
                        </span>
                      </div>

                      {selectedEvent ? (
                        <div className="flex-1 py-2 overflow-y-auto">
                          <div
                            className={`px-3 py-2 rounded border-l-2 ${
                              selectedEvent.lineNumber === currentLine
                                ? 'border-yellow-500'
                                : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getEventIcon(selectedEvent)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 min-w-0">
                                  <p className="text-sm text-gray-300 break-words flex-1 min-w-0">
                                    {makeLinksClickable(
                                      formatEventMessage(selectedEvent)
                                    )}
                                  </p>
                                  <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                                    {formatTimestamp(selectedEvent.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {selectedEvent.additionalData &&
                              Object.keys(selectedEvent.additionalData).length >
                                0 && (
                                <pre className="json-output text-xs mt-2 bg-[#0d1117] border border-[#21262d] rounded whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                  <JsonRenderer
                                    data={selectedEvent.additionalData}
                                    flowId={flowId}
                                    timestamp={selectedEvent.timestamp}
                                  />
                                </pre>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-sm text-gray-600">
                            No event selected
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }
          }

          // Fallback - no tab selected
          return null;
        })()}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}
