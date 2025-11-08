import { z } from 'zod';
import type {
  DatabaseMetadata,
  CredentialOptions,
  DependencyGraphNode,
  BubbleOperationResult,
  BubbleResult,
} from '@bubblelab/shared-schemas';
import type { BubbleLogger } from '../logging/BubbleLogger';

// Core Bubble interface
export interface IBubble<
  TResult extends BubbleOperationResult = BubbleOperationResult,
> {
  readonly name: string;
  readonly schema: z.ZodObject<z.ZodRawShape>;
  readonly resultSchema: z.ZodObject<z.ZodRawShape>;
  readonly shortDescription: string;
  readonly longDescription: string;
  readonly alias?: string;
  readonly type: 'service' | 'workflow' | 'tool' | 'ui' | 'infra';

  // Saves the previous result (base shape to support cached returns generically)
  previousResult: BubbleResult<BubbleOperationResult> | undefined;

  action: () => Promise<BubbleResult<TResult>>;
  // Accept any BubbleOperationResult shape for saved results
  saveResult: <R extends BubbleOperationResult>(
    result: BubbleResult<R>
  ) => void;
  clearSavedResult: () => void;
  generateMockResult: () => BubbleResult<TResult>;
  generateMockResultWithSeed: (seed: number) => BubbleResult<TResult>;
}

// Service Bubble - API integrations like Gmail, Slack
export interface IServiceBubble<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TResult extends BubbleOperationResult = BubbleOperationResult,
> extends IBubble<TResult> {
  readonly type: 'service';
  authType?: 'oauth' | 'apikey' | 'none' | 'connection-string';
  // Test the credential by making a test API call
  testCredential: () => Promise<boolean>;
  setParam: <K extends keyof TParams>(
    paramName: K,
    paramValue: TParams[K]
  ) => void;
  getCredentialMetadata: () => Promise<DatabaseMetadata | undefined>;
}

// Workflow Bubble - combined operations
export interface IWorkflowBubble<
  TResult extends BubbleOperationResult = BubbleOperationResult,
> extends IBubble<TResult> {
  readonly type: 'workflow';
}

// Tool Bubble - tools that can be used in a workflow
export interface IToolBubble<
  TResult extends BubbleOperationResult = BubbleOperationResult,
> extends IBubble<TResult> {
  readonly type: 'tool';
}

// UI Bubble - generate React templates
export interface IUIBubble extends IBubble {
  readonly type: 'ui';
  template: string;
}

// Infrastructure Bubble - cloud services
export interface IInfraBubble extends IBubble {
  readonly type: 'infra';
  provider: 'aws' | 'gcp' | 'supabase';
  resourceType: string;
}

export type BubbleFlowOperationResult = unknown;

// Bubble context for execution
export interface BubbleContext {
  logger?: BubbleLogger;
  variableId?: number;
  /**
   * Dependency graph for the current bubble flow, used to deduce child variable IDs.
   */
  dependencyGraph?: DependencyGraphNode;
  /**
   * The unique hierarchical id of the current bubble within the dependency graph.
   * Root is typically something like `${bubbleName}#1`.
   */
  currentUniqueId?: string;
  /**
   * Internal usage counters keyed by `${currentUniqueId||'ROOT'}|${childName}` to derive next ordinal.
   */
  __uniqueIdCounters__?: Record<string, number>;
  [key: string]: unknown;
}

// Type constraint for service bubble parameters that require credentials
export type ServiceBubbleParams<T = unknown> = T & {
  credentials?: CredentialOptions;
  retries?: number;
};
