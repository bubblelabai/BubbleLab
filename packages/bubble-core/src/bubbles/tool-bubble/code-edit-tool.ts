/**
 * EDIT BUBBLEFLOW TOOL
 *
 * A tool bubble that applies code edits to BubbleFlow files using find-and-replace.
 * This tool performs simple string replacement matching Claude Code's Edit tool behavior.
 *
 * Features:
 * - Exact string find-and-replace
 * - Uniqueness validation (prevents ambiguous edits)
 * - Replace-all mode for renaming variables/strings
 * - No external API calls required
 */

import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';

// ---------------------------------------------------------------------------
// Standalone find-and-replace utility (reusable outside the ToolBubble class)
// ---------------------------------------------------------------------------

export interface CodeEditResult {
  code: string;
  applied: boolean;
  error?: string;
}

function countOccurrences(str: string, substr: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

/**
 * Apply a find-and-replace edit to source code.
 *
 * - `oldString` must exist in `initialCode`.
 * - Unless `replaceAll` is true, `oldString` must be unique (appear exactly once).
 * - `newString` must differ from `oldString`.
 */
export function applyCodeEdit(
  initialCode: string,
  oldString: string,
  newString: string,
  replaceAll = false
): CodeEditResult {
  if (!initialCode || initialCode.trim().length === 0) {
    return { code: '', applied: false, error: 'Initial code cannot be empty' };
  }
  if (!oldString || oldString.length === 0) {
    return {
      code: initialCode,
      applied: false,
      error: 'old_string cannot be empty',
    };
  }
  if (oldString === newString) {
    return {
      code: initialCode,
      applied: false,
      error: 'new_string must be different from old_string',
    };
  }
  if (!initialCode.includes(oldString)) {
    return {
      code: initialCode,
      applied: false,
      error: 'old_string not found in code',
    };
  }

  if (replaceAll) {
    return {
      code: initialCode.replaceAll(oldString, newString),
      applied: true,
    };
  }

  const count = countOccurrences(initialCode, oldString);
  if (count > 1) {
    return {
      code: initialCode,
      applied: false,
      error:
        'old_string is not unique in the code. Provide a larger string with more surrounding context to make it unique, or use replace_all to change every instance.',
    };
  }

  const index = initialCode.indexOf(oldString);
  const result =
    initialCode.slice(0, index) +
    newString +
    initialCode.slice(index + oldString.length);
  return { code: result, applied: true };
}

/**
 * Define the parameters schema using Zod
 * This schema validates and types the input parameters for the edit tool
 */
const EditBubbleFlowToolParamsSchema = z.object({
  // The current code to apply the edit to
  initialCode: z.string().describe('The current code to apply the edit to'),

  // The exact text to replace
  old_string: z
    .string()
    .describe(
      'The exact text to replace. Must be unique in the code — if not unique, provide more surrounding context to disambiguate.'
    ),

  // The replacement text
  new_string: z
    .string()
    .describe('The replacement text. Must be different from old_string.'),

  // Whether to replace all occurrences
  replace_all: z
    .boolean()
    .default(false)
    .optional()
    .describe(
      'Replace all occurrences of old_string (default false). Use for renaming variables/strings across the file.'
    ),

  // Credentials (injected at runtime)
  credentials: z
    .record(z.string(), z.string())
    .optional()
    .describe('Credentials (HIDDEN from AI - injected at runtime)'),

  // Optional configuration
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Configuration for the edit tool (HIDDEN from AI - injected at runtime)'
    ),
});

/**
 * Type definitions derived from schemas
 */
type EditBubbleFlowToolParams = z.output<typeof EditBubbleFlowToolParamsSchema>;
type EditBubbleFlowToolResult = z.output<typeof EditBubbleFlowToolResultSchema>;

/**
 * Define the result schema
 * This schema defines what the edit tool returns
 */
const EditBubbleFlowToolResultSchema = z.object({
  // The final merged code
  mergedCode: z.string().describe('The final code after applying edits'),

  // Success indicator
  applied: z.boolean().describe('Whether the edit was successfully applied'),

  // Standard result fields
  success: z.boolean().describe('Whether the edit operation was successful'),
  error: z.string().describe('Error message if edit failed'),
});

/**
 * Edit BubbleFlow Tool
 * Applies code edits using find-and-replace
 */
export class EditBubbleFlowTool extends ToolBubble<
  EditBubbleFlowToolParams,
  EditBubbleFlowToolResult
> {
  /**
   * REQUIRED STATIC METADATA
   */

  // Bubble type - always 'tool' for tool bubbles
  static readonly type = 'tool' as const;

  // Unique identifier for the tool
  static readonly bubbleName = 'code-edit-tool';

  // Schemas for validation
  static readonly schema = EditBubbleFlowToolParamsSchema;
  static readonly resultSchema = EditBubbleFlowToolResultSchema;

  // Short description
  static readonly shortDescription =
    'Applies code edits to BubbleFlow files using find-and-replace';

  // Long description with detailed information
  static readonly longDescription = `
    A tool for applying code edits to BubbleFlow TypeScript files using find-and-replace.

    What it does:
    - Finds exact text matches in code and replaces them
    - Validates uniqueness to prevent ambiguous edits
    - Supports replace-all mode for renaming variables/strings
    - No external API calls required

    How it works:
    - Takes the current code, old_string (text to find), and new_string (replacement)
    - Validates that old_string exists and is unique (unless replace_all is true)
    - Performs the replacement and returns the updated code

    Use cases:
    - When an AI agent needs to make edits to BubbleFlow code
    - When making targeted changes without rewriting entire files
    - When renaming variables or strings across a file

    Important:
    - old_string must be an exact match of text in the code
    - If old_string appears multiple times, provide more context or use replace_all
    - new_string must be different from old_string
  `;

  // Short alias for the tool
  static readonly alias = 'code-edit';

  /**
   * Main action method - performs find-and-replace code editing
   */
  async performAction(): Promise<EditBubbleFlowToolResult> {
    try {
      const { initialCode, old_string, new_string, replace_all } = this.params;

      const result = applyCodeEdit(
        initialCode,
        old_string,
        new_string,
        replace_all ?? false
      );

      return {
        mergedCode: result.code,
        applied: result.applied,
        success: result.applied,
        error: result.error ?? '',
      };
    } catch (error) {
      return {
        mergedCode: this.params.initialCode || '',
        applied: false,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
