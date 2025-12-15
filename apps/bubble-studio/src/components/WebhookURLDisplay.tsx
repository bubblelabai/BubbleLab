import { Copy, Check, Webhook } from 'lucide-react';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useWebhook } from '../hooks/useWebhook';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface WebhookURLDisplayProps {
  flowId: number | null;
}

export function WebhookURLDisplay({ flowId }: WebhookURLDisplayProps) {
  const { data: flowData } = useBubbleFlow(flowId);
  const webhookMutation = useWebhook();
  const { copied, copyToClipboard } = useCopyToClipboard();

  if (!flowData?.webhook_url) {
    return null;
  }

  const isActive = !!flowData.isActive;

  const handleCopy = async () => {
    await copyToClipboard(flowData.webhook_url);
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

  // Top section for Flow Inputs node (similar to Cron Schedule header)
  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={`h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center ${isActive ? 'bg-success' : 'bg-muted'}`}
          >
            <Webhook className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Webhook</h3>
            <p className="text-xs text-muted-foreground">
              {isActive ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle switch */}
          <button
            type="button"
            onClick={handleToggleWebhook}
            disabled={webhookMutation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background ${
              isActive
                ? 'bg-success focus:ring-success'
                : 'bg-muted focus:ring-muted'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={
              isActive
                ? 'Click to deactivate webhook'
                : 'Click to activate webhook'
            }
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 p-2 rounded bg-muted hover:bg-muted/80 border border-border transition-colors"
            title="Copy webhook URL"
          >
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
