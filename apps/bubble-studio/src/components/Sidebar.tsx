import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { Plus, KeyRound, PanelLeft, Trash2, User } from 'lucide-react';
import { useBubbleFlowList } from '../hooks/useBubbleFlowList';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { useUser } from '../hooks/useUser';
import { SignedIn } from './AuthComponents';
import { DISABLE_AUTH } from '../env';

export interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onPageChange: (
    page: 'prompt' | 'ide' | 'credentials' | 'flow-summary'
  ) => void;
  selectedFlowId: number | null;
  onFlowSelect: (flowId: number) => void;
  onFlowDelete: (flowId: number, event: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onPageChange,
  selectedFlowId,
  onFlowSelect,
  onFlowDelete,
}) => {
  const { user } = useUser();
  const { data: bubbleFlowListResponse } = useBubbleFlowList();

  const handleDeleteClick = (flowId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onFlowDelete(flowId, event);
  };

  const flows = (bubbleFlowListResponse?.bubbleFlows || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 bg-[#0f1115] border-r border-[#30363d] transition-all duration-200 ${
        isOpen ? 'w-56' : 'w-14'
      }`}
    >
      <div className="h-full flex flex-col pt-2 items-stretch gap-2">
        {/* Sidebar toggle (favicon) */}
        <button
          type="button"
          onClick={onToggle}
          className="relative group flex items-center h-12 rounded-lg hover:bg-[#21262d] focus:outline-none"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <span className="w-14 flex-none flex justify-center p-2">
            {isOpen ? (
              <img
                src="/favicon.ico"
                alt="Bubble Lab"
                className="w-8 h-8 rounded-lg"
              />
            ) : (
              <div className="relative w-8 h-8">
                <img
                  src="/favicon.ico"
                  alt="Bubble Lab"
                  className="w-8 h-8 rounded-lg transition-opacity group-hover:opacity-0"
                />
                <PanelLeft className="w-6 h-6 text-gray-200 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </span>
          {/* Bubble Lab text when expanded */}
          {isOpen && (
            <span className="text-lg font-semibold text-white">
              Bubble Studio
            </span>
          )}
          {/* Tooltip when collapsed */}
          {!isOpen && (
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
              Open Sidebar
            </span>
          )}
        </button>

        {/* New Flow button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <button
              type="button"
              onClick={() => onPageChange('prompt')}
              className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="New Flow"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <Plus className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                New Flow
              </span>
            </button>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                New Flow
              </span>
            )}
          </div>
        </div>

        {/* Credentials button (icon only, shows label on hover) */}
        <div className="mt-2">
          <div className="relative group">
            <button
              type="button"
              onClick={() => onPageChange('credentials')}
              className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Credentials"
            >
              {/* Fixed icon column */}
              <span className="w-14 flex-none flex justify-center p-2">
                <KeyRound className="w-5 h-5" />
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                Credentials
              </span>
            </button>
            {/* Tooltip when collapsed */}
            {!isOpen && (
              <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded bg-[#0f1115] px-2 py-1 text-xs text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                Credentials
              </span>
            )}
          </div>
        </div>

        {/* Flows list (shown when sidebar is open) */}
        {isOpen ? (
          <div className="mt-2 flex-1 min-h-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="px-3 py-2">
                <h3 className="text-xs uppercase tracking-wide text-gray-500">
                  Flows
                </h3>
              </div>
              <div className="flex-1 overflow-auto thin-scrollbar px-2 pb-2">
                {flows.length === 0 ? (
                  <div className="text-xs text-gray-500 px-3 py-2">
                    No flows yet
                  </div>
                ) : (
                  <div className="space-y-1">
                    {flows.map((flow) => {
                      const isRun = false; // TODO: Determine run status from server data
                      return (
                        <div
                          key={flow.id}
                          className={`group relative rounded-md border transition-colors ${
                            selectedFlowId === flow.id
                              ? 'bg-purple-600/20 text-gray-100 border-purple-600/40'
                              : 'hover:bg-[#21262d] text-gray-300 border-transparent'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onFlowSelect(flow.id)}
                            className="w-full text-left px-3 py-2 pr-8"
                          >
                            <div className="text-sm truncate">
                              {flow.name || 'Untitled Flow'}
                              {isRun && (
                                <span className="ml-1 text-[10px] text-gray-500">
                                  (run)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {new Date(flow.createdAt)
                                .toLocaleString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })
                                .replace(/, (\d{4})/g, ' $1')}
                            </div>
                          </button>
                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(flow.id, e)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-600/20 text-gray-400 hover:text-red-400 transition-all duration-200"
                            aria-label="Delete flow"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Spacer to push profile to bottom when collapsed */
          <div className="flex-1" />
        )}

        {/* Token usage display above profile */}
        <SignedIn>
          <TokenUsageDisplay isOpen={isOpen} />
        </SignedIn>

        {/* Profile button at sidebar bottom */}
        <div className="mb-3">
          <SignedIn>
            <div className="w-full flex items-center rounded-lg hover:bg-[#21262d] text-gray-400 hover:text-gray-200 transition-colors">
              {/* Fixed icon column with Clerk UserButton or mock avatar */}
              <span className="w-14 flex-none flex justify-center p-2">
                {DISABLE_AUTH ? (
                  // Mock avatar when auth is disabled
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-600/40 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-400" />
                  </div>
                ) : (
                  // Clerk UserButton when auth is enabled
                  user && (
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8',
                        },
                      }}
                    />
                  )
                )}
              </span>
              {/* Expanding label column */}
              <span
                className={`text-sm overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen
                    ? 'opacity-100 max-w-[160px] pr-3'
                    : 'opacity-0 max-w-0'
                }`}
              >
                {user?.emailAddresses?.[0]?.emailAddress || 'Profile'}
              </span>
            </div>
          </SignedIn>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
