import type { BubbleContext } from '../../types/bubble.js';
import {
  RECOMMENDED_MODELS,
  type CredentialType,
} from '@bubblelab/shared-schemas';
import {
  getCapability,
  type CapabilityRuntimeContext,
} from '../../capabilities/index.js';
import type { AIAgentParamsParsed, AIAgentResult } from './ai-agent.js';

type ResolveCapabilityCredentials = (
  capDef: {
    metadata: {
      requiredCredentials: CredentialType[];
      optionalCredentials?: CredentialType[];
    };
  },
  capConfig: { credentials?: Record<string, string> }
) => Partial<Record<CredentialType, string>>;

export async function applyCapabilityPreprocessing(
  params: AIAgentParamsParsed,
  bubbleContext: BubbleContext | undefined,
  resolveCapabilityCredentials: ResolveCapabilityCredentials
): Promise<AIAgentParamsParsed> {
  const caps = params.capabilities ?? [];
  if (caps.length > 1) {
    // Multi-capability delegator: use Gemini 3 Pro for reliable tool-calling / routing.
    // Sub-agents apply their own modelConfigOverride in single-cap mode.
    params.model.model = RECOMMENDED_MODELS.BEST as typeof params.model.model;
    params.model.reasoningEffort = undefined;
  } else {
    // Single-cap: apply that capability's model override directly
    for (const capConfig of caps) {
      const capDef = getCapability(capConfig.id);
      const override = capDef?.metadata.modelConfigOverride;
      if (!override) continue;
      if (override.model)
        params.model.model = override.model as typeof params.model.model;
      if (override.reasoningEffort)
        params.model.reasoningEffort = override.reasoningEffort;
      if (override.maxTokens)
        params.model.maxTokens = Math.max(
          params.model.maxTokens ?? 0,
          override.maxTokens
        );
    }
  }

  // Inject capability system prompts
  if (caps.length > 1) {
    // Multi-capability: summaries with tool names + delegation hints — sub-agents get full prompts
    const summaries = caps
      .map((c, idx) => {
        const def = getCapability(c.id);
        if (!def) return null;
        const toolNames = def.metadata.tools.map((t) => t.name).join(', ');
        let summary = `${idx + 1}. "${def.metadata.name}" (id: ${c.id})\n   Purpose: ${def.metadata.description}`;
        if (toolNames) summary += `\n   Tools: ${toolNames}`;
        if (def.metadata.delegationHint)
          summary += `\n   When to use: ${def.metadata.delegationHint}`;
        return summary;
      })
      .filter((summary): summary is string => Boolean(summary));

    params.systemPrompt += `\n\n---\nSYSTEM CAPABILITY EXTENSIONS:\nMultiple specialized capabilities are available. You MUST delegate to them using the 'use-capability' tool.\n\nAvailable Capabilities:\n${summaries.join('\n\n')}\n\nDELEGATION RULES:\n- Use 'use-capability' tool to delegate tasks to the appropriate capability\n- Do NOT attempt to handle capability tasks yourself\n- Include full context when delegating, including all known user details and preferences from context (especially timezone)\n- Can chain multiple capabilities if needed\n- Only respond directly for: greetings, clarifications, or tasks outside all capabilities\n---\n\nYour role is to understand the user's request and delegate to the appropriate capability or respond directly when appropriate.`;
  } else {
    // Single or zero capabilities: eager load as before
    for (const capConfig of caps) {
      const capDef = getCapability(capConfig.id);
      if (!capDef) continue;

      const ctx: CapabilityRuntimeContext = {
        credentials: resolveCapabilityCredentials(capDef, capConfig),
        inputs: capConfig.inputs ?? {},
        bubbleContext,
      };

      const addition =
        (await capDef.createSystemPrompt?.(ctx)) ??
        capDef.metadata.systemPromptAddition;

      if (addition) {
        params.systemPrompt = `${params.systemPrompt}\n\n---\nSYSTEM CAPABILITY EXTENSION:\nThe following capability has been added to enhance your functionality:\n\n[${capDef.metadata.name}]\n${addition}\n---\n\nYour primary objective is to fulfill the user's request using both your base capabilities and the extended capability above.`;
      }
    }
  }

  return params;
}

export async function applyCapabilityPostprocessing(
  result: AIAgentResult,
  params: AIAgentParamsParsed,
  bubbleContext: BubbleContext | undefined,
  resolveCapabilityCredentials: ResolveCapabilityCredentials
): Promise<AIAgentResult> {
  let updated = result;
  updated = await applyCapabilityResponseAppend(
    updated,
    params,
    bubbleContext,
    resolveCapabilityCredentials
  );
  updated = applyConversationHistoryNotice(updated, params);
  return updated;
}

async function applyCapabilityResponseAppend(
  result: AIAgentResult,
  params: AIAgentParamsParsed,
  bubbleContext: BubbleContext | undefined,
  resolveCapabilityCredentials: ResolveCapabilityCredentials
): Promise<AIAgentResult> {
  const caps = params.capabilities ?? [];
  // Multi-cap: sub-agents handle their own responseAppend
  if (caps.length > 1) return result;

  const appendParts: string[] = [];
  for (const capConfig of caps) {
    const capDef = getCapability(capConfig.id);
    if (!capDef?.createResponseAppend) continue;

    const ctx: CapabilityRuntimeContext = {
      credentials: resolveCapabilityCredentials(capDef, capConfig),
      inputs: capConfig.inputs ?? {},
      bubbleContext,
    };

    const text = await capDef.createResponseAppend(ctx);
    if (text) appendParts.push(text);
  }

  if (appendParts.length > 0) {
    return {
      ...result,
      response: `${result.response}\n\n${appendParts.join('\n\n')}`,
    };
  }
  return result;
}

function applyConversationHistoryNotice(
  result: AIAgentResult,
  params: AIAgentParamsParsed
): AIAgentResult {
  const caps = params.capabilities ?? [];
  // Show for any capability-enabled main agent, not delegated sub-agents
  if (caps.length === 0 || params.name?.startsWith('Capability Agent: ')) {
    return result;
  }

  const hasHistory =
    params.conversationHistory && params.conversationHistory.length > 0;
  if (hasHistory) return result;

  const notice =
    '---\n💡 **Conversation History Not Available**\n\n' +
    "I don't have access to our previous conversation or know what time it is for you, so I might ask you to repeat some information. " +
    'To enable conversation history and make our chat more seamless, you can ask Pearl in Bubble Studio to add conversation history support to this bubble.';
  const separator = result.response?.trim().length ? '\n\n' : '';
  return {
    ...result,
    response: `${result.response}${separator}${notice}`,
  };
}
