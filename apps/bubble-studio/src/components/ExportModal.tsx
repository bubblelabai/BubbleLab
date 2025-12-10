import { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Check,
  X,
  Package,
  Terminal,
  KeyRound,
  Workflow,
  TerminalSquare,
} from 'lucide-react';
import { API_BASE_URL } from '../env';
import { refreshToken } from '../lib/token-refresh';
import {
  MockDataGenerator,
  type CredentialType,
} from '@bubblelab/shared-schemas';
import { useBubbleFlow } from '../hooks/useBubbleFlow';
import { generateFlowZip } from '../utils/zipExportGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  flowName?: string;
  flowId?: number | null;
  inputsSchema?: string;
  requiredCredentials?: Record<string, CredentialType[]>;
}

type TabType = 'setup' | 'api';

export function ExportModal({
  isOpen,
  onClose,
  code,
  flowName,
  flowId,
  inputsSchema,
  requiredCredentials = {},
}: ExportModalProps) {
  // Get flow data to access webhook URL
  const { data: flowData } = useBubbleFlow(flowId || null);

  const projectName = useMemo(() => {
    // Generate project name matching zipExportGenerator format
    const sanitized = flowName
      ? flowName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      : 'bubble_flow';
    return sanitized.replace(/_/g, '-');
  }, [flowName]);

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('api');
  const [copiedSetup, setCopiedSetup] = useState<string | null>(null);

  const mockData = useMemo(
    () =>
      MockDataGenerator.generateMockFromJsonSchema(
        JSON.parse(inputsSchema || '{}')
      ),
    [inputsSchema]
  );
  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      // Generate zip file with complete project
      const blob = await generateFlowZip({
        flowName: flowName || 'bubble_flow',
        code,
        requiredCredentials,
        inputsSchema,
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName}.zip`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Close modal after successful download
      onClose();
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleCopyToClipboard = async (text: string, type: string = 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        setCopiedSetup(type);
        setTimeout(() => setCopiedSetup(null), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleCopyCurlExecuteWithToken = async () => {
    try {
      const token = await refreshToken();
      if (!token) return;
      const id = flowId || '<FLOW_ID>';

      const dataString = JSON.stringify(mockData, null, 2);
      const cmd = `curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -H "Authorization: Bearer ${token}" \\
  -d '${dataString}' \\
  "${API_BASE_URL}/bubble-flow/${id}/execute-stream"`;

      await handleCopyToClipboard(cmd, 'curl-execute-token');
    } catch (error) {
      console.error('Failed to copy cURL execute with token:', error);
    }
  };

  const handleCopyWebhookStreamCurl = async () => {
    try {
      if (!flowData?.webhook_url) {
        console.error('No webhook URL available');
        return;
      }

      // Generate mock data from inputsSchema
      let mockData: Record<string, unknown> = {};
      if (inputsSchema) {
        try {
          const schema = JSON.parse(inputsSchema);
          mockData = MockDataGenerator.generateMockFromJsonSchema(schema);
        } catch (error) {
          console.error('Failed to parse inputsSchema:', error);
          mockData = { example: 'value' };
        }
      }

      const dataString = JSON.stringify(mockData, null, 2);
      // Convert webhook URL to stream URL by appending /stream
      const streamUrl = flowData.webhook_url + '/stream';
      const cmd = `curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '${dataString}' \\
  "${streamUrl}"`;

      await handleCopyToClipboard(cmd, 'curl-webhook-stream');
    } catch (error) {
      console.error('Failed to copy webhook stream cURL:', error);
    }
  };

  const handleCopyLLMInstructions = async () => {
    try {
      let instructions = `# LLM Integration Instructions for ${flowName || 'BubbleFlow'}\n\n`;

      instructions += `## Flow Code\n\n\`\`\`typescript\n${code}\n\`\`\`\n\n`;

      if (flowData?.webhook_url) {
        instructions += `## Webhook Endpoints\n\n`;
        instructions += `### Webhook Stream (Real-time logs)\n`;
        instructions += `- **URL**: \`${flowData.webhook_url}/stream\`\n`;
        instructions += `- **Method**: POST\n`;
        instructions += `- **Headers**: Content-Type: application/json\n`;
        instructions += `- **Authentication**: None required\n`;
        instructions += `- **Use case**: Watch execution in real-time, perfect for debugging\n\n`;

        instructions += `**Example:**\n\`\`\`bash\n`;
        const streamDataString = JSON.stringify(mockData, null, 2);
        instructions += `curl -X POST \\\n  -H "Content-Type: application/json" \\\n  -d '${streamDataString}' \\\n  "${flowData.webhook_url}/stream"\n\`\`\`\n\n`;

        instructions += `### Webhook (JSON response)\n`;
        instructions += `- **URL**: \`${flowData.webhook_url}\`\n`;
        instructions += `- **Method**: POST\n`;
        instructions += `- **Headers**: Content-Type: application/json\n`;
        instructions += `- **Authentication**: None required\n`;
        instructions += `- **Use case**: Get final result as JSON, perfect for API integrations\n\n`;

        instructions += `**Example:**\n\`\`\`bash\n`;
        const dataString = JSON.stringify(mockData, null, 2);
        instructions += `curl -X POST \\\n  -H "Content-Type: application/json" \\\n  -d '${dataString}' \\\n  "${flowData.webhook_url}"\n\`\`\`\n\n`;

        instructions += `### Webhook Response Schema\n\n`;
        instructions += `The webhook endpoint returns a JSON response with the following structure:\n\n`;
        instructions += `\`\`\`typescript\n`;
        instructions += `{\n`;
        instructions += `  executionId: number;        // Execution ID\n`;
        instructions += `  success: boolean;           // Execution success status\n`;
        instructions += `  data?: unknown;             // **The actual return data from the workflow**\n`;
        instructions += `  error?: string;             // Error message (if execution failed)\n`;
        instructions += `  webhook?: {                 // Webhook metadata\n`;
        instructions += `    userId: string;           // User ID\n`;
        instructions += `    path: string;             // Webhook path\n`;
        instructions += `    triggeredAt: string;      // Trigger timestamp\n`;
        instructions += `    method: string;           // HTTP method\n`;
        instructions += `  };\n`;
        instructions += `}\n`;
        instructions += `\`\`\`\n\n`;
        instructions += `**Important**: The actual return value from the workflow is in the \`data\` field. Check \`success\` to determine if the execution was successful, and access the workflow result via \`response.data\`.\n\n`;
        instructions += `**Example Response:**\n\`\`\`json\n`;
        instructions += `{\n`;
        instructions += `  "executionId": 12345,\n`;
        instructions += `  "success": true,\n`;
        instructions += `  "data": {\n`;
        instructions += `    // Your workflow's return value goes here\n`;
        instructions += `  },\n`;
        instructions += `  "webhook": {\n`;
        instructions += `    "userId": "user123",\n`;
        instructions += `    "path": "my-webhook",\n`;
        instructions += `    "triggeredAt": "2024-01-01T00:00:00.000Z",\n`;
        instructions += `    "method": "POST"\n`;
        instructions += `  }\n`;
        instructions += `}\n`;
        instructions += `\`\`\`\n\n`;
      }

      if (inputsSchema) {
        instructions += `## Input Schema\n\n\`\`\`json\n${inputsSchema}\n\`\`\`\n\n`;
      }

      instructions += `## Integration Notes\n`;
      instructions += `- This is a TypeScript workflow that can be executed via the webhook endpoints above\n`;
      instructions += `- No authentication is required for webhook endpoints\n`;
      instructions += `- Use the stream endpoint for real-time monitoring\n`;
      instructions += `- Use the standard endpoint for getting the final JSON result\n`;

      await handleCopyToClipboard(instructions, 'llm-instructions');
    } catch (error) {
      console.error('Failed to copy LLM instructions:', error);
    }
  };

  // Intentionally not computing code size/count here to avoid unused vars

  // Setup instructions
  const installCommand = 'npm install @bubblelab/bubble-core';
  const yarnInstallCommand = 'yarn add @bubblelab/bubble-core';
  const pnpmInstallCommand = 'pnpm add @bubblelab/bubble-core';

  const CopyButton = ({
    text,
    type,
    onClick,
    children,
  }: {
    text: string;
    type: string;
    onClick?: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick ? onClick : () => handleCopyToClipboard(text, type)}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copiedSetup === type || (type === 'code' && copied) ? (
        <>
          <Check className="w-3 h-3" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {children}
        </>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-panel rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="bg-card px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-foreground">
                Export Workflow
              </h2>
            </div>
            <button
              title="Close"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card px-6 border-b border-border">
          <nav className="flex space-x-8">
            {[
              { id: 'api', label: 'API Usage Guide', icon: Package },
              {
                id: 'setup',
                label: 'Export to Your Node.js App',
                icon: Terminal,
              },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as TabType)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'setup' && (
            <div className="p-6 space-y-6">
              {/* Setup Guide */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  Export & Run Your Flow
                </h3>

                <p className="text-sm text-muted-foreground">
                  Get a complete, ready-to-run Node.js project with all
                  dependencies included. You'll need to set up your own hosted
                  runtime and configure credentials outside of the Bubble Lab
                  system.
                </p>

                <div className="space-y-3">
                  {/* Step 1: Download */}
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        1.
                      </span>
                      <Download className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-foreground">
                        Download project
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-600/20 border border-purple-600/50 rounded-lg p-2">
                          <Workflow className="w-5 h-5 text-purple-400" />
                        </div>
                        <code className="text-sm text-foreground font-medium font-mono">
                          {projectName}.zip
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(code, 'code')}
                          className="px-3 py-2 bg-panel hover:bg-card border border-border hover:border-muted-foreground rounded text-sm font-medium text-foreground-80 hover:text-foreground transition-all flex items-center gap-2"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Code
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 border border-purple-600/50 hover:border-purple-500/70 rounded text-sm font-medium transition-all flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download (.zip)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Extract & Install */}
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        2.
                      </span>
                      <TerminalSquare className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        Extract & install dependencies
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Extract and navigate to project:
                        </p>
                        <code className="text-sm text-foreground-80 font-mono block">
                          cd {projectName}
                        </code>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Install dependencies (choose your package manager):
                        </p>
                        <div className="flex gap-2">
                          <CopyButton text={installCommand} type="npm">
                            <code className="text-xs text-foreground-80 font-mono">
                              npm install
                            </code>
                          </CopyButton>
                          <span className="text-muted-foreground/50">|</span>
                          <CopyButton text={yarnInstallCommand} type="yarn">
                            <code className="text-xs text-foreground-80 font-mono">
                              yarn install
                            </code>
                          </CopyButton>
                          <span className="text-muted-foreground/50">|</span>
                          <CopyButton text={pnpmInstallCommand} type="pnpm">
                            <code className="text-xs text-foreground-80 font-mono">
                              pnpm install
                            </code>
                          </CopyButton>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Configure (conditional) */}
                  {Object.keys(requiredCredentials).length > 0 && (
                    <div className="bg-panel border border-border rounded-lg overflow-hidden">
                      <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          3.
                        </span>
                        <KeyRound className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          Configure credentials
                        </span>
                      </div>
                      <div className="p-4">
                        <code className="text-sm text-foreground-80 font-mono block mb-2">
                          cp .env.example .env
                        </code>
                        <p className="text-xs text-muted-foreground">
                          Then edit{' '}
                          <code className="text-foreground-80">.env</code> with
                          your API keys
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Run */}
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {Object.keys(requiredCredentials).length > 0
                          ? '4'
                          : '3'}
                        .
                      </span>
                      <Terminal className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium text-foreground">
                        Run your flow
                      </span>
                    </div>
                    <div className="p-4">
                      <code className="text-sm text-foreground-80 font-mono block">
                        npm run dev
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {/* API Usage Guide Header */}
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    API Usage Guide
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Call your workflow via webhook endpoints hosted in Bubble
                    Lab. All executions run on our infrastructure, and you can
                    view execution history and logs here in Bubble Lab even when
                    calling from external applications.
                  </p>
                </div>

                {/* LLM Integration Instructions */}
                {flowData?.webhook_url && (
                  <div className="bg-panel border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            Integrate into other apps
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Copy complete integration guide with code and webhook
                          endpoints
                        </p>
                      </div>
                      <button
                        onClick={handleCopyLLMInstructions}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 border border-purple-600/50 hover:border-purple-500/70 rounded text-sm font-medium transition-all flex items-center gap-2"
                      >
                        {copiedSetup === 'llm-instructions' ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy prompt
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        Works with:
                      </span>
                      <div className="flex items-center gap-2">
                        <img
                          src="/integrations/claude.png"
                          alt="Claude"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="Claude"
                        />
                        <img
                          src="/integrations/bolt.jpg"
                          alt="Bolt"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="Bolt"
                        />
                        <img
                          src="/integrations/cursor.png"
                          alt="Cursor"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="Cursor"
                        />
                        <img
                          src="/integrations/lovable.png"
                          alt="Lovable"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="Lovable"
                        />
                        <img
                          src="/integrations/replit.png"
                          alt="Replit"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="Replit"
                        />
                        <img
                          src="/integrations/v0.png"
                          alt="v0"
                          className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity rounded"
                          title="v0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Webhook Endpoints Section - Show both if webhook is available */}
                {flowData?.webhook_url && (
                  <div className="space-y-3">
                    {/* Webhook Stream Option */}
                    <div className="bg-panel border border-border rounded-lg overflow-hidden">
                      <div className="bg-card px-4 py-3 border-b border-border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <TerminalSquare className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">
                                Webhook Stream
                              </span>
                              <span className="text-xs text-muted-foreground bg-panel px-2 py-0.5 rounded">
                                /stream
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Real-time streaming logs • No authentication •
                              Perfect for terminal/debugging
                            </p>
                          </div>
                          <button
                            onClick={handleCopyWebhookStreamCurl}
                            className="px-3 py-1.5 bg-panel hover:bg-card text-foreground-80 hover:text-foreground border border-border hover:border-muted-foreground rounded text-sm font-medium transition-all flex items-center gap-2"
                          >
                            {copiedSetup === 'curl-webhook-stream' ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <code
                          className="text-sm text-foreground-80 break-words whitespace-pre-wrap"
                          style={{
                            fontFamily:
                              "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Liberation Mono', 'Menlo', monospace",
                          }}
                        >
                          {(() => {
                            const dataString = JSON.stringify(
                              mockData,
                              null,
                              2
                            );
                            return `curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '${dataString}' \\
  "${flowData.webhook_url}/stream"`;
                          })()}
                        </code>
                      </div>
                    </div>

                    {/* Webhook Non-Stream Option */}
                    <div className="bg-panel border border-border rounded-lg overflow-hidden">
                      <div className="bg-card px-4 py-3 border-b border-border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Workflow className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-medium text-foreground">
                                Webhook
                              </span>
                              <span className="text-xs text-muted-foreground bg-panel px-2 py-0.5 rounded">
                                Standard
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              JSON response on completion • No authentication •
                              Perfect for API integrations
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const dataString = JSON.stringify(
                                mockData,
                                null,
                                2
                              );
                              const cmd = `curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '${dataString}' \\
  "${flowData.webhook_url}"`;
                              await handleCopyToClipboard(
                                cmd,
                                'curl-webhook-normal'
                              );
                            }}
                            className="px-3 py-1.5 bg-panel hover:bg-card text-foreground-80 hover:text-foreground border border-border hover:border-muted-foreground rounded text-sm font-medium transition-all flex items-center gap-2"
                          >
                            {copiedSetup === 'curl-webhook-normal' ? (
                              <>
                                <Check className="w-4 h-4" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <code
                          className="text-sm text-foreground-80 break-words whitespace-pre-wrap"
                          style={{
                            fontFamily:
                              "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Liberation Mono', 'Menlo', monospace",
                          }}
                        >
                          {(() => {
                            const dataString = JSON.stringify(
                              mockData,
                              null,
                              2
                            );
                            return `curl -X POST \\
  -H "Content-Type: application/json" \\
  -d '${dataString}' \\
  "${flowData.webhook_url}"`;
                          })()}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback for flows without webhook */}
                {!flowData?.webhook_url && (
                  <div className="bg-panel border border-border rounded-lg overflow-hidden">
                    <div className="bg-card px-4 py-3 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TerminalSquare className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          Execute flow with API token
                        </span>
                      </div>
                      <button
                        onClick={handleCopyCurlExecuteWithToken}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 border border-purple-600/50 hover:border-purple-500/70 rounded text-sm font-medium transition-all flex items-center gap-2"
                      >
                        {copiedSetup === 'curl-execute-token' ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy with token
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-4">
                      <code
                        className="text-sm text-foreground-80 break-words whitespace-pre-wrap"
                        style={{
                          fontFamily:
                            "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'SF Mono', 'Liberation Mono', 'Menlo', monospace",
                        }}
                      >
                        {(() => {
                          const id = flowId || '<FLOW_ID>';
                          const dataString = JSON.stringify(mockData, null, 2);
                          return `curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -H "Authorization: Bearer $TOKEN" \\
  -d '${dataString}' \\
  "${API_BASE_URL}/bubble-flow/${id}/execute-stream"`;
                        })()}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
