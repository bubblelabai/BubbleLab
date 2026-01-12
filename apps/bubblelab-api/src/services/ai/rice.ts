/**
 * Rice - Workflow Execution Quality Evaluator
 *
 * An AI agent that evaluates workflow execution quality by analyzing:
 * - Execution logs (StreamingLogEvent[])
 * - Workflow code
 *
 * Output: { working: boolean, issue?: string, rating: 1-10 }
 *
 * Uses AIAgentBubble for consistency with other agents (Pearl, MilkTea, Coffee).
 */

import {
  type RiceRequest,
  type RiceResponse,
  type RiceEvaluationResult,
  RiceEvaluationResultSchema,
  RICE_DEFAULT_MODEL,
  CredentialType,
  BUBBLE_STUDIO_INSTRUCTIONS,
  BUBBLE_SPECIFIC_INSTRUCTIONS,
} from '@bubblelab/shared-schemas';
import { AIAgentBubble } from '@bubblelab/bubble-core';
import { env } from 'src/config/env.js';

/**
 * System prompt for Rice evaluation agent with Bubble Studio context
 */
const RICE_SYSTEM_PROMPT = `You are Rice, an AI agent that evaluates workflow execution quality.
You have knowledge of Bubble Studio and its available bubbles to help diagnose issues.

${BUBBLE_STUDIO_INSTRUCTIONS}

## BUBBLE SPECIFIC INSTRUCTIONS:
${BUBBLE_SPECIFIC_INSTRUCTIONS}

## YOUR TASK:
Analyze execution logs and workflow code to provide an objective assessment.

## OUTPUT FORMAT (JSON only, no markdown):
{
  "working": true/false,
  "issueType": "setup" | "workflow" | "input" | null,
  "summary": "Summary of execution or issue description with fix steps",
  "rating": 1-10
}

## ISSUE TYPES:
1. "setup" - Configuration/credential issues (user fixes in Settings, NOT in workflow code)
   - Missing or invalid API credentials
   - Service not connected/configured
   - Rate limiting or quota exceeded
   - Permission denied errors
   - Environment/network issues

2. "workflow" - Logic/code issues in the workflow itself (fixable by editing workflow)
   - Bug in the workflow logic
   - Incorrect data transformations
   - Wrong API parameters
   - Missing error handling
   - Binary data passed to AI agents instead of text

3. "input" - Issues with the input data provided (user needs different input)
   - Invalid input format
   - Missing required fields
   - Input data doesn't match expected schema
   - Empty or null input where data was expected

## RATING SCALE:
- 1-3: Severe issues, workflow is broken or fails to complete
- 4-6: Partial functionality, some problems or unexpected behavior
- 7-8: Working with minor issues or warnings
- 9-10: Excellent, working as expected with good output quality

## EVALUATION CRITERIA:
1. Check for error events in logs (type: 'error', 'fatal')
2. Verify expected outputs are present (look for execution_complete event with data)
3. Check if all bubbles executed successfully (bubble_execution_complete events)
4. Look for timeout issues or excessively long execution times
5. Check for credential/authentication failures
6. Verify data transformations worked correctly (no null/undefined where values expected)
7. Consider warnings - they may indicate potential issues
8. **CRITICAL: Check for binary data in AI agent messages** - AI agents should ONLY receive text data.
   If you see any of these in agent messages, it indicates a DATA CONVERSION FAILURE (issueType: "workflow"):
   - Base64 encoded data (long strings of alphanumeric characters ending in = or ==)
   - Data URLs (data:image/..., data:application/pdf...)
   - Binary file content markers like "%PDF-", "PNG", etc.
   - Placeholders like "[binary data, X chars]" in the logs
   Images should use multimodal image parts, PDFs should be converted to text first.

## SUMMARY GUIDELINES:
- For SUCCESSFUL executions (working=true): Briefly describe what the workflow did and any changes made to external systems (e.g., "Sent email to user@example.com", "Created Slack message in #general", "Saved file to Google Drive")
- For FAILED executions (working=false): Describe the issue and provide actionable steps to fix it

For SETUP issues, format the summary with clear steps:
"[Brief description of the setup issue]

To fix this:
1. [First step]
2. [Second step]
..."
`;

/**
 * Run Rice evaluation on workflow execution
 *
 * @param request - The evaluation request containing logs and workflow code
 * @param credentials - Optional credentials for the AI model
 * @returns RiceResponse with evaluation result or error
 */
export async function runRice(
  request: RiceRequest,
  credentials?: Partial<Record<CredentialType, string>>
): Promise<RiceResponse> {
  const model = request.model || RICE_DEFAULT_MODEL;

  console.log('[Rice] Starting evaluation for execution:', request.executionId);

  try {
    // Build the evaluation prompt
    const evaluationPrompt = buildEvaluationPrompt(
      request.executionLogs,
      request.workflowCode
    );

    // Get credentials - use provided or fall back to environment
    const finalCredentials: Partial<Record<CredentialType, string>> = {
      ...credentials,
      [CredentialType.GOOGLE_GEMINI_CRED]:
        credentials?.[CredentialType.GOOGLE_GEMINI_CRED] ||
        env.GOOGLE_API_KEY ||
        '',
      [CredentialType.OPENROUTER_CRED]:
        credentials?.[CredentialType.OPENROUTER_CRED] ||
        env.OPENROUTER_API_KEY ||
        '',
    };

    // Create AI agent for evaluation (no tools - instructions are in system prompt)
    const agent = new AIAgentBubble({
      name: 'Rice - Workflow Evaluator',
      message: evaluationPrompt,
      systemPrompt: RICE_SYSTEM_PROMPT,
      model: {
        model,
        temperature: 0.1, // Low temperature for consistent evaluation
        jsonMode: true,
      },
      tools: [], // No tools needed - bubble knowledge is in system prompt
      maxIterations: 5, // One-shot evaluation
      credentials: finalCredentials,
    });

    console.log('[Rice] Executing evaluation agent...');
    const result = await agent.action();

    console.log('[Rice] Agent execution completed');
    console.log('[Rice] Success:', result.success);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Agent execution failed',
      };
    }

    // Parse the agent's JSON response
    const responseText = result.data?.response || '';
    console.log('[Rice] Raw response:', responseText);

    let parsed: RiceEvaluationResult;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: false,
          error: `Failed to parse evaluation response: ${responseText.substring(0, 200)}`,
        };
      }
    }

    // Validate the response structure
    const validationResult = RiceEvaluationResultSchema.safeParse(parsed);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Invalid evaluation response structure: ${validationResult.error.message}`,
      };
    }

    console.log('[Rice] Evaluation result:', validationResult.data);

    return {
      success: true,
      evaluation: validationResult.data,
    };
  } catch (error) {
    console.error('[Rice] Evaluation error:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Unknown evaluation error',
    };
  }
}

/**
 * Maximum length for string values in log entries
 */
const MAX_STRING_LENGTH = 500;

/**
 * Patterns that indicate binary/non-text data that should be replaced
 */
const BINARY_DATA_PATTERNS = [
  /^data:[^;]+;base64,/i, // Base64 data URLs
  /^[A-Za-z0-9+/]{100,}={0,2}$/, // Long base64 strings
  /^%PDF-/i, // PDF content
  /^\x89PNG/i, // PNG header
  /^GIF8[79]a/i, // GIF header
  /^\xFF\xD8\xFF/, // JPEG header
];

/**
 * Check if a string looks like binary/non-text data
 */
function isBinaryData(value: string): boolean {
  if (value.length < 50) return false;

  // Check against known patterns
  for (const pattern of BINARY_DATA_PATTERNS) {
    if (pattern.test(value)) return true;
  }

  // Check for high ratio of non-printable characters
  const nonPrintable = value
    .slice(0, 200)
    .split('')
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 32 || code > 126;
    }).length;

  return nonPrintable / Math.min(value.length, 200) > 0.3;
}

/**
 * Sanitize a value for inclusion in the prompt
 * - Truncates long strings
 * - Replaces binary data with placeholders
 * - Handles nested objects/arrays recursively
 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 5) return '[nested too deep]';

  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    // Check for binary data
    if (isBinaryData(value)) {
      return `[binary data, ${value.length} chars]`;
    }
    // Truncate long strings
    if (value.length > MAX_STRING_LENGTH) {
      return (
        value.substring(0, MAX_STRING_LENGTH) +
        `... [truncated, ${value.length} total chars]`
      );
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    // For arrays, sanitize each element
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, depth + 1);
    }
    return sanitized;
  }

  return String(value);
}

/**
 * Sanitize a single log entry - preserves structure but truncates/replaces problematic data
 */
function sanitizeLogEntry(log: unknown): unknown {
  return sanitizeValue(log);
}

/**
 * Build the evaluation prompt from logs and code
 */
function buildEvaluationPrompt(
  executionLogs: unknown[],
  workflowCode: string
): string {
  // Summarize logs to avoid token limits
  const logsSummary = summarizeLogs(executionLogs);

  // Sanitize each log entry individually (preserves all events but truncates large values)
  const sanitizedLogs = executionLogs.map(sanitizeLogEntry);
  const logsJson = JSON.stringify(sanitizedLogs, null, 2);

  // Truncate code if needed
  const truncatedCode =
    workflowCode.length > 10000
      ? workflowCode.substring(0, 10000) + '...[truncated]'
      : workflowCode;

  return `## Execution Logs Summary:
${logsSummary}

## Full Execution Logs:
${logsJson}

## Workflow Code:
\`\`\`typescript
${truncatedCode}
\`\`\`

Please evaluate this workflow execution and provide your assessment in JSON format.`;
}

/**
 * Summarize execution logs for quick analysis
 */
function summarizeLogs(logs: unknown[]): string {
  const typedLogs = logs as Array<{
    type?: string;
    message?: string;
    bubbleName?: string;
    executionTime?: number;
    additionalData?: unknown;
  }>;

  const summary = {
    totalEvents: typedLogs.length,
    eventTypes: {} as Record<string, number>,
    errors: [] as string[],
    warnings: [] as string[],
    bubbleExecutions: [] as string[],
    executionComplete: false,
    totalExecutionTime: 0,
  };

  for (const log of typedLogs) {
    const type = log.type || 'unknown';
    summary.eventTypes[type] = (summary.eventTypes[type] || 0) + 1;

    if (type === 'error' || type === 'fatal') {
      summary.errors.push(log.message || 'Unknown error');
    }

    if (type === 'warn') {
      summary.warnings.push(log.message || 'Unknown warning');
    }

    if (type === 'bubble_execution_complete') {
      summary.bubbleExecutions.push(log.bubbleName || 'Unknown bubble');
    }

    if (type === 'execution_complete') {
      summary.executionComplete = true;
      if (log.executionTime) {
        summary.totalExecutionTime = log.executionTime;
      }
    }
  }

  return `Total Events: ${summary.totalEvents}
Event Types: ${JSON.stringify(summary.eventTypes)}
Errors: ${summary.errors.length > 0 ? summary.errors.join('; ') : 'None'}
Warnings: ${summary.warnings.length > 0 ? summary.warnings.join('; ') : 'None'}
Bubbles Executed: ${summary.bubbleExecutions.join(', ') || 'None'}
Execution Complete: ${summary.executionComplete}
Total Execution Time: ${summary.totalExecutionTime}ms`;
}

/**
 * Get the model used for evaluation (for storing in database)
 */
export function getRiceModelUsed(request: RiceRequest): string {
  return request.model || RICE_DEFAULT_MODEL;
}
