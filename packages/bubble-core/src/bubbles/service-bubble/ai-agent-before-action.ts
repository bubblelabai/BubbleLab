import type { z } from 'zod';
import type { BubbleContext } from '../../types/bubble.js';
import {
  type CredentialType,
  type AvailableModel,
  RECOMMENDED_MODELS,
} from '@bubblelab/shared-schemas';
import {
  zodSchemaToJsonString,
  buildJsonSchemaInstruction,
} from '../../utils/zod-schema.js';
import { applyCapabilityPreprocessing } from './capability-pipeline.js';
import type { AIAgentParamsParsed, ConversationMessage } from './ai-agent.js';

/**
 * Role of an AIAgent at runtime, computed once in `runBeforeAction`. Drives
 * which Pro-injected context (capabilities, memory, slack ctx, etc.) gets
 * folded into the agent's params before execution.
 *
 * - `flow-master`: the top-level master AIAgent of a Pro-orchestrated flow
 *   execution (Pearl chat, Slack bot flows, approval resumes). Receives the
 *   full Pro context bundle.
 * - `subagent`: an AIAgent spawned by `use-capability` (name prefix
 *   "Capability Agent: …"). Skips Pro injections — the master delegated to it
 *   intentionally with a narrow, capability-scoped prompt.
 * - `utility`: any other AIAgent (workflow-internal, capability-tool-internal,
 *   user flow code without `_isFlowMaster`). Runs with exactly the params the
 *   caller passed. No Pro injections.
 */
export type AgentRole = 'flow-master' | 'subagent' | 'utility';

type ResolveCapabilityCredentials = (
  capDef: {
    metadata: {
      requiredCredentials: CredentialType[];
      optionalCredentials?: CredentialType[];
    };
  },
  capConfig: { credentials?: Record<string, string> }
) => Partial<Record<CredentialType, string>>;

export interface BeforeActionDeps {
  params: AIAgentParamsParsed;
  context: BubbleContext | undefined;
  resolveCapabilityCredentials: ResolveCapabilityCredentials;
}

/**
 * Run the full pre-execution pipeline for an AIAgent:
 *
 * 1. Classify the agent's role (flow-master / subagent / utility).
 * 2. (flow-master only) Inject dynamic capabilities + credentials BEFORE
 *    `applyCapabilityPreprocessing` reads them.
 * 3. Apply common context (dedup caps, min maxTokens, JSON mode, time, run
 *    capability pipeline) — every agent goes through this.
 * 4. (flow-master only) Inject slack ctx + history + memory + read_image +
 *    capability-management tools + custom `/command` detection.
 * 5. (subagent only) Apply custom-cap delegate model override if the master
 *    detected a `/command`.
 * 6. Consume the `_isFlowMaster` marker so children spawned during this
 *    execution stay clean.
 */
export async function runBeforeAction(deps: BeforeActionDeps): Promise<void> {
  const role = classifyRole(deps);

  if (role === 'flow-master') injectFlowMasterDynamicState(deps);

  await applyCommonContext(deps);

  if (role === 'flow-master') await applyFlowMasterContext(deps);
  if (role === 'subagent') applySubAgentContext(deps);

  consumeFlowMasterMarker(deps, role);
}

/**
 * Classify this agent's role exactly once. The name-prefix convention
 * identifies subagents (set by the use-capability spawn site in ai-agent.ts);
 * `_isFlowMaster` on executionMeta is the positive marker that Pro entry
 * points (pearl-chat.ts, slack hooks, flow-approvals.ts) set to mark "I am the
 * top-level master AIAgent of this flow execution."
 */
function classifyRole(deps: BeforeActionDeps): AgentRole {
  if (deps.params.name?.startsWith('Capability Agent:')) return 'subagent';
  const isFlowMaster =
    (deps.context?.executionMeta as Record<string, unknown> | undefined)
      ?._isFlowMaster === true;
  return isFlowMaster ? 'flow-master' : 'utility';
}

/**
 * Pre-pipeline injection for the flow-master agent: replace
 * `params.capabilities` with the dynamic list Pro computed from the user's
 * connected services, and fold every user credential into `params.credentials`
 * + `credentialPool`. Must run before `applyCapabilityPreprocessing` reads
 * `params.capabilities`.
 */
function injectFlowMasterDynamicState(deps: BeforeActionDeps): void {
  const { params, context } = deps;
  const meta = context?.executionMeta as Record<string, unknown> | undefined;
  if (!meta) return;

  const dynamicCaps = meta._dynamicCapabilities as
    | Array<{
        id: string;
        inputs?: Record<string, string | number | boolean | string[]>;
        context?: string;
      }>
    | undefined;
  if (dynamicCaps?.length) {
    params.capabilities = dynamicCaps.map((c) => ({
      ...c,
      inputs: c.inputs ?? {},
    }));
  }

  const dynamicCreds = meta._dynamicCredentials as
    | Record<string, Array<{ id: number; name: string; value: string }>>
    | undefined;
  if (!dynamicCreds) return;

  for (const [credType, entries] of Object.entries(dynamicCreds)) {
    if (!entries.length) continue;
    if (!params.credentials) params.credentials = {};
    (params.credentials as Record<string, string>)[credType] = entries[0].value;
    if (!params.credentialPool)
      params.credentialPool = {} as Record<
        CredentialType,
        Array<{ id: number; name: string; value: string }>
      >;
    (
      params.credentialPool as Record<
        string,
        Array<{ id: number; name: string; value: string }>
      >
    )[credType] = entries;
  }
}

/**
 * Common setup applied to every agent regardless of role: dedup capabilities,
 * enforce min maxTokens, auto-enable JSON mode, append the UTC time line,
 * then run the capability pipeline (which itself branches on subagent vs
 * multi-cap master).
 */
async function applyCommonContext(deps: BeforeActionDeps): Promise<void> {
  const { params, context, resolveCapabilityCredentials } = deps;

  if (params.capabilities && params.capabilities.length > 1) {
    const seen = new Set<string>();
    params.capabilities = params.capabilities.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }

  if (params.model.maxTokens === undefined || params.model.maxTokens < 10000) {
    params.model.maxTokens = 10000;
  }

  if (params.expectedOutputSchema) {
    params.model.jsonMode = true;
    const schemaString = zodSchemaToJsonString(params.expectedOutputSchema);
    params.systemPrompt = `${params.systemPrompt}\n\n${buildJsonSchemaInstruction(schemaString)}`;
  }

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
  params.systemPrompt = `${params.systemPrompt}\n\n**System time (UTC):** ${now}\nIMPORTANT: The system time above is in UTC. Always interpret and present times from the user's perspective and timezone. If the user's timezone is known (from conversation history, user profile, or context), convert all times accordingly. If unknown, ask the user for their timezone before making time-sensitive decisions.`;

  await applyCapabilityPreprocessing(
    params,
    context,
    resolveCapabilityCredentials,
    params.credentialPool
  );
}

/**
 * Post-pipeline context for the flow-master agent. All injections here read
 * from `executionMeta` populated by Pro:
 *
 * - Slack channel + bot identity (`_slackChannel`, `_selfBotDisplayName`).
 * - Trigger conversation history (`triggerConversationHistory`).
 * - Memory tools + system prompt + operating guidelines + memoryCallLLM.
 * - read_image tool (when `_isSlackBot` set).
 * - Capability-management tools (manage_capability, get_capabilities, ask_user)
 *   + capabilitySystemPrompt.
 * - Custom `/command` detection + effort-preset model override.
 */
async function applyFlowMasterContext(deps: BeforeActionDeps): Promise<void> {
  const { params, context } = deps;
  const meta = context?.executionMeta;
  if (!meta) return;

  injectSlackContext(params, meta);
  injectTriggerConversationHistory(params, context, meta);
  injectMemoryContext(params, context, meta);
  await injectReadImageTool(params, meta);
  injectCapabilityManagementContext(params, meta);
  detectAndApplyCustomCommand(params, meta);
}

/**
 * Subagent post-pipeline tweak: when the master detected a custom `/command`
 * and stashed an effort preset on executionMeta, apply the matching delegate
 * model to this subagent.
 */
function applySubAgentContext(deps: BeforeActionDeps): void {
  const { params, context } = deps;
  const customModelOverride = context?.executionMeta
    ?._customCapModelOverride as
    | {
        masterModel: string;
        delegateModel: string;
        reasoningEffort?: 'low' | 'medium' | 'high';
      }
    | undefined;
  if (!customModelOverride) return;
  (params.model as Record<string, unknown>).model =
    customModelOverride.delegateModel;
  params.model.reasoningEffort =
    customModelOverride.reasoningEffort ?? undefined;
}

/**
 * Flip `_isFlowMaster` to false so children spawned during this execution
 * (capability subagents — already excluded by name prefix — and workflow
 * utility agents like ParseDocumentWorkflow's per-page OCR agent) don't
 * re-inject. They share the same `executionMeta` reference, so this mutation
 * propagates to every child within this execution.
 */
function consumeFlowMasterMarker(
  deps: BeforeActionDeps,
  role: AgentRole
): void {
  if (role !== 'flow-master') return;
  const meta = deps.context?.executionMeta as
    | Record<string, unknown>
    | undefined;
  if (meta) meta._isFlowMaster = false;
}

// ---------------------------------------------------------------------------
// Flow-master injection helpers (each runs only inside applyFlowMasterContext).
// ---------------------------------------------------------------------------

function injectSlackContext(
  params: AIAgentParamsParsed,
  meta: Record<string, unknown>
): void {
  const slackChannel = meta._slackChannel as string | undefined;
  if (slackChannel) {
    params.systemPrompt = `${params.systemPrompt}\n**Current Slack channel:** ${slackChannel}`;
  }

  const botDisplayName = meta._selfBotDisplayName as string | undefined;
  const selfBotUserId = meta._selfBotUserId as string | undefined;
  if (botDisplayName) {
    let botContext = `**Your Slack identity:** ${botDisplayName}`;
    if (selfBotUserId) botContext += ` (user ID: ${selfBotUserId})`;
    botContext += `\nIn Slack messages, \`<@userId>\` is a mention — when you see \`<@${selfBotUserId ?? 'your_id'}>\`, that's someone addressing you.`;
    botContext += `\nConversation messages are prefixed with \`[Name (userId)]\` — this tells you who sent each message. Use these names when addressing users.`;
    params.systemPrompt = `${params.systemPrompt}\n${botContext}`;
  }
}

function injectTriggerConversationHistory(
  params: AIAgentParamsParsed,
  context: BubbleContext | undefined,
  meta: Record<string, unknown>
): void {
  if (params.conversationHistory?.length) return;
  const convHistory =
    (meta.triggerConversationHistory as ConversationMessage[] | undefined) ??
    (context?.triggerConversationHistory as ConversationMessage[] | undefined);
  if (convHistory?.length) {
    params.conversationHistory = convHistory;
  }
}

function injectMemoryContext(
  params: AIAgentParamsParsed,
  context: BubbleContext | undefined,
  meta: Record<string, unknown>
): void {
  if (!params.memoryEnabled) return;

  const memoryTools = meta.memoryTools as
    | Array<{
        name: string;
        description: string;
        schema: z.ZodTypeAny;
        func: (input: Record<string, unknown>) => Promise<string>;
      }>
    | undefined;
  if (memoryTools?.length) {
    if (!params.customTools) params.customTools = [];
    params.customTools.push(...memoryTools);
  }

  const memorySystemPrompt = meta.memorySystemPrompt as string | undefined;
  if (memorySystemPrompt) {
    params.systemPrompt = `${params.systemPrompt}\n\n---\n\n${memorySystemPrompt}`;
  }

  const operatingGuidelines = meta.operatingGuidelines as string | undefined;
  if (operatingGuidelines) {
    params.systemPrompt = `${params.systemPrompt}\n\n---\n\n${operatingGuidelines}`;
  }

  const memoryCallLLMInit = meta.memoryCallLLMInit as
    | ((callLLM: (prompt: string) => Promise<string>) => void)
    | undefined;
  if (memoryCallLLMInit) {
    const memoryModel = ((meta.memoryCallLLMModel as string) ||
      RECOMMENDED_MODELS.PRO) as AvailableModel;
    const callLLM = async (prompt: string): Promise<string> => {
      // Dynamic import avoids a module-init cycle (ai-agent.ts imports this
      // module). At call time the class is fully initialized.
      const { AIAgentBubble } = await import('./ai-agent.js');
      const memoryAgent = new AIAgentBubble(
        {
          message: prompt,
          systemPrompt:
            'Respond concisely. Follow the instructions in the user message.',
          name: 'Capability Agent: Memory',
          model: {
            model: memoryModel,
            temperature: 0,
            maxTokens: 4096,
            maxRetries: 2,
          },
          credentials: params.credentials,
          maxIterations: 4,
        },
        context,
        'memory-agent'
      );
      const result = await memoryAgent.action();
      return result.data?.response ?? '';
    };
    memoryCallLLMInit(callLLM);
  }
}

async function injectReadImageTool(
  params: AIAgentParamsParsed,
  meta: Record<string, unknown>
): Promise<void> {
  if (!meta._isSlackBot) return;
  const { buildReadImageTool } = await import('./ai-agent-slack-tools.js');
  const imageTool = buildReadImageTool(params.credentials ?? {});
  if (!params.customTools) params.customTools = [];
  params.customTools.push(imageTool);
  params.systemPrompt += `\n\n**Image Reading:** When users share images, the message will include \`[Attached files: ...]\` with image URLs. Use the \`read_image\` tool with these URLs to see and describe the image contents.`;
}

function injectCapabilityManagementContext(
  params: AIAgentParamsParsed,
  meta: Record<string, unknown>
): void {
  const capabilityTools = meta.capabilityTools as
    | Array<{
        name: string;
        description: string;
        schema: z.ZodTypeAny;
        func: (input: Record<string, unknown>) => Promise<string>;
      }>
    | undefined;
  if (capabilityTools?.length) {
    if (!params.customTools) params.customTools = [];
    params.customTools.push(...capabilityTools);
  }

  const capabilitySystemPrompt = meta.capabilitySystemPrompt as
    | string
    | undefined;
  if (capabilitySystemPrompt) {
    params.systemPrompt = `${params.systemPrompt}\n\n---\n\n${capabilitySystemPrompt}`;
  }
}

/**
 * Detect a `/command` in the user's message and apply the matching custom
 * capability's prompt + effort-preset model override. The chosen preset is
 * stashed on executionMeta so subagents spawned later can pick up the matching
 * delegate model.
 */
function detectAndApplyCustomCommand(
  params: AIAgentParamsParsed,
  meta: Record<string, unknown>
): void {
  const customCaps = meta._availableCustomCapabilities as
    | Record<
        string,
        {
          systemPrompt: string;
          name: string;
          effort?: 'none' | 'run-only' | 'low' | 'medium' | 'high';
        }
      >
    | undefined;
  if (!customCaps) return;

  const match = params.message.match(
    /^(?:<@[A-Z0-9]+>\s*)?`?\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)`?\b\s*([\s\S]*)$/
  );
  if (!match) return;
  const cap = customCaps[match[1]];
  if (!cap) return;

  const effort = cap.effort || 'medium';

  if (effort === 'run-only') {
    params.systemPrompt = cap.systemPrompt;
  } else {
    params.systemPrompt += `\n\n---\n\n[Custom Capability: ${match[1]}]\n${cap.systemPrompt}`;
  }
  params.message = match[2].trim() || `(user invoked /${match[1]})`;

  const effortPresets: Record<
    string,
    {
      masterModel: string;
      delegateModel: string;
      reasoningEffort?: 'low' | 'medium' | 'high';
      provider?: string[];
    }
  > = {
    none: {
      masterModel: RECOMMENDED_MODELS.ANTHROPIC_FAST,
      delegateModel: RECOMMENDED_MODELS.GOOGLE_FAST,
    },
    'run-only': {
      masterModel: 'google/gemini-3.1-flash-lite-preview',
      delegateModel: 'google/gemini-3.1-flash-lite-preview',
    },
    low: {
      masterModel: RECOMMENDED_MODELS.ANTHROPIC_FAST,
      delegateModel: RECOMMENDED_MODELS.ANTHROPIC_FAST,
    },
    medium: {
      masterModel: RECOMMENDED_MODELS.ANTHROPIC_FLAGSHIP,
      delegateModel: RECOMMENDED_MODELS.GOOGLE_FLAGSHIP,
      reasoningEffort: 'medium',
    },
    high: {
      masterModel: RECOMMENDED_MODELS.ANTHROPIC_BEST,
      delegateModel: RECOMMENDED_MODELS.GOOGLE_BEST,
      reasoningEffort: 'high',
    },
  };
  const preset = effortPresets[effort];
  meta._customCapModelOverride = preset;

  (params.model as Record<string, unknown>).model = preset.masterModel;
  params.model.reasoningEffort = preset.reasoningEffort ?? undefined;
  if (preset.provider) {
    params.model.provider = preset.provider;
  }

  if (effort === 'run-only') {
    params.customTools = (params.customTools ?? []).filter(
      (t) => t.name === 'run-flow'
    );
    params.tools = [];
    params.capabilities = [];
    params.model.maxTokens = 20000;
    params.conversationHistory = [];
  }
}
