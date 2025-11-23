import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// AGI Agent API base URL
const AGI_API_BASE = 'https://api.agi.tech/v1';

// Session status enum
const SessionStatus = z.enum([
  'initializing',
  'ready',
  'running',
  'paused',
  'completed',
  'error',
  'terminated',
]);

// Execution status enum
const ExecutionStatus = z.enum([
  'running',
  'waiting_for_input',
  'finished',
  'error',
]);

// Agent model names
const AgentModel = z
  .enum(['agi-0', 'agi-0-fast'])
  .describe('Agent model to use: agi-0 (full-featured) or agi-0-fast (faster)');

// Snapshot mode enum
const SnapshotMode = z
  .enum(['none', 'memory', 'filesystem'])
  .describe(
    'Snapshot mode: none (no snapshot), memory (faster), filesystem (more reliable)'
  );

// Message schema
const AGIMessageSchema = z.object({
  id: z.number().describe('Unique message ID'),
  type: z
    .enum(['THOUGHT', 'QUESTION', 'USER', 'DONE', 'ERROR', 'LOG'])
    .describe('Message type'),
  content: z
    .union([z.string(), z.record(z.unknown())])
    .describe('Message content'),
  timestamp: z.string().describe('ISO 8601 timestamp'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata'),
});

// Session schema
const AGISessionSchema = z.object({
  session_id: z.string().uuid().describe('Unique session identifier'),
  vnc_url: z.string().optional().describe('URL to view the browser'),
  agent_name: z.string().describe('Agent model being used'),
  status: SessionStatus.describe('Current session status'),
  created_at: z.string().describe('ISO 8601 creation timestamp'),
});

// Define the parameters schema for different AGI operations
const AGIIncParamsSchema = z.discriminatedUnion('operation', [
  // Create session operation
  z.object({
    operation: z
      .literal('create_session')
      .describe('Create a new agent session with a browser environment'),
    agent_name: AgentModel.optional()
      .default('agi-0')
      .describe('Agent model to use'),
    webhook_url: z
      .string()
      .url()
      .optional()
      .describe('URL to receive webhook notifications for session events'),
    restore_from_session_id: z
      .string()
      .uuid()
      .optional()
      .describe('Restore session from a specific session snapshot'),
    restore_default_environment_from_user_id: z
      .string()
      .optional()
      .describe('Restore from user default environment snapshot'),
    enable_memory_snapshot: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable memory snapshots for faster restoration'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // List sessions operation
  z.object({
    operation: z
      .literal('list_sessions')
      .describe('Get all sessions for the authenticated user'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get session operation
  z.object({
    operation: z
      .literal('get_session')
      .describe('Get details for a specific session'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete session operation
  z.object({
    operation: z
      .literal('delete_session')
      .describe('Delete a specific session and cleanup resources'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session to delete'),
    save_snapshot_mode: SnapshotMode.optional()
      .default('none')
      .describe('Snapshot mode when deleting'),
    save_as_default: z
      .boolean()
      .optional()
      .default(false)
      .describe('Set snapshot as user default environment'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Delete all sessions operation
  z.object({
    operation: z
      .literal('delete_all_sessions')
      .describe('Delete all sessions for the authenticated user'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Send message operation
  z.object({
    operation: z
      .literal('send_message')
      .describe('Send a message to the agent to start a task or respond'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session'),
    message: z
      .string()
      .min(1, 'Message is required')
      .max(10000, 'Message too long')
      .describe('The message text to send to the agent'),
    start_url: z
      .string()
      .url()
      .optional()
      .describe('Optional starting URL for the agent to navigate to'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get execution status operation
  z.object({
    operation: z
      .literal('get_status')
      .describe('Get the current execution status of a session'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get messages operation
  z.object({
    operation: z
      .literal('get_messages')
      .describe('Poll for messages and updates from the agent'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session'),
    after_id: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Return only messages with ID greater than this value'),
    sanitize: z
      .boolean()
      .optional()
      .default(true)
      .describe('Filter out system messages and internal prompts'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Pause session operation
  z.object({
    operation: z
      .literal('pause_session')
      .describe('Temporarily pause task execution'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session to pause'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Resume session operation
  z.object({
    operation: z.literal('resume_session').describe('Resume a paused task'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session to resume'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Cancel session operation
  z.object({
    operation: z
      .literal('cancel_session')
      .describe('Cancel the current task execution'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session to cancel'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Navigate browser operation
  z.object({
    operation: z
      .literal('navigate')
      .describe('Navigate the browser to a specific URL'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session'),
    url: z
      .string()
      .url()
      .min(1, 'URL is required')
      .max(2000, 'URL too long')
      .describe('Absolute URL to navigate to'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Get screenshot operation
  z.object({
    operation: z
      .literal('get_screenshot')
      .describe('Capture a screenshot of the current browser state'),
    session_id: z
      .string()
      .uuid()
      .min(1, 'Session ID is required')
      .describe('The UUID of the session'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const AGIIncResultSchema = z.discriminatedUnion('operation', [
  // Create session result
  z.object({
    operation: z.literal('create_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    session_id: z.string().uuid().optional().describe('Created session ID'),
    vnc_url: z.string().optional().describe('URL to view the browser'),
    agent_name: z.string().optional().describe('Agent model being used'),
    status: SessionStatus.optional().describe('Session status'),
    created_at: z.string().optional().describe('Creation timestamp'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // List sessions result
  z.object({
    operation: z.literal('list_sessions'),
    ok: z.boolean().describe('Whether the API call was successful'),
    sessions: z
      .array(AGISessionSchema)
      .optional()
      .describe('Array of sessions'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Get session result
  z.object({
    operation: z.literal('get_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    session: AGISessionSchema.optional().describe('Session details'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Delete session result
  z.object({
    operation: z.literal('delete_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    deleted: z.boolean().optional().describe('Whether session was deleted'),
    message: z.string().optional().describe('Result message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Delete all sessions result
  z.object({
    operation: z.literal('delete_all_sessions'),
    ok: z.boolean().describe('Whether the API call was successful'),
    deleted: z.boolean().optional().describe('Whether sessions were deleted'),
    message: z.string().optional().describe('Result message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Send message result
  z.object({
    operation: z.literal('send_message'),
    ok: z.boolean().describe('Whether the API call was successful'),
    message: z.string().optional().describe('Confirmation message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Get status result
  z.object({
    operation: z.literal('get_status'),
    ok: z.boolean().describe('Whether the API call was successful'),
    status: ExecutionStatus.optional().describe('Current execution status'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Get messages result
  z.object({
    operation: z.literal('get_messages'),
    ok: z.boolean().describe('Whether the API call was successful'),
    messages: z
      .array(AGIMessageSchema)
      .optional()
      .describe('Array of messages'),
    status: ExecutionStatus.optional().describe('Current execution status'),
    has_agent: z.boolean().optional().describe('Whether agent is connected'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Pause session result
  z.object({
    operation: z.literal('pause_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    message: z.string().optional().describe('Result message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Resume session result
  z.object({
    operation: z.literal('resume_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    message: z.string().optional().describe('Result message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Cancel session result
  z.object({
    operation: z.literal('cancel_session'),
    ok: z.boolean().describe('Whether the API call was successful'),
    message: z.string().optional().describe('Result message'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Navigate result
  z.object({
    operation: z.literal('navigate'),
    ok: z.boolean().describe('Whether the API call was successful'),
    current_url: z.string().optional().describe('Current URL after navigation'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),

  // Get screenshot result
  z.object({
    operation: z.literal('get_screenshot'),
    ok: z.boolean().describe('Whether the API call was successful'),
    screenshot: z
      .string()
      .optional()
      .describe('Base64-encoded JPEG image as data URL'),
    url: z.string().optional().describe('Current page URL'),
    title: z.string().optional().describe('Current page title'),
    error: z.string().describe('Error message if operation failed'),
    success: z.boolean().describe('Whether the operation was successful'),
  }),
]);

type AGIIncResult = z.output<typeof AGIIncResultSchema>;
type AGIIncParams = z.input<typeof AGIIncParamsSchema>;
type AGIIncParamsParsed = z.output<typeof AGIIncParamsSchema>;

// Export the input type for external usage
export type AGIIncParamsInput = z.input<typeof AGIIncParamsSchema>;

// Helper type to get the result type for a specific operation
export type AGIIncOperationResult<T extends AGIIncParams['operation']> =
  Extract<AGIIncResult, { operation: T }>;

// AGI API error interface
interface AGIApiError {
  success: false;
  error?: string;
  message?: string;
}

// Successful AGI API response interface
interface AGIApiResponse {
  [key: string]: unknown;
}

export class AGIIncBubble<
  T extends AGIIncParams = AGIIncParams,
> extends ServiceBubble<
  T,
  Extract<AGIIncResult, { operation: T['operation'] }>
> {
  public async testCredential(): Promise<boolean> {
    // Make a test API call to list sessions
    try {
      const response = await this.makeAGIApiCall('sessions', {}, 'GET');
      return Array.isArray(response);
    } catch {
      return false;
    }
  }

  static readonly type = 'service' as const;
  static readonly service = 'agi-inc';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'agi-inc';
  static readonly schema = AGIIncParamsSchema;
  static readonly resultSchema = AGIIncResultSchema;
  static readonly shortDescription =
    'AGI Agent integration for browser automation and task execution';
  static readonly longDescription = `
    AGI Agent Sessions API integration for creating browser agents that can perform tasks autonomously.
    Use cases:
    - Internet research and data extraction
    - Form filling and web automation
    - Making purchases with guest checkout
    - General web automation tasks

    Features:
    - Create and manage browser sessions
    - Send tasks and monitor progress
    - Control execution (pause, resume, cancel)
    - Capture screenshots
    - Webhook support for real-time updates

    Security Features:
    - Bearer token authentication
    - Rate limiting protection
    - Session isolation
    - Comprehensive error handling
  `;
  static readonly alias = 'agi-inc';

  constructor(
    params: T = {
      operation: 'list_sessions',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<AGIIncResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<AGIIncResult> => {
        switch (operation) {
          case 'create_session':
            return await this.createSession(this.params);
          case 'list_sessions':
            return await this.listSessions();
          case 'get_session':
            return await this.getSession(this.params);
          case 'delete_session':
            return await this.deleteSession(this.params);
          case 'delete_all_sessions':
            return await this.deleteAllSessions();
          case 'send_message':
            return await this.sendMessage(this.params);
          case 'get_status':
            return await this.getStatus(this.params);
          case 'get_messages':
            return await this.getMessages(this.params);
          case 'pause_session':
            return await this.pauseSession(this.params);
          case 'resume_session':
            return await this.resumeSession(this.params);
          case 'cancel_session':
            return await this.cancelSession(this.params);
          case 'navigate':
            return await this.navigate(this.params);
          case 'get_screenshot':
            return await this.getScreenshot(this.params);
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<AGIIncResult, { operation: T['operation'] }>;
    } catch (error) {
      const failedOperation = this.params.operation as T['operation'];
      return {
        success: false,
        ok: false,
        operation: failedOperation,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred in AGIIncBubble',
      } as Extract<AGIIncResult, { operation: T['operation'] }>;
    }
  }

  private async createSession(
    params: Extract<AGIIncParams, { operation: 'create_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'create_session' }>> {
    const parsed = AGIIncParamsSchema.parse(params);
    const {
      agent_name,
      webhook_url,
      restore_from_session_id,
      restore_default_environment_from_user_id,
      enable_memory_snapshot,
    } = parsed as Extract<AGIIncParamsParsed, { operation: 'create_session' }>;

    const body: Record<string, unknown> = {
      agent_name,
    };

    if (webhook_url) body.webhook_url = webhook_url;
    if (restore_from_session_id)
      body.restore_from_session_id = restore_from_session_id;
    if (restore_default_environment_from_user_id)
      body.restore_default_environment_from_user_id =
        restore_default_environment_from_user_id;
    if (enable_memory_snapshot !== undefined)
      body.enable_memory_snapshot = enable_memory_snapshot;

    const response = await this.makeAGIApiCall('sessions', body, 'POST');

    return {
      operation: 'create_session',
      ok: true,
      session_id: response.session_id as string,
      vnc_url: response.vnc_url as string | undefined,
      agent_name: response.agent_name as string,
      status: response.status as z.infer<typeof SessionStatus>,
      created_at: response.created_at as string,
      error: '',
      success: true,
    };
  }

  private async listSessions(): Promise<
    Extract<AGIIncResult, { operation: 'list_sessions' }>
  > {
    const response = await this.makeAGIApiCall('sessions', {}, 'GET');

    return {
      operation: 'list_sessions',
      ok: true,
      sessions: Array.isArray(response)
        ? z.array(AGISessionSchema).parse(response)
        : undefined,
      error: '',
      success: true,
    };
  }

  private async getSession(
    params: Extract<AGIIncParams, { operation: 'get_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'get_session' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}`,
      {},
      'GET'
    );

    return {
      operation: 'get_session',
      ok: true,
      session: AGISessionSchema.parse(response),
      error: '',
      success: true,
    };
  }

  private async deleteSession(
    params: Extract<AGIIncParams, { operation: 'delete_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'delete_session' }>> {
    const parsed = AGIIncParamsSchema.parse(params);
    const { session_id, save_snapshot_mode, save_as_default } =
      parsed as Extract<AGIIncParamsParsed, { operation: 'delete_session' }>;

    const queryParams: string[] = [];
    if (save_snapshot_mode && save_snapshot_mode !== 'none') {
      queryParams.push(`save_snapshot_mode=${save_snapshot_mode}`);
    }
    if (save_as_default) {
      queryParams.push(`save_as_default=true`);
    }

    const endpoint =
      queryParams.length > 0
        ? `sessions/${session_id}?${queryParams.join('&')}`
        : `sessions/${session_id}`;

    const response = await this.makeAGIApiCall(endpoint, {}, 'DELETE');

    return {
      operation: 'delete_session',
      ok: true,
      deleted: response.deleted as boolean,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async deleteAllSessions(): Promise<
    Extract<AGIIncResult, { operation: 'delete_all_sessions' }>
  > {
    const response = await this.makeAGIApiCall('sessions', {}, 'DELETE');

    return {
      operation: 'delete_all_sessions',
      ok: true,
      deleted: response.deleted as boolean,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async sendMessage(
    params: Extract<AGIIncParams, { operation: 'send_message' }>
  ): Promise<Extract<AGIIncResult, { operation: 'send_message' }>> {
    const { session_id, message, start_url } = params;

    const body: Record<string, unknown> = { message };
    if (start_url) body.start_url = start_url;

    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/message`,
      body,
      'POST'
    );

    return {
      operation: 'send_message',
      ok: true,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async getStatus(
    params: Extract<AGIIncParams, { operation: 'get_status' }>
  ): Promise<Extract<AGIIncResult, { operation: 'get_status' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/status`,
      {},
      'GET'
    );

    return {
      operation: 'get_status',
      ok: true,
      status: response.status as z.infer<typeof ExecutionStatus>,
      error: '',
      success: true,
    };
  }

  private async getMessages(
    params: Extract<AGIIncParams, { operation: 'get_messages' }>
  ): Promise<Extract<AGIIncResult, { operation: 'get_messages' }>> {
    const parsed = AGIIncParamsSchema.parse(params);
    const { session_id, after_id, sanitize } = parsed as Extract<
      AGIIncParamsParsed,
      { operation: 'get_messages' }
    >;

    const queryParams = new URLSearchParams();
    queryParams.set('after_id', after_id.toString());
    queryParams.set('sanitize', sanitize.toString());

    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/messages?${queryParams.toString()}`,
      {},
      'GET'
    );

    return {
      operation: 'get_messages',
      ok: true,
      messages: response.messages
        ? z.array(AGIMessageSchema).parse(response.messages)
        : undefined,
      status: response.status as z.infer<typeof ExecutionStatus> | undefined,
      has_agent: response.has_agent as boolean | undefined,
      error: '',
      success: true,
    };
  }

  private async pauseSession(
    params: Extract<AGIIncParams, { operation: 'pause_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'pause_session' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/pause`,
      {},
      'POST'
    );

    return {
      operation: 'pause_session',
      ok: true,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async resumeSession(
    params: Extract<AGIIncParams, { operation: 'resume_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'resume_session' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/resume`,
      {},
      'POST'
    );

    return {
      operation: 'resume_session',
      ok: true,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async cancelSession(
    params: Extract<AGIIncParams, { operation: 'cancel_session' }>
  ): Promise<Extract<AGIIncResult, { operation: 'cancel_session' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/cancel`,
      {},
      'POST'
    );

    return {
      operation: 'cancel_session',
      ok: true,
      message: response.message as string,
      error: '',
      success: true,
    };
  }

  private async navigate(
    params: Extract<AGIIncParams, { operation: 'navigate' }>
  ): Promise<Extract<AGIIncResult, { operation: 'navigate' }>> {
    const { session_id, url } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/navigate`,
      { url },
      'POST'
    );

    return {
      operation: 'navigate',
      ok: true,
      current_url: response.current_url as string,
      error: '',
      success: true,
    };
  }

  private async getScreenshot(
    params: Extract<AGIIncParams, { operation: 'get_screenshot' }>
  ): Promise<Extract<AGIIncResult, { operation: 'get_screenshot' }>> {
    const { session_id } = params;
    const response = await this.makeAGIApiCall(
      `sessions/${session_id}/screenshot`,
      {},
      'GET'
    );

    return {
      operation: 'get_screenshot',
      ok: true,
      screenshot: response.screenshot as string,
      url: response.url as string,
      title: response.title as string,
      error: '',
      success: true,
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No AGI API credentials provided');
    }

    return credentials[CredentialType.AGI_API_KEY];
  }

  private async makeAGIApiCall(
    endpoint: string,
    body: Record<string, unknown>,
    method: 'GET' | 'POST' | 'DELETE' = 'POST'
  ): Promise<AGIApiResponse> {
    const url = `${AGI_API_BASE}/${endpoint}`;

    const authToken = this.chooseCredential();

    if (!authToken) {
      throw new Error('AGI API key is required but was not provided');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };

    const fetchConfig: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && Object.keys(body).length > 0) {
      fetchConfig.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchConfig);
    const data = await response.json();

    if (!response.ok) {
      const errorData = data as AGIApiError;
      throw new Error(
        `AGI API error: ${errorData.error || errorData.message || `HTTP ${response.status}`}`
      );
    }

    return data as AGIApiResponse;
  }
}
