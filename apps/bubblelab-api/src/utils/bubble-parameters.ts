import {
  BubbleParameterType,
  CredentialType,
  type ParsedBubbleWithInfo,
} from '@bubblelab/shared-schemas';

/**
 * Injects user-provided credentials into bubble parameters.
 * For each bubble, finds the required credential types and adds/updates
 * the credentials parameter with the user-provided credential IDs.
 *
 * @param parsedBubbles - Map of variable ID to parsed bubble information
 * @param requiredCredentials - Map of bubble name to array of required credential types
 * @param credentials - Map of credential type to credential ID provided by user
 * @returns Updated bubble parameters with credentials injected
 */
export function injectCredentialsIntoBubbleParameters(
  parsedBubbles: Record<string, ParsedBubbleWithInfo>,
  requiredCredentials: Record<string, CredentialType[] | string[]>,
  credentials: Record<string, number>
): Record<string, ParsedBubbleWithInfo> {
  const bubbleParametersWithCreds: Record<string, ParsedBubbleWithInfo> = {};

  for (const [varIdStr, bubble] of Object.entries(parsedBubbles)) {
    // requiredCredentials uses bubbleName as key, not variable ID
    const bubbleCredTypes = requiredCredentials[bubble.bubbleName] || [];

    // Build credentials object for this bubble: { CredentialType -> credentialId }
    const bubbleCredentials: Record<string, number> = {};
    for (const credType of bubbleCredTypes) {
      // Handle both string and CredentialType enum values
      const credTypeStr = String(credType);
      const credId = credentials[credTypeStr];
      if (credId) {
        bubbleCredentials[credTypeStr] = credId;
      }
    }

    // Clone the bubble and add/update the credentials parameter
    const updatedBubble: ParsedBubbleWithInfo = {
      ...bubble,
      parameters: [...bubble.parameters],
    };

    // Find existing credentials parameter or add new one
    const existingCredIdx = updatedBubble.parameters.findIndex(
      (p) => p.name === 'credentials'
    );
    if (existingCredIdx >= 0) {
      updatedBubble.parameters[existingCredIdx] = {
        ...updatedBubble.parameters[existingCredIdx],
        value: bubbleCredentials,
      };
    } else if (Object.keys(bubbleCredentials).length > 0) {
      updatedBubble.parameters.push({
        name: 'credentials',
        type: BubbleParameterType.OBJECT,
        value: bubbleCredentials,
      });
    }

    bubbleParametersWithCreds[varIdStr] = updatedBubble;
  }

  return bubbleParametersWithCreds;
}
