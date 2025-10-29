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

  if (!flowData?.webhook_url) {
    return null;
  }

  const isActive = !!flowData.isActive;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(flowData.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy webhook URL:', error);
    }
  };

  const handleToggleWebhook = async () => {
    if (!flowId) return;
    try {
      await webhookMutation.mutateAsync({
        flowId,
        activate: !isActive,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to toggle webhook:', error);
    }
  };

  // Compact inline control for toolbar: status dot, label, toggle, copy
  return (
    <div className="ml-2 pl-2 border-l border-neutral-700 flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span
          className={`text-[10px] font-semibold ${
            isActive ? 'text-green-400' : 'text-neutral-500'
          }`}
          aria-label={isActive ? 'Webhook active' : 'Webhook inactive'}
        >
          {isActive ? '●' : '○'}
        </span>
        <span className="text-[10px] font-medium text-neutral-400">
          Webhook
        </span>
      </div>
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
      <button
        type="button"
        onClick={handleCopy}
        className="flex-shrink-0 p-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 transition-colors"
        title="Copy webhook URL"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-400" />
        ) : (
          <Copy className="w-3 h-3 text-neutral-300" />
        )}
      </button>
    </div>
  );
}
