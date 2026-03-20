import type { BubbleContext } from '../../types/bubble.js';
import {
  RECOMMENDED_MODELS,
  type CredentialType,
  type CredentialPoolEntry,
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
  resolveCapabilityCredentials: ResolveCapabilityCredentials,
  credentialPool?: Partial<Record<CredentialType, CredentialPoolEntry[]>>
): Promise<AIAgentParamsParsed> {
  const caps = params.capabilities ?? [];
  if (caps.length > 1) {
    // Multi-capability delegator: use Sonnet for reliable tool-calling / routing.
    // Sub-agents apply their own modelConfigOverride in single-cap mode.
    params.model.model = RECOMMENDED_MODELS.CHAT as typeof params.model.model;
    params.model.reasoningEffort = 'medium';
  } else {
    // Single-cap: sub-agents (multi-cap delegation) default to Gemini 3 Flash + low thinking
    const isSubAgent = params.name?.startsWith('Capability Agent: ');
    if (isSubAgent) {
      params.model.model =
        RECOMMENDED_MODELS.GOOGLE_FLAGSHIP as typeof params.model.model;
      params.model.reasoningEffort = 'low';
    }
    // Apply capability modelConfigOverride on top (capabilities can override model/thinking)
    for (const capConfig of caps) {
      const capDef = getCapability(capConfig.id);
      const override = capDef?.metadata.modelConfigOverride;
      if (!override) continue;
      if (override.model)
        params.model.model = override.model as typeof params.model.model;
      if (override.reasoningEffort !== undefined)
        params.model.reasoningEffort =
          override.reasoningEffort === 'none'
            ? undefined
            : override.reasoningEffort;
      if (override.maxTokens)
        params.model.maxTokens = Math.max(
          params.model.maxTokens ?? 0,
          override.maxTokens
        );
      if (override.maxIterations) params.maxIterations = override.maxIterations;
    }
  }

  // Inject capability system prompts
  if (caps.length > 1) {
    // Multi-capability: summaries with tool names + delegation hints — sub-agents get full prompts
    const summaries = (
      await Promise.all(
        caps.map(async (c, idx) => {
          const def = getCapability(c.id);
          if (!def) return null;
          let summary = `${idx + 1}. "${def.metadata.name}" (id: ${c.id})\n   Purpose: ${def.metadata.description}`;

          // Resolve async delegation hint (mirrors systemPrompt pattern)
          let hint: string | undefined;
          if (def.createDelegationHint) {
            try {
              const ctx: CapabilityRuntimeContext = {
                credentials: resolveCapabilityCredentials(def, c),
                inputs: c.inputs ?? {},
                bubbleContext,
              };
              hint = await def.createDelegationHint(ctx);
            } catch {
              // Fall through to static metadata hint
            }
          }
          hint ??= def.metadata.delegationHint;
          if (hint) summary += `\n   When to use: ${hint}`;

          // List available credentials when multiple exist for a type
          if (credentialPool) {
            const capCredTypes = [
              ...def.metadata.requiredCredentials,
              ...(def.metadata.optionalCredentials ?? []),
            ];
            for (const credType of capCredTypes) {
              const pool = credentialPool[credType];
              if (pool && pool.length > 1) {
                summary += `\n   Available ${credType} accounts:`;
                for (const entry of pool) {
                  // Sanitize name to prevent prompt injection via credential names
                  const safeName = entry.name
                    .replace(/[\n\r]/g, ' ')
                    .slice(0, 100);
                  summary += `\n   - "${safeName}"`;
                }
                summary += `\n   Pass 'credentials: { ${credType}: "<account name>" }' to use-capability to select a specific account.`;
              }
            }
          }

          return summary;
        })
      )
    ).filter((summary): summary is string => Boolean(summary));

    params.systemPrompt += `\n\n---\nSYSTEM CAPABILITY EXTENSIONS:\nMultiple specialized capabilities are available. You MUST delegate to them using the 'use-capability' tool.\n\nAvailable Capabilities:\n${summaries.join('\n\n')}\n\nDELEGATION RULES:\n- Use 'use-capability' tool to delegate tasks to the appropriate capability\n- Do NOT attempt to handle capability tasks yourself\n- Include full context when delegating, including all known user details and preferences from context (especially timezone)\n- Can chain multiple capabilities if needed\n- Only respond directly for: greetings, clarifications, or tasks outside all capabilities\n- IMPORTANT: The user CANNOT see tool results from delegate agents. You MUST re-present all information, data, tables, and results returned by delegates in your own response. Never say "as shown above" or assume the user saw the delegate's output.\n- PRESERVE ALL LINKS: When a delegate returns URLs or clickable links (e.g., HubSpot record links, Jira ticket links, document URLs), you MUST include them in your response. Never drop links when reformatting tables — links are critical for the user to navigate to the source. If a table has too many rows to include all links, include links for at least the top/highlighted records.\n- When a delegate returns image or photo URLs, include them directly in your response on their own line as a bare URL (no markdown formatting). The chat client will automatically render the image inline from the URL. NEVER call read_image on URLs returned by delegates.\n- Before asking the user for information you don't have, check if any connected capability could help you find or look up that information first. Prefer proactive discovery over asking.\n- CAPABILITY QUESTIONS: When a user asks whether a capability supports a specific feature, what tools are available, or what parameters a tool accepts, you MUST call get_capabilities with the capability id before answering. Tool names alone do not describe what tools can do — you need the full signatures. NEVER answer capability questions from memory alone. NEVER claim a capability cannot do something without checking first.\n---\n\nYour role is to understand the user's request and delegate to the appropriate capability or respond directly when appropriate.`;
  } else {
    // Single or zero capabilities: eager load as before
    for (const capConfig of caps) {
      const capDef = getCapability(capConfig.id);
      if (!capDef) continue;

      const ctx: CapabilityRuntimeContext = {
        credentials: resolveCapabilityCredentials(capDef, capConfig),
        inputs: capConfig.inputs ?? {},
        bubbleContext,
        context: capConfig.context,
      };

      const addition =
        (await capDef.createSystemPrompt?.(ctx)) ??
        capDef.metadata.systemPromptAddition;

      if (addition || capConfig.context) {
        let capPrompt = `${params.systemPrompt}\n\n---\nSYSTEM CAPABILITY EXTENSION:\nThe following capability has been added to enhance your functionality:\n\n[${capDef.metadata.name}]`;
        if (addition) {
          capPrompt += `\n${addition}`;
        }
        if (capConfig.context) {
          capPrompt += `\n\n**Workspace Context:**\n${capConfig.context}`;
        }
        capPrompt += `\n---\n\nYour primary objective is to fulfill the user's request using both your base capabilities and the extended capability above.\nAlways use the user's timezone for all time-related operations. If the user's timezone is known from context (conversation history, user profile), apply it consistently. If unknown, ask before making time-sensitive decisions.`;
        params.systemPrompt = capPrompt;
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
  updated = applyConversationHistoryNotice(updated, params, bubbleContext);
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

/**
 * Detects conversation history that wasn't properly enhanced (e.g. Slack thread
 * history fell back to raw user IDs instead of display names due to rate limits).
 * Pattern: first user message starts with a Slack user ID like "U0831C0BXEX:"
 */
function hasUnenhancedConversationHistory(
  history: AIAgentParamsParsed['conversationHistory']
): boolean {
  if (!history || history.length === 0) return false;
  const firstUserMsg = history.find((m) => m.role === 'user');
  if (!firstUserMsg) return false;
  const name = firstUserMsg.content.split(':')[0]?.trim();
  if (!name) return false;
  return /^U[A-Z0-9]{8,12}$/.test(name);
}

function applyConversationHistoryNotice(
  result: AIAgentResult,
  params: AIAgentParamsParsed,
  bubbleContext: BubbleContext | undefined
): AIAgentResult {
  // Only relevant for Slack bot flows
  if (!bubbleContext?.executionMeta?._isSlackBot) {
    return result;
  }
  const caps = params.capabilities ?? [];
  // Show for any capability-enabled main agent, not delegated sub-agents
  if (caps.length === 0 || params.name?.startsWith('Capability Agent: ')) {
    return result;
  }

  const hasHistory =
    params.conversationHistory && params.conversationHistory.length > 0;

  let notice: string | null = null;

  if (
    hasHistory &&
    hasUnenhancedConversationHistory(params.conversationHistory)
  ) {
    notice =
      '---\n⚠️ **Conversation History Temporarily Unavailable**\n\n' +
      "I couldn't remember your past conversation at the moment due to a rate limit. " +
      'Please contact the Bubble Lab team if this issue persists.';
  } else if (!hasHistory) {
    notice =
      '---\n💡 **Conversation History Not Available**\n\n' +
      "I don't have access to our previous conversation at the moment, so I might ask you to repeat some information. " +
      'This may be due to a temporary issue with Slack. Please try again in a few minutes.';
  }

  if (!notice) return result;

  const separator = result.response?.trim().length ? '\n\n' : '';
  return {
    ...result,
    response: `${result.response}${separator}${notice}`,
  };
}
