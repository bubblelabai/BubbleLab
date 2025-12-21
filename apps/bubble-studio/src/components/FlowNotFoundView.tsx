import { useNavigate } from '@tanstack/react-router';

export interface FlowNotFoundViewProps {
  flowId: number;
  onRetry?: () => void;
}

export function FlowNotFoundView({ flowId, onRetry }: FlowNotFoundViewProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-card text-foreground">
      <div className="px-6 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground font-medium">
            Bubble Studio
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: '/flows' })}
            className="border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 text-muted-foreground hover:text-foreground"
          >
            Back to My Flows
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="text-6xl font-bold text-foreground tracking-tight">
            404
          </div>
          <div className="mt-3 text-xl font-semibold text-foreground">
            Flow not found
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Flow <span className="text-foreground">#{flowId}</span> doesn't
            exist, was deleted, or you don't have access.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate({ to: '/flows' })}
              className="bg-pink-100 dark:bg-pink-600/20 hover:bg-pink-200 dark:hover:bg-pink-600/30 border border-pink-300 dark:border-pink-600/50 text-pink-700 dark:text-pink-300 hover:text-pink-800 dark:hover:text-pink-200 hover:border-pink-400 dark:hover:border-pink-500/70 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            >
              Go to My Flows
            </button>
            <button
              type="button"
              onClick={() => onRetry?.()}
              className="border border-slate-300 dark:border-gray-600 hover:border-slate-400 dark:hover:border-gray-500 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-muted-foreground hover:text-foreground"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
