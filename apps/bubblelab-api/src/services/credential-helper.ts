import { db } from '../db/index.js';
import { userCredentials } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { CredentialEncryption } from '../utils/encryption.js';
// CredentialType imported for future use in credential validation
import type { ParsedBubble } from '@bubblelab/shared-schemas';
import type { DatabaseMetadata } from '@bubblelab/shared-schemas';
import { oauthService } from './oauth-service.js';

export interface UserCredentialMapping {
  varName: string;
  secret: string;
  credentialType: string; // The credential type from the database (e.g., 'OPENAI_CRED', 'SLACK_CRED')
  credentialId: number;
  metadata?: DatabaseMetadata; // Database metadata for DATABASE_CRED types
}

/**
 * Credential helper service for managing user credentials in bubble flows
 */
export class CredentialHelper {
  /**
   * Extracts credential IDs from bubble parameters and decrypts them
   * @param userId - The user ID to fetch credentials for
   * @param bubbleParameters - Parsed bubble parameters containing credential mappings
   * @returns Array of variable name to secret value mappings
   */
  static async getUserCredentials(
    userId: string,
    bubbleParameters: Record<string, ParsedBubble>
  ): Promise<UserCredentialMapping[]> {
    const credentialMappings: UserCredentialMapping[] = [];
    const credentialIds: number[] = [];
    const credentialIdToVarNames: Map<number, string[]> = new Map();

    // Extract credential IDs from bubble parameters
    for (const [varName, bubble] of Object.entries(bubbleParameters)) {
      // Look for credentials parameter in bubble
      const credentialsParam = bubble.parameters.find(
        (p) => p.name === 'credentials'
      );

      if (credentialsParam && credentialsParam.type === 'object') {
        try {
          // Parse the credentials object: { CredentialType -> credentialId }
          const credentialsObj = this.parseCredentialsObject(
            credentialsParam.value as Record<string, number>
          );

          for (const [, credentialId] of Object.entries(credentialsObj)) {
            if (typeof credentialId === 'number') {
              if (!credentialIds.includes(credentialId)) {
                credentialIds.push(credentialId);
              }
              // Support multiple variable names per credential ID
              if (!credentialIdToVarNames.has(credentialId)) {
                credentialIdToVarNames.set(credentialId, []);
              }
              credentialIdToVarNames.get(credentialId)!.push(varName);
            }
          }
        } catch (error) {
          console.warn(
            `Failed to parse credentials for bubble ${varName}:`,
            error
          );
        }
      }
    }

    // If no credential IDs found, return empty array
    if (credentialIds.length === 0) {
      return credentialMappings;
    }

    // Fetch encrypted credentials from database
    const encryptedCredentials = await db.query.userCredentials.findMany({
      where: and(
        eq(userCredentials.userId, userId),
        inArray(userCredentials.id, credentialIds)
      ),
    });

    // Decrypt credentials and map to variable names
    for (const encryptedCred of encryptedCredentials) {
      try {
        let resolvedSecret: string | null = null;

        if (encryptedCred.isOauth) {
          // Prefer using OAuth service to auto-refresh and return a valid token
          resolvedSecret = await oauthService.getValidToken(encryptedCred.id);

          // Fallback: attempt to decrypt stored access token if service returned null
          if (!resolvedSecret && encryptedCred.oauthAccessToken) {
            try {
              resolvedSecret = await CredentialEncryption.decrypt(
                encryptedCred.oauthAccessToken
              );
            } catch (e) {
              // Ignore and let it fall through to skip
            }
          }
        } else if (encryptedCred.encryptedValue) {
          resolvedSecret = await CredentialEncryption.decrypt(
            encryptedCred.encryptedValue
          );
        }

        if (!resolvedSecret) {
          continue;
        }
        const varNames = credentialIdToVarNames.get(encryptedCred.id);

        if (varNames) {
          // Add a mapping for each variable name that uses this credential
          for (const varName of varNames) {
            credentialMappings.push({
              varName,
              secret: resolvedSecret,
              credentialType: encryptedCred.credentialType,
              credentialId: encryptedCred.id,
              metadata: encryptedCred.metadata || undefined,
            });
          }
        }
      } catch (error) {
        console.error(
          `Failed to decrypt credential ${encryptedCred.id}:`,
          error
        );
        // Continue with other credentials even if one fails
      }
    }

    return credentialMappings;
  }

  /**
   * Parses a credentials object string to extract credential type to ID mappings
   * Expected format: { OPENAI_CRED: 1, SLACK_CRED: 2 }
   * @param credentialsValue - String representation of credentials object
   * @returns Object mapping credential types to credential IDs
   */
  private static parseCredentialsObject(
    credentialsValue: Record<string, number>
  ): Record<string, number> {
    // Validate that all values are numbers (credential IDs)
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(credentialsValue)) {
      if (typeof value === 'number' && Number.isInteger(value)) {
        result[key] = value;
      } else {
        console.warn(`Skipping invalid credential ID for ${key}: ${value}`);
      }
    }

    return result;
  }
}
