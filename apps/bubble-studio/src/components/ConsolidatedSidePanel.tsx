import { Code, Activity, Clock } from 'lucide-react';
import { PearlChat } from './ai/PearlChat';
import { MonacoEditor } from './MonacoEditor';
import LiveOutput from './execution_logs/LiveOutput';
import { ExecutionHistory } from './execution_logs/ExecutionHistory';
import { useExecutionStore } from '../stores/executionStore';
import { useEditor } from '../hooks/useEditor';
import { useUIStore } from '../stores/uiStore';
import { useExecutionHistory } from '../hooks/useExecutionHistory';
import { shallow } from 'zustand/shallow';

export function ConsolidatedSidePanel() {
  const flowId = useUIStore((state) => state.selectedFlowId);
  const activeTab = useUIStore((state) => state.consolidatedPanelTab);
  const setConsolidatedPanelTab = useUIStore(
    (state) => state.setConsolidatedPanelTab
  );

  // Use selector to only subscribe to specific fields and prevent unnecessary re-renders
  // This prevents FlowVisualizer from re-rendering when tabs switch
  const executionState = useExecutionStore(
    flowId ?? 0,
    (state) => ({
      isRunning: state.isRunning,
      events: state.events,
      currentLine: state.currentLine,
      getExecutionStats: state.getExecutionStats,
    }),
    shallow
  );
  const { editor } = useEditor();
  const { data: executionHistory } = useExecutionHistory(flowId, { limit: 10 });

  const tabs = [
    {
      id: 'pearl' as const,
      label: 'Pearl',
      icon: Code, // Placeholder, not used for Pearl tab
      badge: null,
    },
    {
      id: 'code' as const,
      label: 'Code',
      icon: Code,
      badge: editor.getCode().split('\n').length,
    },
    {
      id: 'output' as const,
      label: 'Console',
      icon: Activity,
      badge: executionState.isRunning ? 'running' : null,
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: Clock,
      badge: executionHistory?.length ?? null,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] border-l border-[#30363d]">
      {/* Tab Bar */}
      <div className="flex border-b border-[#30363d] bg-[#0f1115]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isPearl = tab.id === 'pearl';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setConsolidatedPanelTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                isActive
                  ? 'border-white text-white bg-[#1a1a1a]'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#161b22]'
              }`}
            >
              {isPearl ? (
                <img src="/pearl.png" alt="Pearl" className="w-4 h-4" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    tab.badge === 'running'
                      ? 'bg-gray-700 text-white animate-pulse'
                      : 'bg-gray-700/50 text-gray-400'
                  }`}
                >
                  {tab.badge === 'running' ? '●' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content - Monaco is always mounted for useEditor to work */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* Pearl Chat Tab - Only render when active */}
        <div className="absolute inset-0">
          <PearlChat />
        </div>

        {/* Code Editor Tab - Always mounted for useEditor to work */}
        <div
          className={`absolute inset-0 ${activeTab === 'code' ? 'block' : 'hidden'}`}
        >
          <MonacoEditor />
        </div>

        {/* Live Output Tab - Only render when active */}
        {activeTab === 'output' && (
          <div className="absolute inset-0">
            {flowId ? (
              <LiveOutput
                flowId={flowId}
                events={executionState.events}
                currentLine={executionState.currentLine}
                executionStats={executionState.getExecutionStats()}
                isRunning={executionState.isRunning}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No flow selected</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Select a flow to view execution output
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab - Only render when active */}
        {activeTab === 'history' && (
          <div className="absolute inset-0">
            <ExecutionHistory flowId={flowId} />
          </div>
        )}
      </div>
    </div>
  );
}
