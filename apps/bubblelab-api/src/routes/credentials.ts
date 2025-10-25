import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '../db/index.js';
import { userCredentials } from '../db/schema.js';
import {
  type CredentialResponse,
  type CreateCredentialResponse,
  type UpdateCredentialResponse,
  CredentialType,
  DatabaseMetadata,
} from '../schemas/index.js';
import { getUserId } from '../middleware/auth.js';
import { CredentialEncryption } from '../utils/encryption.js';
import { eq, and } from 'drizzle-orm';
import {
  listCredentialsRoute,
  createCredentialRoute,
  updateCredentialRoute,
  deleteCredentialRoute,
  getCredentialMetadataRoute,
} from '../schemas/credentials.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { CredentialValidator } from '../services/credential-validator.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

app.openapi(listCredentialsRoute, async (c) => {
  const userId = getUserId(c);

  const credentials = await db.query.userCredentials.findMany({
    where: eq(userCredentials.userId, userId),
    columns: {
      id: true,
      credentialType: true,
      name: true,
      metadata: true,
      createdAt: true,
      isOauth: true,
      oauthExpiresAt: true,
      oauthScopes: true,
      oauthProvider: true,
    },
  });

  const response: CredentialResponse[] = credentials.map((cred) => {
    const now = new Date();
    let oauthStatus: 'active' | 'expired' | 'needs_refresh' | undefined;

    // Calculate OAuth status if this is an OAuth credential
    if (cred.isOauth && cred.oauthExpiresAt) {
      const expiresAt = new Date(cred.oauthExpiresAt);
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      if (expiresAt < now) {
        oauthStatus = 'expired';
      } else if (expiresAt < fiveMinutesFromNow) {
        oauthStatus = 'needs_refresh';
      } else {
        oauthStatus = 'active';
      }
    }

    return {
      id: cred.id,
      credentialType: cred.credentialType,
      name: cred.name || undefined,
      metadata: cred.metadata || { tables: {}, rules: [] },
      createdAt: cred.createdAt.toISOString(),

      // OAuth fields
      isOauth: cred.isOauth || undefined,
      oauthProvider: cred.oauthProvider || undefined,
      oauthExpiresAt: cred.oauthExpiresAt?.toISOString() || undefined,
      oauthScopes: cred.oauthScopes || undefined,
      oauthStatus,
    };
  });

  return c.json(response, 200);
});

app.openapi(createCredentialRoute, async (c) => {
  const userId = getUserId(c);
  const {
    credentialType,
    value,
    name,
    skipValidation,
    credentialConfigurations,
    metadata,
  } = c.req.valid('json');

  // Validate credential before storing
  const validationResult = await CredentialValidator.validateCredential(
    credentialType,
    value,
    skipValidation || false,
    credentialConfigurations
  );

  if (!validationResult.isValid) {
    return c.json(
      {
        error: 'Credential validation failed',
        details: validationResult.error,
        bubbleName: validationResult.bubbleName,
      },
      400
    );
  }

  // Encrypt the credential value
  const encryptedValue = await CredentialEncryption.encrypt(value);

  // Store in database
  const [inserted] = await db
    .insert(userCredentials)
    .values({
      userId,
      credentialType,
      encryptedValue,
      name,
      metadata,
    })
    .returning({ id: userCredentials.id });

  const response: CreateCredentialResponse = {
    id: inserted.id,
    message: 'Credential created successfully',
  };

  return c.json(response, 201);
});

app.openapi(updateCredentialRoute, async (c) => {
  const userId = getUserId(c);
  const credentialId = parseInt(c.req.param('id'));
  const { value, name, skipValidation, credentialConfigurations, metadata } =
    c.req.valid('json');

  if (isNaN(credentialId)) {
    return c.json({ error: 'Invalid credential ID format' }, 400);
  }

  // Check if credential exists and belongs to user
  const credential = await db.query.userCredentials.findFirst({
    where: and(
      eq(userCredentials.id, credentialId),
      eq(userCredentials.userId, userId)
    ),
  });

  if (!credential) {
    return c.json({ error: 'Credential not found or access denied' }, 404);
  }

  // Prepare update data
  const updateData: {
    name?: string;
    encryptedValue?: string;
    metadata?: DatabaseMetadata;
  } = {};

  // Only update name if provided
  if (name !== undefined) {
    updateData.name = name;
  }

  // Only update metadata if provided
  if (metadata !== undefined) {
    updateData.metadata = metadata;
  }

  // Handle value update with proper validation
  if (value !== undefined) {
    // If value is provided, it must not be empty
    if (!value || value.trim() === '') {
      return c.json(
        {
          error: 'Credential value cannot be empty',
          details: 'A valid credential value is required',
        },
        400
      );
    }

    // Validate credential before updating
    const validationResult = await CredentialValidator.validateCredential(
      credential.credentialType as CredentialType,
      value,
      skipValidation || false,
      credentialConfigurations
    );

    if (!validationResult.isValid) {
      return c.json(
        {
          error: 'Credential validation failed',
          details: validationResult.error,
          bubbleName: validationResult.bubbleName,
        },
        400
      );
    }

    // Encrypt the new credential value
    const encryptedValue = await CredentialEncryption.encrypt(value);
    updateData.encryptedValue = encryptedValue;
  }

  // Update the credential
  const [updated] = await db
    .update(userCredentials)
    .set(updateData)
    .where(eq(userCredentials.id, credentialId))
    .returning({ id: userCredentials.id });

  const response: UpdateCredentialResponse = {
    id: updated.id,
    message: 'Credential updated successfully',
  };

  return c.json(response, 200);
});

app.openapi(deleteCredentialRoute, async (c) => {
  const userId = getUserId(c);
  const credentialId = parseInt(c.req.param('id'));

  if (isNaN(credentialId)) {
    return c.json({ error: 'Invalid credential ID format' }, 400);
  }

  // Check if credential exists and belongs to user
  const credential = await db.query.userCredentials.findFirst({
    where: and(
      eq(userCredentials.id, credentialId),
      eq(userCredentials.userId, userId)
    ),
  });

  if (!credential) {
    return c.json({ error: 'Credential not found or access denied' }, 404);
  }

  // Delete the credential
  await db.delete(userCredentials).where(eq(userCredentials.id, credentialId));

  return c.json({ message: 'Credential deleted successfully' }, 200);
});

app.openapi(getCredentialMetadataRoute, async (c) => {
  const userId = getUserId(c);
  const credentialId = parseInt(c.req.param('id'));

  if (isNaN(credentialId)) {
    return c.json({ error: 'Invalid credential ID format' }, 400);
  }

  // Check if credential exists and belongs to user
  const credential = await db.query.userCredentials.findFirst({
    where: and(
      eq(userCredentials.id, credentialId),
      eq(userCredentials.userId, userId)
    ),
  });

  if (!credential) {
    return c.json({ error: 'Credential not found or access denied' }, 404);
  }

  // Either the access token (OAuth) or the encrypted value (API key)
  const credentialValue =
    credential.encryptedValue || credential.oauthAccessToken;

  if (!credentialValue) {
    console.error(`Credential ${credential.id} has no valid credential value - isOauth: 
  ${credential.isOauth}`);
    return c.json({ error: 'Credential data is invalid' }, 400);
  }

  // Get metadata from the credential using the validator
  const metadata = await CredentialValidator.getEncryptedCredentialMetadata(
    credential.credentialType as CredentialType,
    credentialValue
  );

  return c.json(metadata || null, 200);
});

export default app;
