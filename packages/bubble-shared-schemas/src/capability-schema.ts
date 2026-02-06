import { z } from 'zod';
import { CredentialType, type BubbleName } from './types.js';

/**
 * Schema for a single input parameter that a capability accepts.
 * Inputs are user-configurable values (e.g., a Google Doc ID).
 */
export const CapabilityInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string(),
  required: z.boolean().default(true),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
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
 * Serializable capability metadata — used by frontend, parser, and capabilities.json.
 * Does NOT contain runtime logic (tool functions, factories).
 */
export const CapabilityMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  icon: z.string().optional(),
  category: z.string().optional(),
  version: z.string().default('1.0.0'),
  requiredCredentials: z.array(z.nativeEnum(CredentialType)),
  inputs: z.array(CapabilityInputSchema),
  tools: z.array(CapabilityToolDefSchema),
  systemPromptAddition: z.string().optional(),
});
export type CapabilityMetadata = z.infer<typeof CapabilityMetadataSchema>;
