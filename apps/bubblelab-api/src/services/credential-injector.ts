import {
  BUBBLE_CREDENTIAL_OPTIONS,
  CREDENTIAL_ENV_MAP,
  isOAuthCredential,
  isBrowserSessionCredential,
} from '@bubblelab/shared-schemas';
import {
  CredentialType,
  BubbleParameterType,
  ParsedBubble,
  BubbleName,
  DatabaseMetadata,
  BUBBLE_NAMES_WITH_CONTEXT_INJECTION,
} from '@bubblelab/shared-schemas';
import {
  reconstructBubbleFlow,
  extractToolCredentials,
} from './bubble-flow-parser.js';
import { oauthService } from './oauth-service.js';
import { browserbaseService } from './browserbase-service.js';

export interface SystemCredential {
  bubbleName: string;
  envName: string; // e.g., "OPENAI_API_KEY", "SLACK_TOKEN"
}

export interface UserCredential {
  bubbleVarName: string;
  secret: string;
  credentialType: string;
  credentialId?: number; // Add credential ID to fetch metadata
  metadata?: DatabaseMetadata; // Metadata from the credential record
}

export interface CredentialInjectionResult {
  success: boolean;
  code?: string;
  errors?: string[];
  injectedCredentials?: Record<string, string>; // For debugging/audit (values are masked)
}

/**
 * Injects credentials into BubbleFlow parameters by modifying bubble instantiations.
 * Uses BubbleRegistry to identify service bubbles that need credentials.
 * Credentials are only injected at runtime and never persisted.
 */
export async function injectCredentials(
  originalCode: string,
  bubbleParameters: Record<string, ParsedBubble>,
  userCredentials: UserCredential[]
): Promise<CredentialInjectionResult> {
  try {
    const modifiedBubbles = { ...bubbleParameters };
    const injectedCredentials: Record<string, string> = {};

    // Iterate through each bubble to determine if it needs credential injection
    for (const [varName, bubble] of Object.entries(modifiedBubbles)) {
      const bubbleName = bubble.bubbleName as BubbleName;

      // Get the credential options for this bubble from the registry
      const bubbleCredentialOptions =
        BUBBLE_CREDENTIAL_OPTIONS[bubbleName] || [];

      // For AI agent bubbles, also collect tool-level credential requirements
      const toolCredentialOptions =
        bubble.bubbleName === 'ai-agent' ? extractToolCredentials(bubble) : [];

      // Debug logging
      if (
        bubble.bubbleName === 'ai-agent' &&
        toolCredentialOptions.length > 0
      ) {
        console.log(
          `🔍 [CredentialInjector] AI agent ${varName} tool credentials:`,
          toolCredentialOptions
        );
      }

      // Combine bubble and tool credentials
      const allCredentialOptions = [
        ...new Set([...bubbleCredentialOptions, ...toolCredentialOptions]),
      ];

      // Debug logging
      if (allCredentialOptions.length > 0) {
        console.log(
          `🔍 [CredentialInjector] ${varName} needs credentials:`,
          allCredentialOptions
        );
      }

      if (allCredentialOptions.length === 0) {
        continue;
      }

      const credentialMapping: Record<CredentialType, string> = {} as Record<
        CredentialType,
        string
      >;
      const credentialSources: string[] = [];

      // Inject all applicable credentials for this bubble

      for (const credentialType of allCredentialOptions as CredentialType[]) {
        const envName = CREDENTIAL_ENV_MAP[credentialType];
        const envValue = process.env[envName];

        if (envValue) {
          credentialMapping[credentialType] = escapeString(envValue);
          credentialSources.push(`${credentialType}:system`);
        }
      }

      const userCreds = userCredentials.filter(
        (uc) => uc.bubbleVarName === varName
      );

      console.log(
        `🔍 [CredentialInjector] Filtered user credentials for ${varName}:`,
        userCreds.map((uc) => ({
          bubbleVarName: uc.bubbleVarName,
          credentialType: uc.credentialType,
        }))
      );

      for (const userCred of userCreds) {
        // Check if this bubble accepts the credential type the user is providing
        const userCredType = userCred.credentialType as CredentialType;

        if (allCredentialOptions.includes(userCredType)) {
          // Check if this is an OAuth credential
          if (isOAuthCredential(userCredType)) {
            try {
              console.log(
                `🔍 [CredentialInjector] Getting OAuth token for ${userCredType}, credential ID: ${userCred.credentialId}`
              );
              // Get valid OAuth token (automatically refreshes if needed)
              const oauthToken = await oauthService.getValidToken(
                userCred.credentialId!
              );

              if (oauthToken) {
                credentialMapping[userCredType] = escapeString(oauthToken);

                // Update sources to reflect this is an OAuth credential
                const sourceIndex = credentialSources.findIndex((s) =>
                  s.startsWith(`${userCredType}:`)
                );
                if (sourceIndex >= 0) {
                  credentialSources[sourceIndex] =
                    `${userCredType}:oauth:auto-refreshed`;
                } else {
                  credentialSources.push(
                    `${userCredType}:oauth:auto-refreshed`
                  );
                }

                console.log(
                  `[CredentialInjector] Successfully injected OAuth token for ${userCredType}`
                );
              } else {
                console.error(
                  `[CredentialInjector] Failed to get OAuth token for ${userCredType}`
                );
              }
            } catch (error) {
              console.error(
                `[CredentialInjector] OAuth token error for ${userCredType}:`,
                error
              );
            }
          } else if (isBrowserSessionCredential(userCredType)) {
            // Browser session credential - get context ID and cookies
            try {
              console.log(
                `🔍 [CredentialInjector] Getting browser session data for ${userCredType}, credential ID: ${userCred.credentialId}`
              );

              const sessionData = await browserbaseService.getCredentialData(
                userCred.credentialId!
              );

              if (sessionData) {
                // Inject as JSON string containing both contextId and cookies
                const sessionPayload = JSON.stringify({
                  contextId: sessionData.contextId,
                  cookies: sessionData.cookies,
                });
                credentialMapping[userCredType] = escapeString(sessionPayload);

                // Update sources
                const sourceIndex = credentialSources.findIndex((s) =>
                  s.startsWith(`${userCredType}:`)
                );
                if (sourceIndex >= 0) {
                  credentialSources[sourceIndex] =
                    `${userCredType}:browser-session`;
                } else {
                  credentialSources.push(`${userCredType}:browser-session`);
                }

                console.log(
                  `[CredentialInjector] Successfully injected browser session data for ${userCredType} (${sessionData.cookies.length} cookies)`
                );
              } else {
                console.error(
                  `[CredentialInjector] Failed to get browser session data for ${userCredType}`
                );
              }
            } catch (error) {
              console.error(
                `[CredentialInjector] Browser session error for ${userCredType}:`,
                error
              );
            }
          } else {
            // Regular API key credential
            credentialMapping[userCredType] = escapeString(userCred.secret);

            // Update sources to reflect this is a user credential
            const sourceIndex = credentialSources.findIndex((s) =>
              s.startsWith(`${userCredType}:`)
            );
            if (sourceIndex >= 0) {
              credentialSources[sourceIndex] = `${userCredType}:user`;
            } else {
              credentialSources.push(`${userCredType}:user`);
            }
          }
        }
      }

      // If we have credentials to inject
      if (Object.keys(credentialMapping).length > 0) {
        // Check if credentials parameter already exists
        const existingCredentialsParam = bubble.parameters.find(
          (p) => p.name === 'credentials'
        );

        // Create object literal string: { OPENAI_CRED: "value1", GOOGLE_GEMINI_CRED: "value2" }
        const credentialEntries = Object.entries(credentialMapping)
          .map(([type, value]) => `${type}: "${value}"`)
          .join(', ');
        const credentialsObjectValue = `{ ${credentialEntries} }`;

        if (existingCredentialsParam) {
          // Replace existing credentials parameter
          existingCredentialsParam.value = credentialsObjectValue;
          existingCredentialsParam.type = BubbleParameterType.OBJECT;
        } else {
          // Add new credentials parameter
          modifiedBubbles[varName] = {
            ...bubble,
            parameters: [
              ...bubble.parameters,
              {
                name: 'credentials',
                value: credentialsObjectValue,
                type: BubbleParameterType.OBJECT,
              },
            ],
          };
        }

        injectedCredentials[varName] = credentialSources.join(', ');
      }

      // Special handling for database-analyzer bubble - inject metadata
      if (BUBBLE_NAMES_WITH_CONTEXT_INJECTION.includes(bubbleName)) {
        // Check if this bubble has DATABASE_CRED in its credentials
        const dbUserCred = userCreds.find(
          (uc) => uc.credentialType === 'DATABASE_CRED'
        );

        if (dbUserCred && dbUserCred.metadata) {
          console.log(
            `[CredentialInjector] Injecting database metadata for ${varName} from credential ID: ${dbUserCred.credentialId}`
          );

          // Prepare the injected metadata
          const injectedMetadata = {
            tables: dbUserCred.metadata.tables || {},
            tableNotes: dbUserCred.metadata.tableNotes || {},
            rules:
              dbUserCred.metadata.rules
                ?.filter((r) => r.enabled)
                .map((r) => r.text) || [],
          };

          // Add injectedMetadata parameter to the bubble
          modifiedBubbles[varName] = {
            ...modifiedBubbles[varName],
            parameters: [
              ...modifiedBubbles[varName].parameters,
              {
                name: 'injectedMetadata',
                value: JSON.stringify(injectedMetadata),
                type: BubbleParameterType.OBJECT,
              },
            ],
          };
        }
      }
    }

    // If no credentials to inject, return original code
    if (Object.keys(injectedCredentials).length === 0) {
      return {
        success: true,
        code: originalCode,
        injectedCredentials: {},
      };
    }
    const reconstructResult = await reconstructBubbleFlow(
      originalCode,
      modifiedBubbles
    );

    if (!reconstructResult.success) {
      return {
        success: false,
        errors: reconstructResult.errors,
      };
    }

    // Print clean summary of credential injection
    console.debug('\n[Credential Injection Summary]');
    for (const [varName, sources] of Object.entries(injectedCredentials)) {
      console.debug(`  ${varName}: ${sources}`);
    }

    return {
      success: true,
      code: reconstructResult.code!,
      injectedCredentials,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Credential injection failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Escapes a string for safe use in generated code
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Validates that credentials are properly formatted
 */
export function validateCredentials(
  systemCredentials: SystemCredential[],
  userCredentials: UserCredential[]
): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // Validate system credentials
  for (const sysCred of systemCredentials) {
    if (!sysCred.bubbleName || typeof sysCred.bubbleName !== 'string') {
      errors.push('System credential missing or invalid bubbleName');
    }
    if (!sysCred.envName || typeof sysCred.envName !== 'string') {
      errors.push('System credential missing or invalid envName');
    }
  }

  // Validate user credentials
  for (const userCred of userCredentials) {
    if (!userCred.bubbleVarName || typeof userCred.bubbleVarName !== 'string') {
      errors.push('User credential missing or invalid bubbleVarName');
    }
    if (!userCred.secret || typeof userCred.secret !== 'string') {
      errors.push('User credential missing or invalid secret');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
