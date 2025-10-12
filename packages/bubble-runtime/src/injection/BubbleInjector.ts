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

export interface UserCredentialWithId {
  /** The variable id of the bubble */
  bubbleVarId: number;
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
  injectedCredentials?: Record<number, string>; // For debugging/audit (values are masked)
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
  findCredentials(
    bubbleParameters: Record<string, ParsedBubbleWithInfo>
  ): Record<number, CredentialType[]> {
    const requiredCredentials: Record<number, CredentialType[]> = {};

    // Iterate through each bubble and check its credential requirements
    for (const [, bubble] of Object.entries(bubbleParameters)) {
      const allCredentialTypes = new Set<CredentialType>();

      // Get bubble-level credentials
      const credentialOptions =
        BUBBLE_CREDENTIAL_OPTIONS[
          bubble.bubbleName as keyof typeof BUBBLE_CREDENTIAL_OPTIONS
        ];
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
    bubbleParameters: Record<string, ParsedBubbleWithInfo>,
    userCredentials: UserCredentialWithId[] = [],
    systemCredentials: Partial<Record<CredentialType, string>> = {}
  ): CredentialInjectionResult {
    try {
      const modifiedBubbles = { ...bubbleParameters };
      const injectedCredentials: Record<string, string> = {};
      const errors: string[] = [];

      // Iterate through each bubble to determine if it needs credential injection
      for (const [_, bubble] of Object.entries(modifiedBubbles)) {
        const bubbleName = bubble.bubbleName as BubbleName;

        // Get the credential options for this bubble from the registry
        const bubbleCredentialOptions =
          BUBBLE_CREDENTIAL_OPTIONS[bubbleName] || [];

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
          }
        }

        // Inject credentials into bubble parameters
        if (Object.keys(credentialMapping).length > 0) {
          this.injectCredentialsIntoBubble(bubble, credentialMapping);

          // Track injected credentials for debugging (mask values)
          for (const [credType, value] of Object.entries(credentialMapping)) {
            injectedCredentials[`${bubble.variableId}.${credType}`] =
              this.maskCredential(value);
          }
        }
      }

      // Apply the modified bubbles back to the script
      const finalScript = this.reapplyBubbleInstantiations(
        Object.values(modifiedBubbles)
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
  private reapplyBubbleInstantiations(bubbles: ParsedBubbleWithInfo[]): string {
    const lines = this.bubbleScript.currentBubbleScript.split('\n');
    console.log('Lines:', lines);
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
    console.log('Final script done!!!:', finalScript);

    this.bubbleScript.currentBubbleScript = finalScript;
    this.bubbleScript.reparseAST();
    return finalScript;
  }

  /**
   * Apply new bubble parameters by converting them back to code and injecting in place
   * Injects logger to the bubble instantiations
   */
  injectBubbleLoggingAndReinitializeBubbleParameters() {
    const parsedBubbles = this.bubbleScript.getParsedBubbles();

    // Normalize to single-line instantiations and refresh AST
    this.reapplyBubbleInstantiations(Object.values(parsedBubbles));

    // Inject logging based on the current AST/locations to avoid placement inside params
    this.loggerInjector.injectLogging();
  }

  /** Takes in bubbleId and key, value pair and changes the parameter in the bubble script */
  changeBubbleParameters(bubbleId: number, key: string, value: unknown) {
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
