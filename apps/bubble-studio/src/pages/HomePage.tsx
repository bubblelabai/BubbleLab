import React from 'react';
import { Trash2 } from 'lucide-react';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { TokenUsageDisplay } from '../components/TokenUsageDisplay';
import { SignedIn } from '../components/AuthComponents';
import { findLogoForBubble } from '../lib/integrations';

export interface HomePageProps {
  onFlowSelect: (flowId: number) => void;
  onFlowDelete: (flowId: number, event: React.MouseEvent) => void;
  onNavigateToDashboard: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onFlowSelect,
  onFlowDelete,
  onNavigateToDashboard,
}) => {
  const { data: bubbleFlowListResponse, loading } = useBubbleFlowList();

  const flows = (bubbleFlowListResponse?.bubbleFlows || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Calculate total executions across all flows
  const totalExecutions = flows.reduce(
    (sum, flow) => sum + (flow.executionCount || 0),
    0
  );

  const handleDeleteClick = (flowId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onFlowDelete(flowId, event);
  };

  // Show loading state if data hasn't loaded yet OR if actively loading
  const isLoading = loading || bubbleFlowListResponse === undefined;

  return (
    <div className="h-full bg-[#0a0a0a] overflow-auto">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-white">Overview</h1>
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <span className="text-lg leading-none">+</span>
              <span>New Flow</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="flex gap-4 mb-2 flex-wrap">
            {/* Flows Count Card */}
            <div className="w-64">
              <div className="flex items-center rounded-lg bg-[#0a0a0a] border border-[#30363d] p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-1">Total Flows</div>
                  <div className="text-lg font-semibold text-white">
                    {isLoading ? '...' : flows.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Executions Card */}
            <div className="w-64">
              <div className="flex items-center rounded-lg bg-[#0a0a0a] border border-[#30363d] p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-1">
                    Total Executions
                  </div>
                  <div className="text-lg font-semibold text-white">
                    {isLoading ? '...' : totalExecutions.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Token Usage Display */}
            <SignedIn>
              <div className="w-64">
                <TokenUsageDisplay isOpen={true} />
              </div>
            </SignedIn>
          </div>
        </div>

        {/* Flows Section */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">My Bubble Flows</h2>
        </div>

        {/* Grid of Flows */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mb-6"></div>
            <p className="text-gray-400 text-sm">Loading your flows...</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mb-6">
              <span className="text-4xl">💫</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">
              No flows yet
            </h2>
            <p className="text-gray-500 text-sm">
              Create your first flow to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow) => {
              const isRun = false; // TODO: Determine run status from server data
              return (
                <div
                  key={flow.id}
                  className="group relative rounded-lg border border-[#30363d] bg-[#161b22] hover:bg-[#21262d] hover:border-purple-600/40 transition-all duration-200 cursor-pointer"
                  onClick={() => onFlowSelect(flow.id)}
                >
                  {/* Card Content */}
                  <div className="p-5">
                    {/* Bubble Logos */}
                    {flow.bubbles && flow.bubbles.length > 0 && (
                      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                        {flow.bubbles
                          .map((bubble) => {
                            const logo = findLogoForBubble({
                              bubbleName: bubble.bubbleName,
                              className: bubble.className,
                            });
                            return logo ? { ...bubble, logo } : null;
                          })
                          .filter(
                            (item, index, self) =>
                              item &&
                              self.findIndex(
                                (t) => t && t.logo.file === item.logo.file
                              ) === index
                          )
                          .map((item, idx) =>
                            item ? (
                              <img
                                key={idx}
                                src={item.logo.file}
                                alt={item.logo.name}
                                className="h-4 w-4 opacity-70"
                                title={item.logo.name}
                              />
                            ) : null
                          )}
                      </div>
                    )}

                    {/* Flow Name */}
                    <h3 className="text-base font-semibold text-gray-100 mb-2 truncate">
                      {flow.name || 'Untitled Flow'}
                      {isRun && (
                        <span className="ml-1 text-xs text-gray-500">
                          (run)
                        </span>
                      )}
                    </h3>

                    {/* Execution Count */}
                    <div className="text-xs text-gray-400 mb-2">
                      {flow.executionCount || 0}{' '}
                      {flow.executionCount === 1 ? 'execution' : 'executions'}
                    </div>

                    {/* Created Date */}
                    <div className="text-xs text-gray-500">
                      {new Date(flow.createdAt)
                        .toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        .replace(/, (\d{4})/g, ' $1')}
                    </div>
                  </div>

                  {/* Delete Button - appears on hover */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteClick(flow.id, e)}
                    className="absolute top-3 right-3 p-2 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-all duration-200"
                    aria-label="Delete flow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Hover Effect Indicator */}
                  <div className="absolute inset-0 rounded-lg ring-1 ring-purple-600/0 group-hover:ring-purple-600/30 transition-all duration-200 pointer-events-none" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
