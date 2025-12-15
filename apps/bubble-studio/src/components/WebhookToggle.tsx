import { Webhook, Copy, Check } from 'lucide-react';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { useWebhook } from '../hooks/useWebhook';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

interface WebhookToggleProps {
  flowId: number;
  compact?: boolean;
  showCopyButton?: boolean;
}

/**
 * Reusable component for displaying and toggling webhook activation
 * Used in both HomePage and FlowVisualizer
 */
export function WebhookToggle({
  flowId,
  compact = false,
  showCopyButton = true,
}: WebhookToggleProps) {
  const { data: currentFlow } = useBubbleFlow(flowId);
  const webhookMutation = useWebhook();
  const { copied, copyToClipboard } = useCopyToClipboard();

  const isActive = currentFlow?.isActive ?? false;
  const webhookUrl = currentFlow?.webhook_url;

  const isPending = webhookMutation.isPending;

  const handleToggle = async () => {
    if (isPending || !flowId) return;

    try {
      await webhookMutation.mutateAsync({
        flowId,
        activate: !isActive,
      });
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleCopy = async () => {
    if (!webhookUrl) return;
    await copyToClipboard(webhookUrl);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Toggle Switch */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          className={`relative inline-flex items-center h-5 w-9 rounded-full transition-all duration-200 ${
            isPending
              ? 'cursor-not-allowed opacity-50 bg-muted-foreground'
              : isActive
                ? 'bg-success hover:bg-success/90'
                : 'bg-muted hover:bg-muted/80'
          }`}
          title={
            isPending
              ? 'Updating webhook...'
              : isActive
                ? 'Click to deactivate webhook'
                : 'Click to activate webhook'
          }
        >
          <span className="sr-only">Toggle webhook</span>
          {isPending ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                isActive ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          )}
        </button>

        {/* Status Text and Webhook Icon */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium ${
              isActive ? 'text-success' : 'text-muted-foreground'
            }`}
          >
            {isPending ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
          </span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground/80">
            <Webhook className="w-3 h-3" />
            <span>Webhook</span>
          </div>
        </div>

        {/* Copy Button */}
        {showCopyButton && webhookUrl && isActive && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex-shrink-0 p-1 rounded bg-background hover:bg-muted border border-border transition-colors"
            title="Copy webhook URL"
          >
            {copied ? (
              <Check className="w-3 h-3 text-success" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isActive ? 'bg-success' : 'bg-muted'}`}
          >
            <Webhook className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Webhook</h3>
            <p className="text-xs text-muted-foreground">
              {isActive ? 'Receiving events' : 'Inactive'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3">
          <span
            className={`text-sm font-medium ${
              isActive ? 'text-success' : 'text-muted-foreground'
            }`}
          >
            {isPending ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`relative inline-flex items-center h-6 w-11 rounded-full transition-all duration-200 ${
              isPending
                ? 'cursor-not-allowed opacity-50 bg-muted-foreground'
                : isActive
                  ? 'bg-success hover:bg-success/90'
                  : 'bg-muted hover:bg-muted/80'
            }`}
            title={
              isPending
                ? 'Updating webhook...'
                : isActive
                  ? 'Click to deactivate webhook'
                  : 'Click to activate webhook'
            }
          >
            <span className="sr-only">Toggle webhook</span>
            {isPending ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                  isActive ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            )}
          </button>
        </div>
      </div>

      {webhookUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-muted-foreground font-mono truncate">
              {webhookUrl}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex-shrink-0 p-1.5 rounded bg-muted hover:bg-muted/80 border border-border transition-colors"
              title="Copy webhook URL"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
