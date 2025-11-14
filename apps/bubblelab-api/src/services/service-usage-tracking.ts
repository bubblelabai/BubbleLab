import { db } from '../db/index.js';
import { userServiceUsage } from '../db/schema.js';
import { eq, and, sql, or, isNull } from 'drizzle-orm';
import type { CredentialType, ServiceUsage } from '@bubblelab/shared-schemas';

/**
 * Get current month-year string in format 'YYYY-MM'
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get total service usage for a user, optionally filtered by service and subService
 * Returns aggregated usage across all units for the specified service
 */
export async function getTotalServiceUsageForUser(
  userId: string,
  service: CredentialType,
  subService?: string
): Promise<number> {
  const monthYear = getCurrentMonthYear();
  const whereConditions = [
    eq(userServiceUsage.userId, userId),
    eq(userServiceUsage.service, service),
    eq(userServiceUsage.monthYear, monthYear),
  ];

  if (subService) {
    whereConditions.push(eq(userServiceUsage.subService, subService));
  } else {
    const subServiceCondition = or(
      isNull(userServiceUsage.subService),
      eq(userServiceUsage.subService, '')
    );
    if (subServiceCondition) {
      whereConditions.push(subServiceCondition);
    }
  }

  const usageRecords = await db.query.userServiceUsage.findMany({
    where: and(...whereConditions),
  });
  return usageRecords.reduce((acc, curr) => acc + curr.usage, 0);
}

/**
 * Track service usage for a specific service, subService, and unit combination
 * Uses upsert logic to increment existing records or create new ones
 * Each service can be uniquely identified by service + subService + unit
 */
export async function trackServiceUsage(
  userId: string,
  serviceUsage: ServiceUsage
): Promise<void> {
  const monthYear = getCurrentMonthYear();

  try {
    // Try to find existing record matching service + subService + unit + monthYear
    const whereConditions = [
      eq(userServiceUsage.userId, userId),
      eq(userServiceUsage.service, serviceUsage.service),
      eq(userServiceUsage.unit, serviceUsage.unit),
      eq(userServiceUsage.monthYear, monthYear),
    ];

    if (serviceUsage.subService) {
      whereConditions.push(
        eq(userServiceUsage.subService, serviceUsage.subService)
      );
    } else {
      const subServiceCondition = or(
        isNull(userServiceUsage.subService),
        eq(userServiceUsage.subService, '')
      );
      if (subServiceCondition) {
        whereConditions.push(subServiceCondition);
      }
    }

    const existing = await db.query.userServiceUsage.findFirst({
      where: and(...whereConditions),
    });

    if (existing) {
      // Update existing record - increment usage and recalculate totalCost
      await db
        .update(userServiceUsage)
        .set({
          usage: sql`${userServiceUsage.usage} + ${serviceUsage.usage}`,
          totalCost: sql`(${userServiceUsage.usage} + ${serviceUsage.usage}) * ${userServiceUsage.unitCost}`,
          updatedAt: new Date(),
        })
        .where(eq(userServiceUsage.id, existing.id));
    } else {
      // Insert new record
      // Convert unitCost from dollars to microdollars (multiply by 1,000,000)
      const unitCostMicrodollars = Math.round(serviceUsage.unitCost * 1000000);
      const totalCostMicrodollars = Math.round(
        serviceUsage.usage * serviceUsage.unitCost * 1000000
      );

      await db.insert(userServiceUsage).values({
        userId,
        service: serviceUsage.service,
        subService: serviceUsage.subService || null,
        monthYear,
        unit: serviceUsage.unit,
        usage: serviceUsage.usage,
        unitCost: unitCostMicrodollars,
        totalCost: totalCostMicrodollars,
      });
    }
  } catch (error) {
    console.error(
      '[trackServiceUsage] Failed to track service usage:',
      error,
      'for service:',
      serviceUsage.service,
      'subService:',
      serviceUsage.subService,
      'unit:',
      serviceUsage.unit
    );
    // Don't throw - service usage tracking failures shouldn't break execution
  }
}

/**
 * Track service usage for multiple services from a ServiceUsage array
 * Iterates through each service usage entry and tracks them separately
 * Each entry is uniquely identified by service + subService + unit
 */
export async function trackServiceUsages(
  userId: string,
  serviceUsages: ServiceUsage[]
): Promise<void> {
  // Track each service usage separately
  const trackingPromises = serviceUsages.map((usage) => {
    return trackServiceUsage(userId, usage);
  });
  // Execute all tracking operations in parallel
  await Promise.all(trackingPromises);
}
