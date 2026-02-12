import type { z } from 'zod';

/**
 * Represents an interactive element extracted from the page.
 * Used to provide context to the AI for suggesting recovery actions.
 */
export interface InteractiveElement {
  tagName: string;
  role?: string;
  name?: string; // aria-label or text content
  id?: string;
  selector: string; // CSS selector
  boundingBox: { x: number; y: number; width: number; height: number };
  isVisible: boolean;
  isEnabled: boolean;
}

/**
 * Possible actions the AI can suggest for error recovery.
 */
export type AIBrowserAction =
  | { action: 'click'; selector: string }
  | { action: 'click_coordinates'; coordinates: [number, number] }
  | { action: 'type'; selector: string; value: string }
  | { action: 'scroll'; direction: 'up' | 'down'; amount: number }
  | { action: 'wait'; milliseconds: number }
  | { action: 'extract'; data: unknown } // AI extracted data matching schema
  | { action: 'none'; reason: string };

/**
 * Context provided to the AI for recovery decision making.
 */
export interface AIRecoveryContext {
  taskDescription: string;
  errorMessage: string;
  currentUrl: string;
  screenshotBase64: string;
  interactiveElements: InteractiveElement[];
}

/**
 * Configuration for the AI browser agent.
 */
export interface AIBrowserAgentConfig {
  sessionId: string;
  context?: unknown; // BubbleContext
  credentials?: Record<string, string>;
}

/**
 * Result of an AI recovery attempt.
 */
export interface AIRecoveryResult {
  success: boolean;
  action: AIBrowserAction;
  error?: string;
}

/**
 * Extended options for RecordableStep with AI fallback support.
 */
export interface AIFallbackOptions {
  /** Enable AI fallback for error recovery */
  aiFallback?: boolean;
  /** Additional context for the AI about what this step is trying to accomplish */
  taskDescription?: string;
  /** Zod schema for data extraction - when provided, AI extracts data matching the schema */
  extractionSchema?: z.ZodType<unknown>;
}
