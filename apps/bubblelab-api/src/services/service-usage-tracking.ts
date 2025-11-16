import { db } from '../db/index.js';
import { userServiceUsage } from '../db/schema.js';
import { eq, and, or, isNull } from 'drizzle-orm';
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
    // Try to find existing record matching user + service + subService + unit
    // (monthYear is not part of unique constraint, so we look up by the unique fields only)
    const whereConditions = [
      eq(userServiceUsage.userId, userId),
      eq(userServiceUsage.service, serviceUsage.service),
      eq(userServiceUsage.unit, serviceUsage.unit),
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
      // Use current pricing from serviceUsage (which comes from pricing table)
      const newUsage = existing.usage + serviceUsage.usage;
      const currentUnitCost = serviceUsage.unitCost; // Use current pricing
      const newTotalCost = newUsage * currentUnitCost;

      await db
        .update(userServiceUsage)
        .set({
          usage: newUsage,
          unitCost: currentUnitCost, // Update to current pricing
          totalCost: newTotalCost,
          updatedAt: new Date(),
        })
        .where(eq(userServiceUsage.id, existing.id));
    } else {
      // Insert new record
      // Store costs directly as dollars (high precision float, no conversion needed)
      const totalCost = serviceUsage.usage * serviceUsage.unitCost;

      await db.insert(userServiceUsage).values({
        userId,
        service: serviceUsage.service,
        subService: serviceUsage.subService || null,
        monthYear,
        unit: serviceUsage.unit,
        usage: serviceUsage.usage,
        unitCost: serviceUsage.unitCost,
        totalCost: totalCost,
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
