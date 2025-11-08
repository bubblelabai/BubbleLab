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
  const [activeTab, setActiveTab] = useState<TabType>('setup');
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
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
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
      <div className="relative bg-[#0f1115] rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col border border-[#30363d]">
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 border-b border-[#30363d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-100">
                Export Workflow
              </h2>
            </div>
            <button
              title="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#1a1a1a] px-6 border-b border-[#30363d]">
          <nav className="flex space-x-8">
            {[
              {
                id: 'setup',
                label: 'Export to Your Node.js App',
                icon: Terminal,
              },
              { id: 'api', label: 'API Usage Guide', icon: Package },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as TabType)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                  activeTab === id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-[#444c56]'
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
                <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  Export & Run Your Flow
                </h3>

                <p className="text-sm text-gray-400">
                  Get a complete, ready-to-run Node.js project with all
                  dependencies included.
                </p>

                <div className="space-y-3">
                  {/* Step 1: Download */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                    <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#30363d] flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        1.
                      </span>
                      <Download className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-gray-200">
                        Download project
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-600/20 border border-purple-600/50 rounded-lg p-2">
                          <Workflow className="w-5 h-5 text-purple-400" />
                        </div>
                        <code className="text-sm text-gray-200 font-medium font-mono">
                          {projectName}.zip
                        </code>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyToClipboard(code, 'code')}
                          className="px-3 py-2 bg-[#0d1117] hover:bg-[#1a1a1a] border border-[#30363d] hover:border-gray-500 rounded text-sm font-medium text-gray-300 hover:text-gray-100 transition-all flex items-center gap-2"
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
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                    <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#30363d] flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        2.
                      </span>
                      <TerminalSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-200">
                        Extract & install dependencies
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          Extract and navigate to project:
                        </p>
                        <code className="text-sm text-gray-300 font-mono block">
                          cd {projectName}
                        </code>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          Install dependencies (choose your package manager):
                        </p>
                        <div className="flex gap-2">
                          <CopyButton text={installCommand} type="npm">
                            <code className="text-xs text-gray-300 font-mono">
                              npm install
                            </code>
                          </CopyButton>
                          <span className="text-gray-600">|</span>
                          <CopyButton text={yarnInstallCommand} type="yarn">
                            <code className="text-xs text-gray-300 font-mono">
                              yarn install
                            </code>
                          </CopyButton>
                          <span className="text-gray-600">|</span>
                          <CopyButton text={pnpmInstallCommand} type="pnpm">
                            <code className="text-xs text-gray-300 font-mono">
                              pnpm install
                            </code>
                          </CopyButton>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Configure (conditional) */}
                  {Object.keys(requiredCredentials).length > 0 && (
                    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                      <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#30363d] flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-200">
                          3.
                        </span>
                        <KeyRound className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-200">
                          Configure credentials
                        </span>
                      </div>
                      <div className="p-4">
                        <code className="text-sm text-gray-300 font-mono block mb-2">
                          cp .env.example .env
                        </code>
                        <p className="text-xs text-gray-400">
                          Then edit <code className="text-gray-300">.env</code>{' '}
                          with your API keys
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Run */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                    <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#30363d] flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200">
                        {Object.keys(requiredCredentials).length > 0
                          ? '4'
                          : '3'}
                        .
                      </span>
                      <Terminal className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-gray-200">
                        Run your flow
                      </span>
                    </div>
                    <div className="p-4">
                      <code className="text-sm text-gray-300 font-mono block">
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
                {/* LLM Integration Instructions */}
                {flowData?.webhook_url && (
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-200">
                            Integrate into other apps
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
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
                    <div className="flex items-center gap-3 pt-2 border-t border-[#30363d]">
                      <span className="text-xs text-gray-500">Works with:</span>
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
                    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                      <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#30363d]">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <TerminalSquare className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-200">
                                Webhook Stream
                              </span>
                              <span className="text-xs text-gray-500 bg-[#0d1117] px-2 py-0.5 rounded">
                                /stream
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">
                              Real-time streaming logs • No authentication •
                              Perfect for terminal/debugging
                            </p>
                          </div>
                          <button
                            onClick={handleCopyWebhookStreamCurl}
                            className="px-3 py-1.5 bg-[#0f1115] hover:bg-[#1a1a1a] text-gray-300 hover:text-gray-100 border border-[#30363d] hover:border-gray-500 rounded text-sm font-medium transition-all flex items-center gap-2"
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
                          className="text-sm text-gray-300 break-words whitespace-pre-wrap"
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
                    <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                      <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#30363d]">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Workflow className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-200">
                                Webhook
                              </span>
                              <span className="text-xs text-gray-500 bg-[#0d1117] px-2 py-0.5 rounded">
                                Standard
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">
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
                            className="px-3 py-1.5 bg-[#0f1115] hover:bg-[#1a1a1a] text-gray-300 hover:text-gray-100 border border-[#30363d] hover:border-gray-500 rounded text-sm font-medium transition-all flex items-center gap-2"
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
                          className="text-sm text-gray-300 break-words whitespace-pre-wrap"
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
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden">
                    <div className="bg-[#1a1a1a] px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TerminalSquare className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-200">
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
                        className="text-sm text-gray-300 break-words whitespace-pre-wrap"
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
