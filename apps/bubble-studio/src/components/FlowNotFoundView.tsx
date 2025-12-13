import { useNavigate } from '@tanstack/react-router';

export interface FlowNotFoundViewProps {
  flowId: number;
  onRetry?: () => void;
}

export function FlowNotFoundView({ flowId, onRetry }: FlowNotFoundViewProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-[#1a1a1a] text-gray-100">
      <div className="px-6 py-3 border-b border-[#30363d]">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-300 font-medium">Bubble Studio</div>
          <button
            type="button"
            onClick={() => navigate({ to: '/flows' })}
            className="border border-gray-600/50 hover:border-gray-500/70 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-gray-200"
          >
            Back to My Flows
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="text-6xl font-bold text-gray-200 tracking-tight">
            404
          </div>
          <div className="mt-3 text-xl font-semibold text-gray-100">
            Flow not found
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Flow <span className="text-gray-300">#{flowId}</span> doesn't exist,
            was deleted, or you don't have access.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: '/flows' })}
              className="bg-pink-600/20 hover:bg-pink-600/30 border border-pink-600/50 text-pink-300 hover:text-pink-200 hover:border-pink-500/70 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            >
              Go to My Flows
            </button>
            <button
              type="button"
              onClick={() => onRetry?.()}
              className="border border-gray-600/50 hover:border-gray-500/70 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-gray-300 hover:text-gray-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
