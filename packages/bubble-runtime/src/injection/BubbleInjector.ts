import {
  CredentialType,
  BubbleParameterType,
  ParsedBubbleWithInfo,
  BUBBLE_CREDENTIAL_OPTIONS,
  BubbleName,
} from '@bubblelab/shared-schemas';
import { BubbleScript } from '../parse/BubbleScript';
import { LoggerInjector } from './LoggerInjector';
import { replaceBubbleInstantiation } from '../utils/parameter-formatter';

const INVOCATION_GRAPH_START_MARKER =
  '// __BUBBLE_INVOCATION_DEPENDENCY_MAP_START__';
const INVOCATION_GRAPH_END_MARKER =
  '// __BUBBLE_INVOCATION_DEPENDENCY_MAP_END__';

export interface UserCredentialWithId {
  /** The variable id of the bubble */
  bubbleVarId: number | string;
  secret: string;
  credentialType: CredentialType;
  credentialId?: number;
  metadata?: Record<string, unknown>;
}

export interface CredentialInjectionResult {
  success: boolean;
  parsedBubbles?: Record<string, ParsedBubbleWithInfo>;
  code?: string;
  errors?: string[];
  injectedCredentials?: Record<
    number,
    {
      isUserCredential: boolean;
      credentialType: CredentialType;
      credentialValue: string;
    }
  >; // For debugging/audit (values are masked)
}

export class BubbleInjector {
  private bubbleScript: BubbleScript;
  private loggerInjector: LoggerInjector;
  constructor(bubbleScript: BubbleScript) {
    this.bubbleScript = bubbleScript;
    this.loggerInjector = new LoggerInjector(bubbleScript);
  }

  /**
   * Extracts required credential types from parsed bubble parameters
   * Returns a map of variableId to the list of credentials required by that bubble
   * @param bubbleParameters - Parsed bubble parameters with info
   * @returns Record mapping bubble variable IDs to their required credential types (excluding system credentials)
   */
  findCredentials(): Record<string, CredentialType[]> {
    const requiredCredentials: Record<string, CredentialType[]> = {};

    // Iterate through each bubble and check its credential requirements
    for (const [, bubble] of Object.entries(
      this.bubbleScript.getParsedBubbles()
    )) {
      const allCredentialTypes = new Set<CredentialType>();

      // Get bubble-level credentials
      let credentialOptions =
        BUBBLE_CREDENTIAL_OPTIONS[
          bubble.bubbleName as keyof typeof BUBBLE_CREDENTIAL_OPTIONS
        ];

      // For AI agent bubbles, optimize credential requirements based on model
      if (bubble.bubbleName === 'ai-agent' && credentialOptions) {
        const modelCredentialTypes = this.extractModelCredentialType(bubble);

        if (modelCredentialTypes !== null) {
          // Model is static - only include the credentials needed for primary and backup models
          credentialOptions = credentialOptions.filter((credType) =>
            modelCredentialTypes.includes(credType)
          );
        }
        // If modelCredentialTypes is null, model is dynamic - include all credentials
      }

      if (credentialOptions && Array.isArray(credentialOptions)) {
        for (const credType of credentialOptions) {
          allCredentialTypes.add(credType);
        }
      }

      // For AI agent bubbles, also collect tool-level credential requirements
      if (bubble.bubbleName === 'ai-agent') {
        const toolCredentials = this.extractToolCredentials(bubble);
        for (const credType of toolCredentials) {
          allCredentialTypes.add(credType);
        }
      }

      // Return all credentials (system and user credentials)
      const allCredentials = Array.from(allCredentialTypes);

      // Only add the bubble if it has credentials
      if (allCredentials.length > 0) {
        requiredCredentials[bubble.variableId] = allCredentials;
      }
    }

    return requiredCredentials;
  }

  /**
   * Extracts the required credential types from AI agent model parameter (including backup model)
   * @param bubble - The parsed bubble to extract model from
   * @returns Array of credential types needed for the models, or null if dynamic (needs all)
   */
  private extractModelCredentialType(
    bubble: ParsedBubbleWithInfo
  ): CredentialType[] | null {
    console.log(
      '[BubbleInjector] Extracting model credential type for bubble:',
      bubble.bubbleName
    );
    if (bubble.bubbleName !== 'ai-agent') {
      return null;
    }

    // Find the model parameter
    const modelParam = bubble.parameters.find(
      (param) => param.name === 'model'
    );
    if (!modelParam) {
      console.log('[BubbleInjector] No model parameter found');
      // No model parameter, use default (google) or return null to include all
      return [CredentialType.GOOGLE_GEMINI_CRED];
    }

    // Try to extract the model string from the model object
    let modelString: string | undefined;
    let backupModelString: string | undefined;

    if (modelParam.type === BubbleParameterType.OBJECT) {
      // Model is an object, try to extract the nested 'model' property
      try {
        // parse the string to json
        if (typeof modelParam.value !== 'string') {
          throw new Error('Model parameter value must be a string');
        }
        // Convert single quotes to double quotes (handle escaped quotes)
        const jsonStr = modelParam.value
          .replace(/'/g, '"')
          .replace(/(\w+):/g, '"$1":')
          .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
        const modelObj = JSON.parse(jsonStr);
        // Extract primary model
        const nestedModel = modelObj.model;
        if (typeof nestedModel === 'string') {
          modelString = nestedModel;
        }
        // Extract backup model if present
        if (
          modelObj.backupModel &&
          typeof modelObj.backupModel.model === 'string'
        ) {
          backupModelString = modelObj.backupModel.model;
        }
      } catch (error) {
        console.error(
          '[BubbleInjector] Failed to parse model parameter as JSON:',
          error
        );
        // If parsing fails, treat as dynamic model
        modelString = undefined;
      }
    }

    // If we couldn't extract a static model string, treat as dynamic
    if (!modelString) {
      return [CredentialType.GOOGLE_GEMINI_CRED];
    }

    const credentialTypes: CredentialType[] = [];

    // Get credential for primary model
    const primaryCredential = this.getCredentialTypeForProvider(modelString);
    if (primaryCredential === null) {
      return null; // Unknown provider, include all
    }
    credentialTypes.push(primaryCredential);

    // Get credential for backup model if present
    if (backupModelString) {
      const backupCredential =
        this.getCredentialTypeForProvider(backupModelString);
      if (backupCredential === null) {
        return null; // Unknown provider, include all
      }
      if (!credentialTypes.includes(backupCredential)) {
        credentialTypes.push(backupCredential);
      }
    }

    return credentialTypes;
  }

  /**
   * Maps a model string to its credential type
   * @param modelString - Model string in format "provider/model-name"
   * @returns The credential type for the provider, or null if unknown
   */
  private getCredentialTypeForProvider(
    modelString: string
  ): CredentialType | null {
    const slashIndex = modelString.indexOf('/');
    if (slashIndex === -1) {
      return null;
    }

    const provider = modelString.substring(0, slashIndex).toLowerCase();

    switch (provider) {
      case 'openai':
        return CredentialType.OPENAI_CRED;
      case 'google':
        return CredentialType.GOOGLE_GEMINI_CRED;
      case 'anthropic':
        return CredentialType.ANTHROPIC_CRED;
      case 'openrouter':
        return CredentialType.OPENROUTER_CRED;
      default:
        return null;
    }
  }

  /**
   * Extracts tool credential requirements from AI agent bubble parameters
   * @param bubble - The parsed bubble to extract tool requirements from
   * @returns Array of credential types required by the bubble's tools
   */
  private extractToolCredentials(
    bubble: ParsedBubbleWithInfo
  ): CredentialType[] {
    if (bubble.bubbleName !== 'ai-agent') {
      return [];
    }

    const toolCredentials: Set<CredentialType> = new Set();

    // Find the tools parameter in the bubble
    const toolsParam = bubble.parameters.find(
      (param) => param.name === 'tools'
    );
    if (!toolsParam || typeof toolsParam.value !== 'string') {
      return [];
    }

    try {
      // Parse the tools array from the parameter value
      // The value can be either JSON or JavaScript array literal
      let toolsArray: Array<{ name: string; [key: string]: unknown }>;

      // First try to safely evaluate as JavaScript (for cases like [{"name": "web-search-tool"}])
      try {
        // Use Function constructor to safely evaluate the expression in isolation
        const safeEval = new Function('return ' + toolsParam.value);
        const evaluated = safeEval();

        if (Array.isArray(evaluated)) {
          toolsArray = evaluated;
        } else {
          // Single object, wrap in array
          toolsArray = [evaluated];
        }
      } catch {
        // Fallback to JSON.parse for cases where it's valid JSON
        if (toolsParam.value.startsWith('[')) {
          toolsArray = JSON.parse(toolsParam.value);
        } else {
          toolsArray = [JSON.parse(toolsParam.value)];
        }
      }

      // For each tool, get its credential requirements
      for (const tool of toolsArray) {
        if (!tool.name || typeof tool.name !== 'string') {
          continue;
        }

        const toolBubbleName = tool.name as BubbleName;
        const toolCredentialOptions = BUBBLE_CREDENTIAL_OPTIONS[toolBubbleName];

        if (toolCredentialOptions && Array.isArray(toolCredentialOptions)) {
          for (const credType of toolCredentialOptions) {
            toolCredentials.add(credType);
          }
        }
      }
    } catch (error) {
      // If we can't parse the tools parameter, silently ignore
      // This handles cases where the tools parameter contains complex TypeScript expressions
      console.debug(
        `Failed to parse tools parameter for credential extraction: ${error}`
      );
    }

    return Array.from(toolCredentials);
  }

  /**
   * Injects credentials into bubble parameters
   * @param bubbleParameters - Parsed bubble parameters with info
   * @param userCredentials - User-provided credentials
   * @param systemCredentials - System-provided credentials (environment variables)
   * @returns Result of credential injection
   */
  injectCredentials(
    userCredentials: UserCredentialWithId[] = [],
    systemCredentials: Partial<Record<CredentialType, string>> = {}
  ): CredentialInjectionResult {
    try {
      const modifiedBubbles = { ...this.bubbleScript.getParsedBubbles() };
      const injectedCredentials: Record<
        number,
        {
          isUserCredential: boolean;
          credentialType: CredentialType;
          credentialValue: string;
        }
      > = {};
      const errors: string[] = [];

      // Iterate through each bubble to determine if it needs credential injection
      for (const [_, bubble] of Object.entries(modifiedBubbles)) {
        const bubbleName = bubble.bubbleName as BubbleName;

        // Get the credential options for this bubble from the registry
        let bubbleCredentialOptions =
          BUBBLE_CREDENTIAL_OPTIONS[bubbleName] || [];

        // For AI agent bubbles, optimize credential injection based on model
        if (bubble.bubbleName === 'ai-agent') {
          const modelCredentialTypes = this.extractModelCredentialType(bubble);

          if (modelCredentialTypes !== null) {
            // Model is static - only inject the credentials needed for primary and backup models
            bubbleCredentialOptions = bubbleCredentialOptions.filter(
              (credType) => modelCredentialTypes.includes(credType)
            );
          }
          // If modelCredentialTypes is null, model is dynamic - include all credentials
        }

        // For AI agent bubbles, also collect tool-level credential requirements
        const toolCredentialOptions =
          bubble.bubbleName === 'ai-agent'
            ? this.extractToolCredentials(bubble)
            : [];

        // Combine bubble and tool credentials
        const allCredentialOptions = [
          ...new Set([...bubbleCredentialOptions, ...toolCredentialOptions]),
        ];

        if (allCredentialOptions.length === 0) {
          continue;
        }

        const credentialMapping: Record<CredentialType, string> = {} as Record<
          CredentialType,
          string
        >;

        // First, inject system credentials
        for (const credentialType of allCredentialOptions as CredentialType[]) {
          if (systemCredentials[credentialType]) {
            credentialMapping[credentialType] = this.escapeString(
              systemCredentials[credentialType]
            );
            injectedCredentials[`${bubble.variableId}.${credentialType}`] = {
              isUserCredential: false,
              credentialType: credentialType,
              credentialValue: this.maskCredential(
                systemCredentials[credentialType]
              ),
            };
          }
        }

        // Then inject user credentials (these override system credentials)
        const userCreds = userCredentials.filter(
          (uc) => uc.bubbleVarId === bubble.variableId
        );

        for (const userCred of userCreds) {
          const userCredType = userCred.credentialType;

          if (allCredentialOptions.includes(userCredType)) {
            credentialMapping[userCredType] = this.escapeString(
              userCred.secret
            );
            injectedCredentials[`${bubble.variableId}.${userCredType}`] = {
              isUserCredential: true,
              credentialType: userCredType,
              credentialValue: this.maskCredential(userCred.secret),
            };
          }
        }

        // Inject credentials into bubble parameters
        if (Object.keys(credentialMapping).length > 0) {
          this.injectCredentialsIntoBubble(bubble, credentialMapping);
        }
      }

      // Apply the modified bubbles back to the script
      const finalScript = this.reapplyBubbleInstantiations();
      console.log(
        'Final script:',
        this.bubbleScript.showScript('[BubbleInjector] Final script')
      );
      return {
        success: errors.length === 0,
        code: finalScript,
        parsedBubbles: this.bubbleScript.getParsedBubbles(),
        errors: errors.length > 0 ? errors : undefined,
        injectedCredentials,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `Credential injection error: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }
  }

  /**
   * Injects credentials into a specific bubble's parameters
   */
  private injectCredentialsIntoBubble(
    bubble: ParsedBubbleWithInfo,
    credentialMapping: Record<CredentialType, string>
  ): void {
    // Check if bubble already has credentials parameter
    let credentialsParam = bubble.parameters.find(
      (p) => p.name === 'credentials'
    );

    if (!credentialsParam) {
      // Add new credentials parameter
      credentialsParam = {
        name: 'credentials',
        value: {},
        type: BubbleParameterType.OBJECT,
      };
      bubble.parameters.push(credentialsParam);
    }

    // Ensure the value is an object
    if (
      typeof credentialsParam.value !== 'object' ||
      credentialsParam.value === null
    ) {
      credentialsParam.value = {};
    }

    // Inject credentials into the credentials object
    const credentialsObj = credentialsParam.value as Record<string, string>;
    for (const [credType, credValue] of Object.entries(credentialMapping)) {
      credentialsObj[credType] = credValue;
    }

    credentialsParam.value = credentialsObj;
  }

  /**
   * Escapes a string for safe injection into TypeScript code
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Masks a credential value for debugging/logging
   */
  private maskCredential(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return (
      value.substring(0, 4) +
      '*'.repeat(value.length - 8) +
      value.substring(value.length - 4)
    );
  }

  private getBubble(bubbleId: number) {
    const bubbleClass = this.bubbleScript.getParsedBubbles()[bubbleId];
    if (!bubbleClass) {
      throw new Error(`Bubble with id ${bubbleId} not found`);
    }
    return bubbleClass;
  }

  /**
   * Reapply bubble instantiations by normalizing them to single-line format
   * and deleting old multi-line parameters. Processes bubbles in order and
   * tracks line shifts to adjust subsequent bubble locations.
   */
  private reapplyBubbleInstantiations(): string {
    const bubbles = Object.values(this.bubbleScript.getParsedBubbles()).filter(
      (bubble) => !bubble.invocationCallSiteKey
    );
    const lines = this.bubbleScript.currentBubbleScript.split('\n');
    // Sort bubbles by start line to process in order
    const sortedBubbles = [...bubbles].sort(
      (a, b) => a.location.startLine - b.location.startLine
    );

    // Track cumulative line shift as we delete lines
    let lineShift = 0;

    for (const bubble of sortedBubbles) {
      // Adjust bubble location for deletions from previous bubbles
      const adjustedBubble = {
        ...bubble,
        location: {
          ...bubble.location,
          startLine: bubble.location.startLine + lineShift,
          endLine: bubble.location.endLine + lineShift,
        },
      };

      const linesBefore = lines.length;
      replaceBubbleInstantiation(lines, adjustedBubble);
      const linesAfter = lines.length;

      // Update shift: negative means lines were deleted
      const linesDeleted = linesBefore - linesAfter;
      lineShift -= linesDeleted;
    }

    const finalScript = lines.join('\n');
    this.bubbleScript.currentBubbleScript = finalScript;
    this.bubbleScript.reparseAST();
    return finalScript;
  }

  private buildInvocationDependencyGraphLiteral(): string {
    const callSiteMap: Record<string, Record<string, unknown>> = {};
    for (const bubble of Object.values(this.bubbleScript.getParsedBubbles())) {
      if (
        !bubble.invocationCallSiteKey ||
        typeof bubble.clonedFromVariableId !== 'number' ||
        !bubble.dependencyGraph
      ) {
        continue;
      }
      const callSiteKey = bubble.invocationCallSiteKey;
      const originalId = String(bubble.clonedFromVariableId);
      if (!callSiteMap[callSiteKey]) {
        callSiteMap[callSiteKey] = {};
      }
      callSiteMap[callSiteKey][originalId] = bubble.dependencyGraph;
    }
    const literal = JSON.stringify(callSiteMap, null, 2).replace(
      /</g,
      '\\u003c'
    );
    return literal || '{}';
  }

  private injectInvocationDependencyGraphMap(): void {
    const literal = this.buildInvocationDependencyGraphLiteral();
    const lines = this.bubbleScript.currentBubbleScript.split('\n');

    const startIndex = lines.findIndex(
      (line) => line.trim() === INVOCATION_GRAPH_START_MARKER
    );
    if (startIndex !== -1) {
      const endIndex = lines.findIndex(
        (line, idx) =>
          idx >= startIndex && line.trim() === INVOCATION_GRAPH_END_MARKER
      );
      const removeUntil = endIndex !== -1 ? endIndex : startIndex;
      lines.splice(startIndex, removeUntil - startIndex + 1);
      if (lines[startIndex] === '') {
        lines.splice(startIndex, 1);
      }
    }

    const literalLines = literal
      .split('\n')
      .map((line) => (line.length > 0 ? `  ${line}` : line));

    const blockLines = [
      '',
      INVOCATION_GRAPH_START_MARKER,
      'const __bubbleInvocationDependencyGraphs = Object.freeze(',
      ...literalLines,
      ');',
      'globalThis["__bubbleInvocationDependencyGraphs"] = __bubbleInvocationDependencyGraphs;',
      INVOCATION_GRAPH_END_MARKER,
      '',
    ];

    let insertIndex = 0;
    let i = 0;
    let insideImport = false;
    while (i < lines.length) {
      const trimmed = lines[i].trim();

      if (!insideImport && trimmed.startsWith('import')) {
        insideImport = !trimmed.includes(';');
        insertIndex = i + 1;
        i += 1;
        continue;
      }

      if (insideImport) {
        insertIndex = i + 1;
        if (trimmed.includes(';')) {
          insideImport = false;
        }
        i += 1;
        continue;
      }

      if (trimmed === '') {
        insertIndex = i + 1;
        i += 1;
        continue;
      }

      break;
    }

    lines.splice(insertIndex, 0, ...blockLines);
    this.bubbleScript.currentBubbleScript = lines.join('\n');
    this.bubbleScript.reparseAST();
  }

  /**
   * Apply new bubble parameters by converting them back to code and injecting in place
   * Injects logger to the bubble instantiations
   */
  injectBubbleLoggingAndReinitializeBubbleParameters(
    loggingEnabled: boolean = true
  ) {
    const script = this.bubbleScript.currentBubbleScript;
    try {
      // STEP 1: Inject `__bubbleFlowSelf = this;` at the beginning of handle method
      // This must be done FIRST so that bubble instantiations can use __bubbleFlowSelf.logger
      if (loggingEnabled) {
        this.bubbleScript.showScript(
          '[BubbleInjector] Before injectSelfCapture'
        );
        // Normalize to single-line instantiations and refresh AST
        this.reapplyBubbleInstantiations();
        this.injectInvocationDependencyGraphMap();
        this.bubbleScript.showScript(
          '[BubbleInjector] After reapplyBubbleInstantiations'
        );
        // Inject logging based on the current AST/locations to avoid placement inside params
        this.loggerInjector.injectLogging();
        this.bubbleScript.showScript('[BubbleInjector] After injectLogging');
      }
    } catch (error) {
      this.bubbleScript.parsingErrors.push(
        `Error injecting bubble logging and reinitialize bubble parameters: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error(
        'Error injecting bubble logging and reinitialize bubble parameters:',
        error
      );
      // Revert the script to the original script
      this.bubbleScript.currentBubbleScript = script;
    }

    try {
      this.loggerInjector.injectSelfCapture();
      this.bubbleScript.showScript('[BubbleInjector] After injectSelfCapture');
    } catch (error) {
      this.bubbleScript.parsingErrors.push(
        `Error injecting self capture: ${error instanceof Error ? error.message : String(error)}`
      );
      console.error('Error injecting self capture:', error);
    }
  }

  /** Takes in bubbleId and key, value pair and changes the parameter in the bubble script */
  changeBubbleParameters(
    bubbleId: number,
    key: string,
    value: string | number | boolean | Record<string, unknown> | unknown[]
  ) {
    // Find the bubble class in the bubble script
    const parameters = this.getBubble(bubbleId).parameters;
    if (!parameters) {
      throw new Error(`Bubble with id ${bubbleId} not found`);
    }
    // Find the parameter in the bubble class
    const parameter = parameters.find((p) => p.name === key);
    if (!parameter) {
      throw new Error(`Parameter ${key} not found in bubble ${bubbleId}`);
    }
    // Change the parameter value
    parameter.value = value;
  }

  /** Changes the credentials field inside the bubble parameters by modifying the value to add ore replace new credentials */
  changeCredentials(
    bubbleId: number,
    credentials: Record<CredentialType, string>
  ) {
    // Find the bubble parameters
    const bubble = this.getBubble(bubbleId);
    const parameters = bubble.parameters;
    if (!parameters) {
      throw new Error(`Bubble with id ${bubbleId} not found`);
    }
    // Find the credentials parameter
    const credentialsParameter = parameters.find(
      (p) => p.name === 'credentials'
    );
    if (!credentialsParameter) {
      // Add the credentials parameter
      parameters.push({
        name: 'credentials',
        value: credentials,
        type: BubbleParameterType.OBJECT,
      });
    }
    // For each credential types given in the input, find the credential in the credentials parameter, if it doesn't exist will add it, if it does will replace it
    for (const credentialType of Object.keys(credentials)) {
      // Find if the credential type is in the bubble script's credentials parameters
      // Find credentials object in the bubble script's parameters
      const credentialsObject = parameters.find(
        (p) => p.name === 'credentials'
      ) as unknown as Record<string, string>;
      // Add the credentials object parameter
      // Replace the credential parameter
      credentialsObject!.value = credentials[credentialType as CredentialType];
    }
  }
}
