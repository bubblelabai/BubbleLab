import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Checks if a value is a Zod schema object
 * Detects Zod schemas by checking for the internal _def property with typeName
 */
export function isZodSchema(value: unknown): value is ZodTypeAny {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value &&
    typeof (value as { _def?: unknown })._def === 'object' &&
    (value as { _def?: { typeName?: string } })._def?.typeName !== undefined
  );
}

/**
 * Converts a Zod schema or JSON schema string to a JSON schema string
 * If already a string, returns as-is. If Zod schema, converts to JSON schema.
 *
 * @param schema - Either a Zod schema object or a JSON schema string
 * @param schemaName - Optional name for the schema (default: 'OutputSchema')
 * @returns JSON schema as a string
 */
export function zodSchemaToJsonString(
  schema: ZodTypeAny | string,
  schemaName = 'OutputSchema'
): string {
  if (typeof schema === 'string') {
    return schema;
  }

  if (isZodSchema(schema)) {
    return JSON.stringify(zodToJsonSchema(schema, schemaName));
  }

  // Fallback: try to stringify if it's an object
  return JSON.stringify(schema);
}

/**
 * Builds a system prompt instruction for JSON output with a specific schema
 * This standardizes how we tell LLMs to output structured JSON
 *
 * @param schemaString - The JSON schema as a string
 * @returns Instruction text to append to system prompt
 */
export function buildJsonSchemaInstruction(schemaString: string): string {
  return `
OUTPUT FORMAT REQUIREMENTS:
Your response MUST be valid JSON. The schema below describes the STRUCTURE your output should follow.

JSON Schema (this describes the format - do NOT include schema keywords in your output):
${schemaString}

IMPORTANT - UNDERSTAND THE DIFFERENCE:
- The schema uses keywords like "type", "properties", "items" to DESCRIBE the format
- Your output should contain the ACTUAL DATA, not these schema keywords

Example of what the schema means:
- Schema: {"type": "object", "properties": {"name": {"type": "string"}, "age": {"type": "number"}}}
- Your output: {"name": "John", "age": 30}
- WRONG output: {"type": "object", "properties": {"name": "John", "age": 30}}

CRITICAL JSON RULES:
- Return ONLY the data as valid JSON - no markdown, no code blocks, no explanations
- Start your response directly with { or [
- Do NOT include "type", "properties", "$schema", "items", "required" in your output
- Use double quotes for all strings and property names
- No trailing commas, no single quotes
- Properly escape special characters in strings
`.trim();
}
