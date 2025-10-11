import { db } from '../db/index.js';
import { userModelUsage } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import type { TokenUsage } from '@bubblelab/shared-schemas';

/**
 * Get current month-year string in format 'YYYY-MM'
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getTotalTokenUsageForUser(
  userId: string,
  modelName: string
): Promise<TokenUsage> {
  const monthYear = getCurrentMonthYear();
  const tokenUsage = await db.query.userModelUsage.findMany({
    where: and(
      eq(userModelUsage.userId, userId),
      eq(userModelUsage.modelName, modelName),
      eq(userModelUsage.monthYear, monthYear)
    ),
  });
  return tokenUsage.reduce(
    (acc, curr) => {
      return {
        inputTokens: acc.inputTokens + curr.inputTokens,
        outputTokens: acc.outputTokens + curr.outputTokens,
        totalTokens: acc.totalTokens + curr.totalTokens,
      };
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
}

/**
 * Track token usage for a specific model and user
 * Uses upsert logic to increment existing records or create new ones
 */
export async function trackModelTokenUsage(
  userId: string,
  modelName: string,
  tokenUsage: TokenUsage
): Promise<void> {
  const monthYear = getCurrentMonthYear();

  try {
    // Try to find existing record
    const existing = await db.query.userModelUsage.findFirst({
      where: and(
        eq(userModelUsage.userId, userId),
        eq(userModelUsage.modelName, modelName),
        eq(userModelUsage.monthYear, monthYear)
      ),
    });

    if (existing) {
      // Update existing record
      await db
        .update(userModelUsage)
        .set({
          inputTokens: sql`${userModelUsage.inputTokens} + ${tokenUsage.inputTokens}`,
          outputTokens: sql`${userModelUsage.outputTokens} + ${tokenUsage.outputTokens}`,
          totalTokens: sql`${userModelUsage.totalTokens} + ${tokenUsage.totalTokens}`,
          updatedAt: new Date(),
        })
        .where(eq(userModelUsage.id, existing.id));
    } else {
      // Insert new record
      await db.insert(userModelUsage).values({
        userId,
        modelName,
        monthYear,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        totalTokens: tokenUsage.totalTokens,
      });
    }
  } catch (error) {
    console.error('[trackModelTokenUsage] Failed to track token usage:', error);
    // Don't throw - token tracking failures shouldn't break execution
  }
}

/**
 * Track token usage for multiple models from a tokenUsageByModel record
 * Iterates through each model and tracks usage separately
 */
export async function trackTokenUsage(
  userId: string,
  tokenUsageByModel: Record<string, Omit<TokenUsage, 'modelName'>>
): Promise<void> {
  // Track each model's token usage separately
  const trackingPromises = Object.entries(tokenUsageByModel).map(
    ([modelName, usage]) => {
      return trackModelTokenUsage(userId, modelName, {
        ...usage,
        modelName, // Add modelName back for consistency
      });
    }
  );
  // Execute all tracking operations in parallel
  await Promise.all(trackingPromises);
}
