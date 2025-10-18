import React from 'react';
import { Trash2 } from 'lucide-react';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { TokenUsageDisplay } from '../components/TokenUsageDisplay';
import { SignedIn } from '../components/AuthComponents';

export interface HomePageProps {
  onFlowSelect: (flowId: number) => void;
  onFlowDelete: (flowId: number, event: React.MouseEvent) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onFlowSelect,
  onFlowDelete,
}) => {
  const { data: bubbleFlowListResponse, loading } = useBubbleFlowList();

  const flows = (bubbleFlowListResponse?.bubbleFlows || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
          <h1 className="text-3xl font-bold text-white mb-2">Overview</h1>
          <p className="text-gray-400 text-sm mb-4">
            {isLoading
              ? 'Loading...'
              : `${flows.length} ${flows.length === 1 ? 'flow' : 'flows'} total`}
          </p>

          {/* Token Usage Display */}
          <SignedIn>
            <div className="w-64">
              <TokenUsageDisplay isOpen={true} />
            </div>
          </SignedIn>
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
                    <div className="text-xs text-gray-400 mb-1">
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
