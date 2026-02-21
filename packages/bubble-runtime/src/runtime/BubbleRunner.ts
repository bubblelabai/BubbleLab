import {
  ExecutionResult,
  ParsedBubbleWithInfo,
  CredentialType,
  type ExecutionMeta,
} from '@bubblelab/shared-schemas';
import {
  BubbleFactory,
  BubbleFlow,
  WebhookEvent,
  BubbleLogger,
  LogLevel,
} from '@bubblelab/bubble-core';
import { StreamingBubbleLogger } from '@bubblelab/bubble-core';
import { WebhookStreamLogger } from '@bubblelab/bubble-core';
import type { StreamCallback } from '@bubblelab/shared-schemas';
import {
  BubbleValidationError,
  BubbleExecutionError,
  BubbleError,
} from '@bubblelab/bubble-core';
import type { ExecutionPlan, ExecutionStep, MiniStep } from './types';
import { BubbleScript } from '../parse/BubbleScript';
import { BubbleInjector } from '../injection/BubbleInjector';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { getSafeErrorMessage } from '../utils/error-sanitizer.js';
import { sanitizeScript } from '../utils/sanitize-script.js';
export interface VariableState {
  value: unknown;
  error?: string;
}

export interface BubbleRunnerOptions {
  enableLogging?: boolean;
  logLevel?: LogLevel;
  enableLineByLineLogging?: boolean;
  enableBubbleLogging?: boolean;
  streamCallback?: StreamCallback;
  useWebhookLogger?: boolean;
  pricingTable: Record<string, { unit: string; unitCost: number }>;
  userCredentialMapping?: Map<number, Set<CredentialType>>;
  executionMeta?: ExecutionMeta;
}

export class BubbleRunner {
  // Bubble script

  // Bubble factory
  // @ts-expect-error - Not implemented
  private bubbleFactory: BubbleFactory;

  public bubbleScript: BubbleScript;

  // @ts-expect-error - Not implemented
  private currentStep: number;

  // @ts-expect-error - Not implemented
  private savedStates: any; // Callback function and logger for execution context
  private plan: ExecutionPlan | null = null;
  private logger: BubbleLogger;
  public injector: BubbleInjector;
  private options: BubbleRunnerOptions;
  private hasInjectedLogging: boolean = false;
  constructor(
    bubbleScript: string | BubbleScript,
    bubbleFactory: BubbleFactory,
    options: BubbleRunnerOptions
  ) {
    this.bubbleScript =
      typeof bubbleScript === 'string'
        ? new BubbleScript(bubbleScript, bubbleFactory)
        : bubbleScript;

    this.currentStep = 0;
    this.savedStates = null;
    this.bubbleFactory = bubbleFactory;
    this.injector = new BubbleInjector(this.bubbleScript);
    this.options = {
      enableLogging: true,
      logLevel: LogLevel.DEBUG, // Changed to DEBUG to see debug logs
      enableLineByLineLogging: true,
      enableBubbleLogging: true,
      ...options,
    };

    // Initialize logger if enabled
    const loggerConfig = {
      minLevel: this.options.logLevel || LogLevel.INFO,
      enableTiming: true,
      enableMemoryTracking: true,
      pricingTable: this.options.pricingTable,
      userCredentialMapping: this.options.userCredentialMapping,
    };

    if (this.options.streamCallback) {
      // Use webhook logger for terminal-friendly output when requested
      if (this.options.useWebhookLogger) {
        this.logger = new WebhookStreamLogger('BubbleFlow', {
          ...loggerConfig,
          streamCallback: this.options.streamCallback,
        });
      } else {
        // Use streaming logger when stream callback is provided
        this.logger = new StreamingBubbleLogger('BubbleFlow', {
          ...loggerConfig,
          streamCallback: this.options.streamCallback,
        });
      }
    } else {
      // Use regular logger
      this.logger = new BubbleLogger('BubbleFlow', loggerConfig);
    }

    this.plan = this.buildExecutionPlan();
  }

  /**
   * Creates a list of steps where length = number of parsed bubbles
   * Contains the bubble and parameters to run
   * Each step represents a continuous line range (e.g., line 1-20, 21-xxx)
   */
  private buildExecutionPlan(): ExecutionPlan {
    const steps: ExecutionStep[] = [];
    const parsedBubbles = this.bubbleScript.getParsedBubbles();
    const scopeManager = this.bubbleScript.getScopeManager();

    // Get all bubbles sorted by line start
    const bubbleEntries = Object.entries(parsedBubbles)
      .map(([varName, bubble]) => ({ varName, ...bubble }))
      .sort((a, b) => a.location.startLine - b.location.startLine);

    if (bubbleEntries.length === 0) {
      return { steps: [] };
    }

    // Find script boundaries
    const firstBubbleLine = bubbleEntries[0].location.startLine;
    const lastBubbleLine =
      bubbleEntries[bubbleEntries.length - 1].location.endLine;
    const ast = this.bubbleScript.getAST();
    const fileEndLine = ast.loc?.end.line || lastBubbleLine;

    // Find control flow structures from scope manager
    const controlScopes = scopeManager.scopes.filter(
      (scope) =>
        ['for', 'while', 'if', 'block'].includes(scope.type) &&
        scope.block.loc?.start.line &&
        scope.block.loc?.end.line
    );

    // 1. Setup step (before first bubble)
    if (firstBubbleLine > 1) {
      steps.push({
        id: 'setup',
        type: 'setup',
        startLine: 1,
        endLine: firstBubbleLine - 1,
      });
    }

    // 2. Process bubbles - group by containing control structures
    const processedBubbles = new Set<string>();

    for (const controlScope of controlScopes) {
      const scopeStart = controlScope.block.loc!.start.line;
      const scopeEnd = controlScope.block.loc!.end.line;

      // Find bubbles within this control structure
      const bubblesInScope = bubbleEntries.filter(
        (bubble) =>
          bubble.location.startLine >= scopeStart &&
          bubble.location.endLine <= scopeEnd &&
          !processedBubbles.has(bubble.varName)
      );

      if (bubblesInScope.length > 0) {
        // Create control flow step with mini-steps for each bubble
        const miniSteps: MiniStep[] = [];

        for (const bubble of bubblesInScope) {
          // Bubble instantiation mini-step
          miniSteps.push({
            id: `${bubble.className}_new_${bubble.location.startLine}_${bubble.location.endLine}`,
            type: 'bubble_instantiation',
            startLine: bubble.location.startLine,
            endLine: bubble.location.endLine,
            operation: {
              type: 'new_bubble',
              bubbleName: bubble.className,
              variableName: bubble.varName,
            },
          });

          // Bubble execution mini-step (find .action() call)
          const actionLine = this.findActionCallLine({
            varName: bubble.varName,
            lineEnd: bubble.location.endLine,
          });
          miniSteps.push({
            id: `${bubble.className}_action_${actionLine}_${actionLine}`,
            type: 'bubble_execution',
            startLine: actionLine,
            endLine: actionLine,
            operation: {
              type: 'await_action',
              variableName: bubble.varName,
            },
          });

          processedBubbles.add(bubble.varName);
        }

        steps.push({
          id: `${controlScope.type}_${scopeStart}_${scopeEnd}`,
          type: 'control_flow',
          startLine: scopeStart,
          endLine: scopeEnd,
          controlType: controlScope.type,
          miniSteps,
        });
      }
    }

    // 3. Individual steps for bubbles outside control structures
    for (const bubble of bubbleEntries) {
      if (!processedBubbles.has(bubble.varName)) {
        const actionLine = this.findActionCallLine({
          varName: bubble.varName,
          lineEnd: bubble.location.endLine,
        });

        steps.push({
          id: `${bubble.varName}_${bubble.location.startLine}_${bubble.location.endLine}`,
          type: 'bubble_block',
          startLine: bubble.location.startLine,
          endLine: Math.max(bubble.location.endLine, actionLine),
          miniSteps: [
            {
              id: `${bubble.className}_new_${bubble.location.startLine}_${bubble.location.endLine}`,
              type: 'bubble_instantiation',
              startLine: bubble.location.startLine,
              endLine: bubble.location.endLine,
              operation: {
                type: 'new_bubble',
                bubbleName: bubble.className,
                variableName: bubble.varName,
              },
            },
            {
              id: `${bubble.className}_action_${actionLine}_${actionLine}`,
              type: 'bubble_execution',
              startLine: actionLine,
              endLine: actionLine,
              operation: {
                type: 'await_action',
                variableName: bubble.varName,
              },
            },
          ],
        });
      }
    }

    // 4. Finalization step (after last bubble)
    if (lastBubbleLine < fileEndLine) {
      steps.push({
        id: 'finalization',
        type: 'finalization',
        startLine: lastBubbleLine + 1,
        endLine: fileEndLine,
      });
    }

    // Sort steps by start line
    steps.sort((a, b) => a.startLine - b.startLine);

    return { steps };
  }

  /**
   * Find the line where .action() is called for a bubble
   * Uses AST to locate the method call
   */
  private findActionCallLine(bubble: {
    varName: string;
    lineEnd: number;
  }): number {
    const ast = this.bubbleScript.getAST();

    // Traverse AST to find .action() calls for this variable
    const actionLine = this.findActionCallInAST(ast, bubble.varName);

    // Fallback to estimation if not found
    return actionLine || bubble.lineEnd + 2;
  }

  /**
   * Recursively search AST for .action() calls on a specific variable
   */
  private findActionCallInAST(node: any, variableName: string): number | null {
    // Check if this is a call expression with property access
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression'
    ) {
      const memberExpr = node.callee;

      // Check if it's variableName.action()
      if (
        memberExpr.object?.type === 'Identifier' &&
        memberExpr.object.name === variableName &&
        memberExpr.property?.type === 'Identifier' &&
        memberExpr.property.name === 'action'
      ) {
        return node.loc?.start.line || null;
      }
    }

    // Check if this is an await expression wrapping an action call
    if (node.type === 'AwaitExpression' && node.argument) {
      const actionLine = this.findActionCallInAST(node.argument, variableName);
      if (actionLine) return actionLine;
    }

    // Recursively search child nodes
    if (node.body) {
      for (const child of Array.isArray(node.body) ? node.body : [node.body]) {
        const result = this.findActionCallInAST(child, variableName);
        if (result) return result;
      }
    }

    // Handle other node types that might contain children
    const childKeys = [
      'body',
      'statements',
      'expression',
      'consequent',
      'alternate',
      'init',
      'test',
      'update',
    ];
    for (const key of childKeys) {
      if (node[key]) {
        const child = node[key];
        if (Array.isArray(child)) {
          for (const item of child) {
            const result = this.findActionCallInAST(item, variableName);
            if (result) return result;
          }
        } else {
          const result = this.findActionCallInAST(child, variableName);
          if (result) return result;
        }
      }
    }

    return null;
  }

  getParsedBubbles(): Record<string, ParsedBubbleWithInfo> {
    return this.bubbleScript.getOriginalParsedBubbles();
  }

  /**
   * Get the ORIGINAL parsed bubbles (locations from the initial script before any rewrites)
   */
  getOriginalParsedBubbles(): Record<number, ParsedBubbleWithInfo> {
    return this.bubbleScript.getOriginalParsedBubbles();
  }

  getVariables() {
    return this.bubbleScript.getAllUserVariables();
  }

  /**
   * Finds step ID, calls memorizes results on previous bubbles, and runs the script from 1 to line end
   */
  // @ts-expect-error - Not implemented
  runStep(stepId: number): void {
    // No implementation
  }

  /**
   * Run from step 1 to end
   */
  async runAll(payload?: Partial<WebhookEvent>): Promise<ExecutionResult> {
    let tempFilePath: string | null = null;
    console.log('Running all');

    try {
      this.logger?.info('Preparing for BubbleFlow execution...');

      // Inject logging into the script if enabled
      let scriptToExecute = this.bubbleScript.bubblescript;
      if (this.logger && !this.hasInjectedLogging) {
        this.injector.injectBubbleLoggingAndReinitializeBubbleParameters(
          this.options.enableLogging
        );
        scriptToExecute = this.bubbleScript.bubblescript;
        this.hasInjectedLogging = true;
      }

      this.bubbleScript.showScript('Prepared script for execution');

      // Create a temporary file in node_modules/.cache/bubblelab to ensure:
      // 1. Proper module resolution for @bubblelab packages (stays within project)
      // 2. No triggering of file watchers (node_modules is ignored by --watch)
      const projectRoot = this.findProjectRoot();
      const tempDir = path.join(
        projectRoot,
        'node_modules',
        '.cache',
        'bubblelab'
      );

      // Ensure temp directory exists
      try {
        await fs.mkdir(tempDir, { recursive: true });
      } catch (error: unknown) {
        // Directory might already exist, that's okay
        console.warn('[BubbleRunner] mkdir tempDir warning:', error);
      }

      const tempFileName = `bubble-script-${Date.now()}-${Math.random().toString(36).substring(7)}.ts`;
      tempFilePath = path.join(tempDir, tempFileName);

      // Sanitize script to block access to process.env for security
      scriptToExecute = sanitizeScript(scriptToExecute);
      // Write the script code to the temporary file
      try {
        await fs.writeFile(tempFilePath, scriptToExecute);
      } catch (writeErr) {
        console.error('[BubbleRunner] Failed to write temp file:', writeErr);
        throw writeErr;
      }

      // Convert to file URL for dynamic import
      const moduleUrl = pathToFileURL(tempFilePath).href;
      try {
        await fs.access(tempFilePath);
      } catch (accessErr) {
        console.warn('[BubbleRunner] access check failed:', accessErr);
      }

      // Dynamically import the module
      let module: Record<string, unknown>;
      try {
        module = await import(moduleUrl);
      } catch (importErr) {
        this.bubbleScript.parsingErrors.push(
          `Dynamic import failed: ${importErr instanceof Error ? importErr.message : String(importErr)}`
        );
        console.error('[BubbleRunner] Dynamic import failed:', importErr);
        // Optionally dump first 300 chars of script to help debug syntax errors
        const preview = (scriptToExecute ?? '').slice(0, 300);
        console.error(
          '[BubbleRunner] Script preview (first 300 chars):',
          preview
        );
        throw importErr;
      }

      // Find the BubbleFlow class in the module exports
      const FlowClass = this.findBubbleFlowClass(module);
      if (!FlowClass) {
        throw new Error('No BubbleFlow class found in the module exports');
      }

      // Create default webhook payload if none provided
      const webhookPayload: WebhookEvent = {
        type: 'webhook/http',
        executionId: randomUUID(),
        timestamp: new Date().toISOString(),
        path: '/webhook',
        body: {},
        ...payload,
      };

      // Instantiate the flow class with logger
      // Note: We need to determine the constructor parameters from the class
      const flowInstance = this.instantiateFlowClass(FlowClass);

      // Attach execution metadata so generated code can thread it into BubbleContext
      if (this.options.executionMeta) {
        (flowInstance as any).__executionMeta__ = this.options.executionMeta;
      }

      // Ensure the logger is set on the flow instance
      if (this.logger) {
        if (typeof flowInstance.setLogger === 'function') {
          flowInstance.setLogger(this.logger);
        } else {
          // Fallback: directly set the logger property if setLogger method doesn't exist
          (flowInstance as any).logger = this.logger;
        }
      }

      // Execute the handle method
      const startTime = Date.now();
      const result = await flowInstance.handle(webhookPayload);
      const executionTime = Date.now() - startTime;

      this.logger?.info(
        `BubbleFlow execution completed in ${executionTime}ms`,
        {
          additionalData: { executionTime, result },
        }
      );

      // Log execution completion for streaming
      if (
        this.logger instanceof StreamingBubbleLogger ||
        this.logger instanceof WebhookStreamLogger
      ) {
        this.logger.logExecutionComplete(true, result);
      }

      return {
        executionId: 0,
        success: true,
        error: '',
        summary: this.logger.getExecutionSummary(),
        data: result,
      };
    } catch (error: unknown) {
      // Enhanced error handling for bubble-specific errors
      if (error instanceof BubbleValidationError) {
        const validationError = error as BubbleValidationError;
        this.logger?.fatal(
          `Bubble validation failed: ${validationError.message}`,
          validationError,
          {
            variableId: validationError.variableId,
            bubbleName: validationError.bubbleName,
            additionalData: {
              validationErrors: validationError.validationErrors,
              variableId: validationError.variableId,
              bubbleName: validationError.bubbleName,
            },
          }
        );

        // Log execution failure for streaming
        if (
          this.logger instanceof StreamingBubbleLogger ||
          this.logger instanceof WebhookStreamLogger
        ) {
          this.logger.logExecutionComplete(
            false,
            undefined,
            `Bubble validation failed at ${validationError.bubbleName} (variableId: ${validationError.variableId}): ${validationError.message}`
          );
        }

        return {
          executionId: 0,
          success: false,
          summary: this.logger.getExecutionSummary()!,
          error: `Bubble validation failed at ${validationError.bubbleName} (variableId: ${validationError.variableId}): ${validationError.message}`,
          data: undefined,
        };
      } else if (error instanceof BubbleExecutionError) {
        const executionError = error as BubbleExecutionError;
        this.logger?.fatal(
          `Bubble execution failed: ${executionError.message}`,
          executionError,
          {
            variableId: executionError.variableId,
            bubbleName: executionError.bubbleName,
            additionalData: {
              executionPhase: executionError.executionPhase,
              variableId: executionError.variableId,
              bubbleName: executionError.bubbleName,
            },
          }
        );

        // Log execution failure for streaming
        if (
          this.logger instanceof StreamingBubbleLogger ||
          this.logger instanceof WebhookStreamLogger
        ) {
          this.logger.logExecutionComplete(
            false,
            undefined,
            `Bubble execution failed at ${executionError.bubbleName} (variableId: ${executionError.variableId}): ${executionError.message}`
          );
        }

        return {
          executionId: 0,
          success: false,
          summary: this.logger.getExecutionSummary(),
          error: `Bubble execution failed at ${executionError.bubbleName} (variableId: ${executionError.variableId}): ${executionError.message}`,
          data: undefined,
        };
      } else if (error instanceof BubbleError) {
        // Generic bubble error
        const bubbleError = error as BubbleError;
        this.logger?.fatal(
          `Bubble error: ${bubbleError.message}`,
          bubbleError,
          {
            variableId: bubbleError.variableId,
            bubbleName: bubbleError.bubbleName,
            additionalData: {
              variableId: bubbleError.variableId,
              bubbleName: bubbleError.bubbleName,
            },
          }
        );

        // Log execution failure for streaming
        if (
          this.logger instanceof StreamingBubbleLogger ||
          this.logger instanceof WebhookStreamLogger
        ) {
          this.logger.logExecutionComplete(
            false,
            undefined,
            `Bubble error at ${bubbleError.bubbleName} (variableId: ${bubbleError.variableId}): ${bubbleError.message}`
          );
        }

        return {
          executionId: 0,
          summary: this.logger.getExecutionSummary()!,
          success: false,
          error: `Bubble error at ${bubbleError.bubbleName} (variableId: ${bubbleError.variableId}): ${bubbleError.message}`,
          data: undefined,
        };
      } else {
        // Generic error fallback
        const safeError = getSafeErrorMessage(error);
        this.logger?.fatal(
          'BubbleFlow execution failed',
          error instanceof Error ? error : undefined
        );

        // Log execution failure for streaming
        if (
          this.logger instanceof StreamingBubbleLogger ||
          this.logger instanceof WebhookStreamLogger
        ) {
          this.logger.logExecutionComplete(false, undefined, safeError);
        }

        return {
          executionId: 0,
          summary: this.logger.getExecutionSummary(),
          success: false,
          error: safeError,
          data: undefined,
        };
      }
    } finally {
      // Clean up temporary file
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          // Ignore cleanup errors to avoid masking the original error
          console.warn(
            `Failed to cleanup temporary file ${tempFilePath}:`,
            cleanupError
          );
        }
      }
    }
  }

  /**
   * Find the BubbleFlow class in module exports
   */
  private findBubbleFlowClass(
    module: Record<string, unknown>
  ): (new (...args: unknown[]) => BubbleFlow<'webhook/http'>) | null {
    // Check all exports for a class that extends BubbleFlow
    for (const [, value] of Object.entries(module)) {
      if (
        typeof value === 'function' &&
        this.isBubbleFlowClass(value as (...args: unknown[]) => unknown)
      ) {
        return value as new (...args: unknown[]) => BubbleFlow<'webhook/http'>;
      }
    }
    return null;
  }

  /**
   * Check if a function is a BubbleFlow class
   */
  private isBubbleFlowClass(func: (...args: unknown[]) => unknown): boolean {
    // Check if it's a class constructor
    if (typeof func !== 'function') return false;

    // Check prototype chain for BubbleFlow methods
    const prototype = func.prototype;
    if (!prototype) return false;

    // Look for the handle method which is required by BubbleFlow
    return typeof prototype.handle === 'function';
  }

  /**
   * Instantiate the flow class with appropriate constructor parameters
   */
  private instantiateFlowClass(
    FlowClass: new (...args: unknown[]) => BubbleFlow<'webhook/http'>
  ): BubbleFlow<'webhook/http'> {
    return new FlowClass(
      'Generated Flow',
      'Automatically generated flow execution',
      this.logger
    );
  }

  /**
   * Resume execution from a specific step
   */
  // @ts-expect-error - Not implemented
  resumeFromStep(stepId: number): void {
    // No implementation
  }

  getPlan(): ExecutionPlan {
    if (!this.plan) {
      throw new Error('Plan not found');
    }
    return this.plan;
  }

  /**
   * Get the logger instance
   */
  getLogger(): BubbleLogger | undefined {
    return this.logger;
  }

  /**
   * Get execution summary with detailed analytics
   */
  getExecutionSummary(): ReturnType<
    BubbleLogger['getExecutionSummary']
  > | null {
    return this.logger?.getExecutionSummary() || null;
  }

  /**
   * Export execution logs in various formats
   */
  exportLogs(format: 'json' | 'csv' | 'table' = 'json'): string | null {
    return this.logger?.exportLogs(format) || null;
  }

  /**
   * Find the project root directory by looking for package.json
   */
  private findProjectRoot(): string {
    console.log('Finding project root');
    let currentDir = process.cwd();

    while (currentDir !== path.dirname(currentDir)) {
      try {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (existsSync(packageJsonPath)) {
          return currentDir;
        }
      } catch (error: unknown) {
        // Continue searching
      }
      currentDir = path.dirname(currentDir);
    }

    // Fallback to current working directory
    return process.cwd();
  }

  /**
   * Dispose of resources (logger, etc.)
   */
  dispose(): void {
    this.logger?.dispose();
  }
}
