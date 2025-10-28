import { z } from 'zod';
import { randomUUID } from 'crypto';
import type {
  IBubble,
  BubbleContext,
  BubbleResult,
  BubbleOperationResult,
} from '@bubblelab/bubble-core';
import type { BubbleName } from '@bubblelab/shared-schemas';
import { MockDataGenerator } from '@bubblelab/shared-schemas';
import type { DependencyGraphNode } from '@bubblelab/shared-schemas';
import {
  BubbleValidationError,
  BubbleExecutionError,
} from './bubble-errors.js';
import { sanitizeParams } from '../utils/param-helper.js';

/**
 * Abstract base class for all bubble types
 * Implements common properties and methods defined in IBubble interface
 */
export abstract class BaseBubble<
  TParams = unknown,
  TResult extends BubbleOperationResult = BubbleOperationResult,
> implements IBubble<TResult>
{
  public readonly name: string;
  public readonly schema: z.ZodObject<z.ZodRawShape>;
  public readonly resultSchema: z.ZodObject<z.ZodRawShape>;
  public readonly shortDescription: string;
  public readonly longDescription: string;
  public readonly alias?: string;
  public abstract readonly type:
    | 'service'
    | 'workflow'
    | 'tool'
    | 'ui'
    | 'infra';

  protected readonly params: TParams;
  protected context?: BubbleContext;
  public previousResult: BubbleResult<BubbleOperationResult> | undefined;

  constructor(params: unknown, context?: BubbleContext) {
    // Use static properties from the class - typed as required static metadata
    const ctor = this.constructor as typeof BaseBubble & {
      readonly bubbleName: BubbleName;
      readonly schema: z.ZodObject<z.ZodRawShape>;
      readonly resultSchema: z.ZodObject<z.ZodRawShape>;
      readonly shortDescription: string;
      readonly longDescription: string;
      readonly alias?: string;
      readonly secret: boolean;
    };

    this.name = ctor.bubbleName;
    this.schema = ctor.schema;
    this.resultSchema = ctor.resultSchema;
    this.shortDescription = ctor.shortDescription;
    this.longDescription = ctor.longDescription;
    this.alias = ctor.alias;

    try {
      this.params = this.schema.parse(params) as TParams;
      // Enrich context with child variableId/currentUniqueId if dependencyGraph is provided
      if (context && context.dependencyGraph && context.currentUniqueId) {
        console.debug('[BaseBubble] Computing child context');
        const next = this.computeChildContext(context);
        this.context = next;
        console.debug(
          '[BaseBubble] Computed child context unique id:',
          this.context?.currentUniqueId
        );
        //Prnt the var id of the computed child context
        console.debug(
          '[BaseBubble] Computed child context variable id:',
          this.context?.variableId
        );
      } else {
        this.context = context;
      }
    } catch (error) {
      const errorMessage =
        error instanceof z.ZodError
          ? `Input Schema validation failed: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          : `Input Schema validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`;

      throw new BubbleValidationError(errorMessage, {
        variableId: context?.variableId,
        bubbleName: ctor.bubbleName,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Compute child context based on dependency graph and current unique id.
   * Finds the node matching currentUniqueId, then determines this child's unique id as
   * `${currentUniqueId}.${this.name}#k` for the next ordinal k, and assigns the variableId from
   * the dependency graph if present, otherwise keeps parent's variableId.
   */
  private computeChildContext(parentContext: BubbleContext): BubbleContext {
    const graph = parentContext.dependencyGraph;
    const currentId = parentContext.currentUniqueId || '';
    if (!graph) return parentContext;

    // Depth-first search to find node by uniqueId
    const findByUniqueId = (
      node: DependencyGraphNode,
      target: string
    ): DependencyGraphNode | null => {
      if ((node as any).uniqueId === target) return node;
      for (const child of node.dependencies || []) {
        const found = findByUniqueId(child, target);
        if (found) return found;
      }
      return null;
    };

    const parentNode = currentId ? findByUniqueId(graph, currentId) : graph;

    // If the current bubble matches the node at currentUniqueId, don't advance; keep IDs from that node
    if (parentNode && parentNode.name === this.name) {
      const sameNodeVarId =
        (parentNode as unknown as { variableId?: number }).variableId ??
        parentContext.variableId;
      return {
        ...parentContext,
        variableId: sameNodeVarId,
        currentUniqueId: currentId,
        __uniqueIdCounters__: { ...(parentContext.__uniqueIdCounters__ || {}) },
      };
    }

    // Determine this bubble's ordinal under the parent using a counter map
    const children = parentNode?.dependencies || [];
    const counterKey = `${currentId || 'ROOT'}|${this.name}`;
    const counters = { ...(parentContext.__uniqueIdCounters__ || {}) };
    const ordinal = (counters[counterKey] || 0) + 1;
    counters[counterKey] = ordinal;
    // Try to select the nth child by name for an exact uniqueId match
    const sameNameChildren = children.filter((c) => c.name === this.name);
    const selectedChild = sameNameChildren[ordinal - 1];
    const childUniqueId =
      (selectedChild as unknown as { uniqueId?: string })?.uniqueId ||
      (currentId
        ? `${currentId}.${this.name}#${ordinal}`
        : `${this.name}#${ordinal}`);

    // Try to find a matching child node to get variableId; fallback to parent's
    const matchingChild =
      (selectedChild as unknown as {
        variableId?: number;
        uniqueId?: string;
      }) ||
      children.find(
        (c) => c.uniqueId === childUniqueId || c.name === this.name
      );
    const childVariableId =
      (matchingChild && typeof matchingChild.variableId === 'number'
        ? matchingChild.variableId
        : parentContext.variableId) || parentContext.variableId;

    return {
      ...parentContext,
      variableId: childVariableId,
      currentUniqueId: childUniqueId,
      __uniqueIdCounters__: counters,
    };
  }
  saveResult<R extends BubbleOperationResult>(result: BubbleResult<R>): void {
    this.previousResult = result as BubbleResult<BubbleOperationResult>;
  }

  clearSavedResult(): void {
    this.previousResult = undefined;
  }

  /**
   * Override toJSON to prevent credential leaking via JSON.stringify or console.log
   * Only exposes safe metadata, never params which may contain credentials
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      shortDescription: this.shortDescription,
      alias: this.alias,
      // Explicitly exclude params, context, and previousResult
      // These may contain sensitive credentials
    };
  }

  /**
   * Execute the bubble - just runs the action
   */
  async action(): Promise<BubbleResult<TResult>> {
    const logger = this.context?.logger;
    logger?.logBubbleExecution(
      this.context?.variableId ?? -999,
      this.name,
      this.name,
      sanitizeParams(this.params as Record<string, unknown>)
    );
    // If we have a saved result, return it instead of executing
    if (this.previousResult) {
      logger?.debug(`[BubbleClass - ${this.name}] Returning saved result`);
      // Narrow saved base result to current TResult by keeping metadata and
      // treating data as unknown (caller side should only read known fields)
      const savedResult = this.previousResult as BubbleResult<TResult>;

      // Log bubble execution completion for saved result
      logger?.logBubbleExecutionComplete(
        this.context?.variableId ?? -999,
        this.name,
        this.name,
        savedResult
      );

      return savedResult;
    }
    let result: TResult;
    try {
      result = await this.performAction(this.context);
    } catch (error) {
      console.error('Error executing bubble:', error);
      this.context?.logger?.logBubbleExecutionComplete(
        this.context?.variableId ?? -999,
        this.name,
        this.name,
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionId: randomUUID(),
          timestamp: new Date(),
        }
      );
      this.context?.logger?.error(
        `[${this.name}] Unexpected error when performing action: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new BubbleExecutionError(
        error instanceof Error ? error.message : 'Unknown error',
        {
          variableId: this.context?.variableId,
          bubbleName: this.name,
          executionPhase: 'execution',
          cause: error instanceof Error ? error : undefined,
        }
      );
    }

    // Validate result if schema is provided
    if (this.resultSchema) {
      try {
        const validatedResult = this.resultSchema.parse(result);

        const finalResult = {
          success: result.success,
          // For data we strip out any excessive fields
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          data: (({ ...rest }) => rest)(validatedResult) as TResult,
          executionId: randomUUID(),
          error: validatedResult.error || '',
          timestamp: new Date(),
        };

        // Log bubble execution completion
        logger?.logBubbleExecutionComplete(
          this.context?.variableId ?? -999,
          this.name,
          this.name,
          finalResult
        );

        if (!finalResult.success) {
          logger?.warn(
            `[${this.name}] Execution did not succeed: ${finalResult.error}. The flow will continue to run unless you manually catch and handle the error.`
          );
        }

        return finalResult;
      } catch (validationError) {
        // Validation error for result validation failures
        const errorMessage =
          validationError instanceof z.ZodError
            ? `Result schema validation failed: ${validationError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            : `Result validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`;

        throw new BubbleValidationError(errorMessage, {
          variableId: this.context?.variableId,
          bubbleName: this.name,
          cause: validationError instanceof Error ? validationError : undefined,
        });
      }
    }

    // No result schema defined - proceed without validation
    const finalResult = {
      success: result.success,
      // For data we strip out any excessive fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data: (({ ...rest }) => rest)(result) as TResult,
      error: result.error || '',
      executionId: randomUUID(),
      timestamp: new Date(),
    };

    if (!result.success) {
      logger?.error(
        `[${this.name}] Execution error when performing action: ${result.error}`
      );
    }

    // Log bubble execution completion
    logger?.logBubbleExecutionComplete(
      this.context?.variableId ?? -999,
      this.name,
      this.name,
      finalResult
    );

    return finalResult;
  }

  /**
   * Generate mock result data based on the result schema
   * Useful for testing and development when you need sample data
   */
  generateMockResult(): BubbleResult<TResult> {
    return MockDataGenerator.generateMockResult<TResult>(this.resultSchema);
  }

  /**
   * Generate mock result with a specific seed for reproducible results
   * Useful for consistent testing scenarios
   */
  generateMockResultWithSeed(seed: number): BubbleResult<TResult> {
    const mockResult = MockDataGenerator.generateMockWithSeed<TResult>(
      this.resultSchema,
      seed
    );

    // Override executionId to use randomUUID() instead of seeded value
    // This ensures executionId is always unique even with the same seed
    return {
      ...mockResult,
      executionId: randomUUID(),
    };
  }

  /**
   * Perform the actual bubble action - must be implemented by subclasses
   */
  protected abstract performAction(context?: BubbleContext): Promise<TResult>;
}
