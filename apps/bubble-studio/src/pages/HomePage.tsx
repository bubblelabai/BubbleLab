import React, { useState, useRef, useEffect } from 'react';
import {
  Trash2,
  MoreHorizontal,
  Edit2,
  Check,
  X,
  Search,
  Plus,
  Copy,
} from 'lucide-react';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { MonthlyUsageBar } from '../components/MonthlyUsageBar';
import { SignedIn } from '../components/AuthComponents';
import { findLogoForBubble } from '../lib/integrations';
import { useRenameFlow } from '../hooks/useRenameFlow';
import { useDuplicateFlow } from '../hooks/useDuplicateFlow';
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
  const [duplicatingFlowId, setDuplicatingFlowId] = useState<number | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Duplicate flow hook
  const { duplicateFlow, isLoading: isDuplicating } = useDuplicateFlow({
    flowId: duplicatingFlowId,
    onSuccess: (newFlowId) => {
      console.log('[HomePage] Flow duplicated successfully:', newFlowId);
      setDuplicatingFlowId(null);
      setOpenMenuId(null);
      // Stay on the flows page - the new flow will appear at the top of the list
    },
    onError: (error) => {
      console.error('[HomePage] Failed to duplicate flow:', error);
      setDuplicatingFlowId(null);
      setOpenMenuId(null);
      // TODO: Show error toast/notification
    },
  });

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

  const handleDuplicateClick = async (
    flowId: number,
    event: React.MouseEvent
  ) => {
    event.stopPropagation();
    setDuplicatingFlowId(flowId);
    setOpenMenuId(null);
    // The duplication will be handled by the effect below
  };

  // Effect to trigger duplication when duplicatingFlowId is set
  useEffect(() => {
    if (duplicatingFlowId && !isDuplicating) {
      void duplicateFlow();
    }
  }, [duplicatingFlowId, isDuplicating, duplicateFlow]);

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
        {/* Header */}
        <div className="mb-10">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white font-sans">
              Dashboard
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-sans">
              Track your usage and limits
            </p>
          </div>

          {/* Monthly Usage Bar */}
          <SignedIn>
            {subscription && (
              <div className="mb-4">
                <MonthlyUsageBar subscription={subscription} isOpen={true} />
              </div>
            )}
          </SignedIn>
        </div>

        {/* Flows Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white font-sans">
                My Bubble Flows
              </h2>
              <p className="text-gray-400 mt-1 text-sm font-sans">
                Manage and monitor your workflows
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="px-5 py-2.5 bg-white text-black hover:bg-gray-200 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg hover:scale-105"
            >
              <Plus className="h-5 w-5" />
              <span className="font-bold font-sans">New Flow</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search flows..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#1a1a1a] border border-white/5 text-gray-100 text-sm rounded-lg focus:outline-none focus:border-white/10 placeholder-gray-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Grid of Flows */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 border-4 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mb-6"></div>
            <p className="text-gray-400 text-sm">Loading your flows...</p>
          </div>
        ) : flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            {searchQuery ? (
              <>
                <h2 className="text-xl font-semibold text-gray-300 mb-2">
                  No flows found
                </h2>
                <p className="text-gray-500 text-sm mb-4">
                  No flows match "{searchQuery}"
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-300 mb-2">
                  No flows yet
                </h2>
                <p className="text-gray-500 text-sm">
                  Create your first flow to get started
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow) => {
              const isRun = false; // TODO: Determine run status from server data
              return (
                <div
                  key={flow.id}
                  className="group relative rounded-lg border border-white/5 bg-[#1a1a1a] hover:bg-[#202020] hover:border-white/10 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
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
                    {renamingFlowId === flow.id ? (
                      <div className="flex items-center gap-2 mb-2">
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
                          className="flex-1 px-2 py-1 text-base font-semibold bg-[#0a0a0a] text-gray-100 border border-[#30363d] rounded focus:outline-none focus:border-gray-600"
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
                          className="p-1 rounded hover:bg-gray-700/50 text-green-400 hover:text-green-300"
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
                          className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
                          title="Cancel (Esc)"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-base font-semibold text-gray-100 mb-2 truncate">
                        {flow.name || 'Untitled Flow'}
                        {isRun && (
                          <span className="ml-1 text-xs text-gray-500">
                            (run)
                          </span>
                        )}
                      </h3>
                    )}

                    {/* Execution Count */}
                    <div className="text-xs text-gray-400 mb-2">
                      {flow.executionCount || 0}{' '}
                      {flow.executionCount === 1 ? 'execution' : 'executions'}
                    </div>

                    {/* Divider and Date/Toggle Row */}
                    <div className="pt-2 mt-2 border-t border-white/5">
                      <div
                        className="flex items-center justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Cron Toggle or Webhook Toggle - mutually exclusive */}
                        <div>
                          {flow.cronSchedule ? (
                            <CronToggle
                              flowId={flow.id}
                              compact={true}
                              syncInputsWithFlow={false}
                              showScheduleText={true}
                            />
                          ) : (
                            <WebhookToggle
                              flowId={flow.id}
                              compact={true}
                              showCopyButton={true}
                            />
                          )}
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
                    </div>
                  </div>

                  {/* Menu Button - always visible */}
                  <div
                    className="absolute top-3 right-3"
                    ref={openMenuId === flow.id ? menuRef : null}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleMenuToggle(flow.id, e)}
                      className="p-2 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-all duration-200"
                      aria-label="Flow options"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === flow.id && (
                      <div className="absolute right-0 mt-1 w-40 rounded-md shadow-lg bg-[#21262d] border border-[#30363d] overflow-hidden z-10">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleRenameClick(flow.id, flow.name, e)
                          }
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-purple-600/20 hover:text-purple-400 flex items-center gap-2 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Rename Flow
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateClick(flow.id, e)}
                          disabled={
                            isDuplicating && duplicatingFlowId === flow.id
                          }
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-blue-600/20 hover:text-blue-400 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Copy className="w-4 h-4" />
                          {isDuplicating && duplicatingFlowId === flow.id
                            ? 'Duplicating...'
                            : 'Duplicate Flow'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(flow.id, e)}
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-red-600/20 hover:text-red-400 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Flow
                        </button>
                      </div>
                    )}
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
