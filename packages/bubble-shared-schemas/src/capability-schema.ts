import { z } from 'zod';
import { CredentialType, type BubbleName } from './types.js';

/**
 * String literal union of all known capability IDs.
 * Runtime validation stays permissive (any non-empty string); TypeScript narrows.
 */
export type CapabilityId =
  | 'knowledge-base'
  | 'google-doc-knowledge-base'
  | 'data-analyst'
  | 'chart-maker'
  | 'gmail-assistant'
  | 'google-calendar'
  | 'jira-assistant'
  | 'notion-assistant'
  | 'stripe-assistant'
  | 'airtable-assistant'
  | 'github-assistant'
  | 'ashby-assistant'
  | 'google-sheets-assistant'
  | 'slack-assistant'
  | 'google-drive-assistant'
  | 'confluence-assistant'
  | 'telegram-assistant'
  | 'resend-assistant'
  | 'eleven-labs-assistant'
  | 'firecrawl-assistant'
  | 'apify-assistant'
  | 'browserbase-assistant'
  | 'crustdata-assistant'
  | 'fullenrich-assistant'
  | 'followupboss-assistant';

/**
 * Schema for a provider entry in a capability's metadata.
 * Used by the wizard to render a data-driven "Choose Providers" step.
 */
export const CapabilityProviderMetadataSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  credentialType: z.nativeEnum(CredentialType),
  icon: z.string().min(1),
});
export type CapabilityProviderMetadata = z.infer<
  typeof CapabilityProviderMetadataSchema
>;

/**
 * Schema for a single input parameter that a capability accepts.
 * Inputs are user-configurable values (e.g., a Google Doc ID).
 */
export const CapabilityInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'string[]']),
  label: z.string().optional(),
  description: z.string(),
  required: z.boolean().default(true),
  default: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string())])
    .optional(),
});
export type CapabilityInput = z.infer<typeof CapabilityInputSchema>;

/**
 * Schema for a tool definition exposed by a capability.
 * Contains only serializable metadata (name, description, parameter JSON schema).
 */
export const CapabilityToolDefSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameterSchema: z.record(z.string(), z.unknown()),
  /** Bubble names used internally by this tool (e.g., ['google-drive']). Used for dependency graph hierarchy. */
  internalBubbles: z.array(z.string() as z.ZodType<BubbleName>).optional(),
});
export type CapabilityToolDef = z.infer<typeof CapabilityToolDefSchema>;

/**
 * Schema for optional model configuration overrides applied by a capability at runtime.
 */
export const CapabilityModelConfigOverrideSchema = z.object({
  model: z.string().optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  maxTokens: z.number().positive().optional(),
});
export type CapabilityModelConfigOverride = z.infer<
  typeof CapabilityModelConfigOverrideSchema
>;

/**
 * Serializable capability metadata — used by frontend, parser, and capabilities.json.
 * Does NOT contain runtime logic (tool functions, factories).
 */
export const CapabilityMetadataSchema = z.object({
  id: z.string().min(1) as z.ZodType<CapabilityId>,
  name: z.string().min(1),
  description: z.string(),
  icon: z.string().optional(),
  category: z.string().optional(),
  version: z.string().default('1.0.0'),
  requiredCredentials: z.array(z.nativeEnum(CredentialType)),
  optionalCredentials: z.array(z.nativeEnum(CredentialType)).optional(),
  inputs: z.array(CapabilityInputSchema),
  tools: z.array(CapabilityToolDefSchema),
  systemPromptAddition: z.string().optional(),
  modelConfigOverride: CapabilityModelConfigOverrideSchema.optional(),
  /**
   * Short guidance for the main agent on when to delegate to this capability
   * in multi-capability mode. E.g. "Delegate when the user asks to remember,
   * save notes, or look up documents."
   */
  delegationHint: z.string().optional(),
  /** Hidden capabilities are registered for runtime use but not shown in the UI. */
  hidden: z.boolean().optional(),
  /** Data-driven provider options for the wizard "Choose Providers" step. */
  providers: z.array(CapabilityProviderMetadataSchema).optional(),
});
export type CapabilityMetadata = z.infer<typeof CapabilityMetadataSchema>;
