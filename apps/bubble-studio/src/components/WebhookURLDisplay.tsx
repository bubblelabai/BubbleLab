import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useWebhook } from '../hooks/useWebhook';

interface WebhookURLDisplayProps {
  flowId: number | null;
}

export function WebhookURLDisplay({ flowId }: WebhookURLDisplayProps) {
  const [copied, setCopied] = useState(false);
  const { data: flowData } = useBubbleFlow(flowId);
  const webhookMutation = useWebhook();

  const handleCopy = async () => {
    if (!flowData?.webhook_url) return;

    try {
      await navigator.clipboard.writeText(flowData.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy webhook URL:', error);
    }
  };

  const handleToggleWebhook = async () => {
    if (!flowId) return;

    try {
      await webhookMutation.mutateAsync({
        flowId,
        activate: !flowData?.isActive,
      });
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  if (!flowData?.webhook_url) {
    return null;
  }

  const isActive = flowData.isActive;

  return (
    <div
      className={`p-3 border-b transition-all ${
        isActive
          ? 'bg-green-500/5 border-green-500/30'
          : 'bg-neutral-900/50 border-neutral-700'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-medium text-neutral-400">
            Webhook URL
          </div>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              isActive
                ? 'text-green-400 bg-green-500/20 border-green-500/40'
                : 'text-neutral-500 bg-neutral-700/30 border-neutral-600'
            }`}
          >
            {isActive ? '● Active' : '○ Inactive'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Switch */}
          <button
            type="button"
            onClick={handleToggleWebhook}
            disabled={webhookMutation.isPending}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 ${
              isActive
                ? 'bg-green-500 focus:ring-green-500'
                : 'bg-neutral-600 focus:ring-neutral-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isActive ? 'Click to deactivate' : 'Click to activate'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 transition-colors"
            title="Copy webhook URL"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-neutral-300" />
            )}
          </button>
        </div>
      </div>

      {/* URL Display Row */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 flex-shrink-0">
          POST
        </span>
        <div
          className="text-xs text-neutral-300 font-mono truncate flex-1 cursor-pointer hover:text-neutral-100"
          title={flowData.webhook_url}
          onClick={handleCopy}
        >
          {flowData.webhook_url}
        </div>
      </div>

      {/* Help Text */}
      {!isActive && (
        <div className="mt-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
          ⚠️ Webhook is inactive. Toggle the switch above to activate it.
        </div>
      )}
    </div>
  );
}
