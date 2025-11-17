import { db } from '../db/index.js';
import { users, userServiceUsage } from '../db/schema.js';
import { eq, and, or, isNull } from 'drizzle-orm';
import type { CredentialType, ServiceUsage } from '@bubblelab/shared-schemas';
import { getMonthYearFromUserCreatedDate } from '../utils/subscription.js';
import { getCurrentMonthYear } from '../utils/subscription.js';

/**
 * Get total service usage for a user, optionally filtered by service and subService
 * Returns aggregated usage across all units for the specified service
 */
export async function getTotalServiceCostForUser(
  userId: string,
  service?: CredentialType,
  subService?: string
): Promise<number> {
  // Query for the user's created date to get the month year for the billing period
  const userCreatedAt = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { createdAt: true },
  });
  if (!userCreatedAt) {
    throw new Error(
      'User not found to get the month year for the billing period'
    );
  }
  const monthYear = userCreatedAt
    ? getMonthYearFromUserCreatedDate(userCreatedAt.createdAt)
    : getCurrentMonthYear();
  console.log(
    '[getTotalServiceUsageForUser] Month year:',
    monthYear,
    ' user created at:',
    userCreatedAt.createdAt
  );
  const whereConditions = [
    eq(userServiceUsage.userId, userId),
    eq(userServiceUsage.monthYear, monthYear),
  ];

  if (service) {
    whereConditions.push(eq(userServiceUsage.service, service));
  }

  if (subService) {
    whereConditions.push(eq(userServiceUsage.subService, subService));
  }

  const usageRecords = await db.query.userServiceUsage.findMany({
    where: and(...whereConditions),
  });
  console.log('[getTotalServiceUsageForUser] Usage records:', usageRecords);
  return usageRecords.reduce((acc, curr) => acc + curr.totalCost, 0);
}

/**
 * Track service usage for a specific service, subService, and unit combination
 * Uses upsert logic to increment existing records or create new ones
 * Each service can be uniquely identified by service + subService + unit
 */
export async function trackServiceUsage(
  userId: string,
  serviceUsage: ServiceUsage,
  userCreatedAt?: Date
): Promise<void> {
  const monthYear = userCreatedAt
    ? getMonthYearFromUserCreatedDate(userCreatedAt)
    : getCurrentMonthYear();

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
 * Create a matching key for service usage records
 * Matches on: user + service + subService + unit + unitCost + monthYear
 * This ensures that different prices are tracked separately
 */
function createUsageKey(
  userId: string,
  serviceUsage: ServiceUsage,
  monthYear: string
): string {
  const subService = serviceUsage.subService || '';
  return `${userId}:${serviceUsage.service}:${subService}:${serviceUsage.unit}:${serviceUsage.unitCost}:${monthYear}`;
}

/**
 * Track service usage for multiple services from a ServiceUsage array
 * Uses batch operations to minimize database queries:
 * 1. Batch fetch all existing records for the user in the current month
 * 2. Match on user + service + subService + unit + unitCost + monthYear
 * 3. Batch insert new records and batch update existing ones
 */
export async function trackServiceUsages(
  userId: string,
  serviceUsages: ServiceUsage[],
  userCreatedAt?: Date
): Promise<void> {
  if (serviceUsages.length === 0) {
    return;
  }

  const monthYear = userCreatedAt
    ? getMonthYearFromUserCreatedDate(userCreatedAt)
    : getCurrentMonthYear();

  try {
    // Batch fetch all existing records for this user in the current month
    // We'll match against these records instead of querying individually
    const existingRecords = await db.query.userServiceUsage.findMany({
      where: and(
        eq(userServiceUsage.userId, userId),
        eq(userServiceUsage.monthYear, monthYear)
      ),
    });

    // Create a map of existing records by their matching key
    const existingMap = new Map<string, (typeof existingRecords)[0]>();
    for (const record of existingRecords) {
      const key = createUsageKey(
        userId,
        {
          service: record.service as CredentialType,
          subService: record.subService || undefined,
          unit: record.unit,
          usage: record.usage,
          unitCost: record.unitCost,
          totalCost: record.totalCost,
        },
        monthYear
      );
      existingMap.set(key, record);
    }

    // Group service usages by their matching key and aggregate usage
    const usageMap = new Map<
      string,
      { serviceUsage: ServiceUsage; totalUsage: number }
    >();

    for (const usage of serviceUsages) {
      const key = createUsageKey(userId, usage, monthYear);
      const existing = usageMap.get(key);
      if (existing) {
        // Aggregate usage for the same key
        existing.totalUsage += usage.usage;
      } else {
        usageMap.set(key, {
          serviceUsage: usage,
          totalUsage: usage.usage,
        });
      }
    }

    // Separate records into updates and inserts
    const recordsToUpdate: Array<{
      id: number;
      usage: number;
      unitCost: number;
      totalCost: number;
    }> = [];
    const recordsToInsert: Array<{
      userId: string;
      service: string;
      subService: string | null;
      monthYear: string;
      unit: string;
      usage: number;
      unitCost: number;
      totalCost: number;
    }> = [];

    for (const [key, { serviceUsage, totalUsage }] of usageMap.entries()) {
      const existing = existingMap.get(key);
      if (existing) {
        // Update existing record - increment usage and recalculate totalCost
        const newUsage = existing.usage + totalUsage;
        const newTotalCost = newUsage * serviceUsage.unitCost;
        recordsToUpdate.push({
          id: existing.id,
          usage: newUsage,
          unitCost: serviceUsage.unitCost, // Update to current pricing
          totalCost: newTotalCost,
        });
      } else {
        // Insert new record
        const totalCost = totalUsage * serviceUsage.unitCost;
        recordsToInsert.push({
          userId,
          service: serviceUsage.service,
          subService: serviceUsage.subService || null,
          monthYear,
          unit: serviceUsage.unit,
          usage: totalUsage,
          unitCost: serviceUsage.unitCost,
          totalCost: totalCost,
        });
      }
    }

    // Batch insert new records
    if (recordsToInsert.length > 0) {
      await db.insert(userServiceUsage).values(recordsToInsert);
    }

    // Batch update existing records
    // Note: Drizzle doesn't support batch updates directly, so we execute them in parallel
    // This is still much better than N queries (we have at most N updates, not 2N queries)
    const updatePromises = recordsToUpdate.map((record) =>
      db
        .update(userServiceUsage)
        .set({
          usage: record.usage,
          unitCost: record.unitCost,
          totalCost: record.totalCost,
          updatedAt: new Date(),
        })
        .where(eq(userServiceUsage.id, record.id))
    );

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
  } catch (error) {
    console.error(
      '[trackServiceUsages] Failed to track service usages:',
      error,
      'for userId:',
      userId
    );
    // Don't throw - service usage tracking failures shouldn't break execution
  }
}
