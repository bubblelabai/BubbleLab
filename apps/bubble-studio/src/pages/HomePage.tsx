import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  MoreHorizontal,
  Edit2,
  Check,
  X,
  Search,
  Plus,
  Workflow,
} from 'lucide-react';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { MonthlyUsageBar } from '../components/MonthlyUsageBar';
import { SignedIn } from '../components/AuthComponents';
import { findLogoForBubble } from '../lib/integrations';
import { useRenameFlow } from '../hooks/useRenameFlow';
import { CronToggle } from '../components/CronToggle';
import { WebhookToggle } from '../components/WebhookToggle';
import { useSubscription } from '../hooks/useSubscription';

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
  const { data: subscription } = useSubscription();
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingFlowId, setRenamingFlowId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  const allFlows = (bubbleFlowListResponse?.bubbleFlows || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Find the flow being renamed to get its current name
  const renamingFlow = allFlows.find((f) => f.id === renamingFlowId);

  // Use the rename hook for the currently renaming flow
  const {
    newFlowName,
    setNewFlowName,
    inputRef,
    submitRename,
    cancelRename,
    handleKeyDown,
  } = useRenameFlow({
    flowId: renamingFlowId ?? undefined,
    currentName: renamingFlow?.name,
  });

  // Filter flows based on search query
  const flows = allFlows.filter((flow) => {
    if (!searchQuery.trim()) return true;
    return flow.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleDeleteClick = (flowId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuId(null);
    onFlowDelete(flowId, event);
  };

  const handleMenuToggle = (flowId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuId(openMenuId === flowId ? null : flowId);
  };

  const handleRenameClick = (
    flowId: number,
    currentName: string,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setRenamingFlowId(flowId);
    setOpenMenuId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show loading state if data hasn't loaded yet OR if actively loading
  const isLoading = loading || bubbleFlowListResponse === undefined;

  return (
    <div className="h-full bg-[#0a0a0a] overflow-auto">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Dashboard Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-gray-400 mt-2 text-lg">
            Track your usage and limits
          </p>
        </div>

        {/* Monthly Usage Bar */}
        <SignedIn>
          {subscription && (
            <div className="mb-16">
              <MonthlyUsageBar subscription={subscription} isOpen={true} />
            </div>
          )}
        </SignedIn>

        {/* My Flows Section Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold text-white tracking-tight">
              My Flows
            </h2>
            <p className="text-gray-400 mt-2 text-lg">
              Manage and monitor your automation workflows
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold">New Flow</span>
          </button>
        </div>

        {/* Search Bar - Full Width */}
        <div className="relative w-full mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flows..."
            className="w-full pl-12 pr-4 py-3 bg-[#1a1a1a] border border-[#30363d] text-gray-100 text-base rounded-xl focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 placeholder-gray-600 transition-all duration-200"
          />
        </div>

        {/* Grid of Flows */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-6"></div>
            <p className="text-gray-500 font-medium">Loading your flows...</p>
          </div>
        ) : flows.length === 0 ? (
          searchQuery ? (
            <div className="text-center py-12 border border-[#30363d] border-dashed rounded-2xl bg-[#1a1a1a]/30">
              <div className="bg-[#1a1a1a] p-4 rounded-full inline-flex mb-4 border border-[#30363d]">
                <Search className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No flows found
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                We couldn't find any flows matching "{searchQuery}". Try
                adjusting your search terms.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 text-sm font-medium rounded-full transition-all duration-200 shadow-lg hover:scale-105"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="text-center py-16 border border-[#30363d] border-dashed rounded-2xl bg-[#1a1a1a]/30">
              <div className="bg-[#1a1a1a] p-4 rounded-full inline-flex mb-4 border border-[#30363d]">
                <Workflow className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No flows yet
              </h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Create your first flow to get started with automation.
              </p>
              <button
                onClick={onNavigateToDashboard}
                className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 text-sm font-medium rounded-full transition-all duration-200 shadow-lg hover:scale-105 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="font-bold">Create your first flow</span>
              </button>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flows.map((flow) => {
              const isRun = false; // TODO: Determine run status from server data
              return (
                <div
                  key={flow.id}
                  className="group relative rounded-xl border border-[#30363d] bg-[#1a1a1a] hover:bg-[#1c2128] hover:border-gray-500 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl overflow-hidden"
                  onClick={() => onFlowSelect(flow.id)}
                >
                  {/* Card Content */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      {/* Bubble Logos */}
                      <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
                        {flow.bubbles && flow.bubbles.length > 0 ? (
                          flow.bubbles
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
                                <div
                                  key={idx}
                                  className="bg-[#0d1117] p-1.5 rounded-md border border-[#30363d]"
                                >
                                  <img
                                    src={item.logo.file}
                                    alt={item.logo.name}
                                    className="h-4 w-4 object-contain opacity-90"
                                    title={item.logo.name}
                                  />
                                </div>
                              ) : null
                            )
                        ) : (
                          <div className="bg-[#0d1117] p-1.5 rounded-md border border-[#30363d]">
                            <div className="h-4 w-4 bg-gray-700 rounded-full opacity-50" />
                          </div>
                        )}
                      </div>

                      {/* Menu Button */}
                      <div
                        className="relative"
                        ref={openMenuId === flow.id ? menuRef : null}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleMenuToggle(flow.id, e)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-[#30363d] transition-colors"
                          aria-label="Flow options"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === flow.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-2xl bg-[#1c2128] border border-[#30363d] overflow-hidden z-20 animate-fade-in-up">
                            <button
                              type="button"
                              onClick={(e) =>
                                handleRenameClick(flow.id, flow.name, e)
                              }
                              className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#30363d] hover:text-white flex items-center gap-3 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              Rename Flow
                            </button>
                            <div className="h-px bg-[#30363d] mx-2" />
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(flow.id, e)}
                              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-3 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Flow
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Flow Name */}
                    {renamingFlowId === flow.id ? (
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          title="Rename Flow"
                          ref={inputRef}
                          type="text"
                          value={newFlowName}
                          onChange={(e) => setNewFlowName(e.target.value)}
                          onKeyDown={async (e) => {
                            e.stopPropagation();
                            const success = await handleKeyDown(e);
                            if (success || e.key === 'Escape') {
                              setRenamingFlowId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-3 py-1.5 text-lg font-semibold bg-[#0d1117] text-white border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const success = await submitRename();
                            if (success) {
                              setRenamingFlowId(null);
                            }
                          }}
                          className="p-2 rounded-lg bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-900"
                          title="Confirm (Enter)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelRename();
                            setRenamingFlowId(null);
                          }}
                          className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                          title="Cancel (Esc)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-lg font-bold text-white mb-2 truncate pr-4 group-hover:text-blue-400 transition-colors">
                        {flow.name || 'Untitled Flow'}
                        {isRun && (
                          <span className="ml-2 text-xs font-normal text-gray-500 bg-[#30363d] px-2 py-0.5 rounded-full">
                            Running
                          </span>
                        )}
                      </h3>
                    )}

                    {/* Execution Count */}
                    <div className="text-sm text-gray-500 mb-4 font-medium">
                      {flow.executionCount || 0}{' '}
                      {flow.executionCount === 1 ? 'execution' : 'executions'}
                    </div>

                    {/* Footer: Date and Toggles */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#30363d]/50">
                      <div className="text-xs text-gray-500 font-medium">
                        {new Date(flow.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
                      </div>

                      {/* Cron Toggle or Webhook Toggle */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {flow.cronSchedule ? (
                          <CronToggle
                            flowId={flow.id}
                            compact={true}
                            syncInputsWithFlow={false}
                            showScheduleText={false}
                          />
                        ) : (
                          <WebhookToggle
                            flowId={flow.id}
                            compact={true}
                            showCopyButton={true}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
