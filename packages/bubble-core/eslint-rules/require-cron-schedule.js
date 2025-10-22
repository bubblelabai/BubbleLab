/**
 * ESLint rule to ensure BubbleFlow classes with 'schedule/cron' event type
 * have a valid cronSchedule property defined.
 *
 * This rule checks that:
 * 1. Classes extending BubbleFlow<'schedule/cron'> have a cronSchedule property
 * 2. The cronSchedule property is a readonly string literal
 * 3. The cron expression is valid (5 parts with correct ranges)
 */

/**
 * Validates a cron expression format
 * Expected format: minute hour day month day-of-week
 * @param {string} cronExpr - The cron expression to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCronExpression(cronExpr) {
  if (typeof cronExpr !== 'string') {
    return { valid: false, error: 'Cron expression must be a string' };
  }

  const parts = cronExpr.trim().split(/\s+/);

  if (parts.length !== 5) {
    return {
      valid: false,
      error: `Cron expression must have exactly 5 parts (minute hour day month day-of-week), got ${parts.length}`,
    };
  }

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Validation ranges
  const ranges = {
    minute: { min: 0, max: 59, name: 'minute' },
    hour: { min: 0, max: 23, name: 'hour' },
    day: { min: 1, max: 31, name: 'day of month' },
    month: { min: 1, max: 12, name: 'month' },
    dayOfWeek: { min: 0, max: 6, name: 'day of week' },
  };

  /**
   * Validates a single cron field
   * @param {string} field - The cron field value
   * @param {Object} range - The valid range for this field
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateField(field, range) {
    // Allow wildcards
    if (field === '*') return { valid: true };

    // Allow step values (e.g., */15)
    if (field.startsWith('*/')) {
      const step = parseInt(field.substring(2), 10);
      if (isNaN(step) || step <= 0) {
        return {
          valid: false,
          error: `Invalid step value in ${range.name}: ${field}`,
        };
      }
      return { valid: true };
    }

    // Allow ranges (e.g., 1-5)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map((v) => parseInt(v, 10));
      if (
        isNaN(start) ||
        isNaN(end) ||
        start < range.min ||
        end > range.max ||
        start > end
      ) {
        return {
          valid: false,
          error: `Invalid range in ${range.name}: ${field} (must be ${range.min}-${range.max})`,
        };
      }
      return { valid: true };
    }

    // Allow lists (e.g., 1,3,5)
    if (field.includes(',')) {
      const values = field.split(',').map((v) => parseInt(v.trim(), 10));
      for (const val of values) {
        if (isNaN(val) || val < range.min || val > range.max) {
          return {
            valid: false,
            error: `Invalid value in ${range.name} list: ${val} (must be ${range.min}-${range.max})`,
          };
        }
      }
      return { valid: true };
    }

    // Single numeric value
    const value = parseInt(field, 10);
    if (isNaN(value) || value < range.min || value > range.max) {
      return {
        valid: false,
        error: `Invalid ${range.name}: ${field} (must be ${range.min}-${range.max})`,
      };
    }

    return { valid: true };
  }

  // Validate each field
  const validations = [
    validateField(minute, ranges.minute),
    validateField(hour, ranges.hour),
    validateField(day, ranges.day),
    validateField(month, ranges.month),
    validateField(dayOfWeek, ranges.dayOfWeek),
  ];

  for (const validation of validations) {
    if (!validation.valid) {
      return validation;
    }
  }

  return { valid: true };
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ensure BubbleFlow classes with schedule/cron event type have a valid cronSchedule property',
      category: 'Possible Errors',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingCronSchedule:
        "BubbleFlow with 'schedule/cron' event type must define a readonly cronSchedule property. Example: readonly cronSchedule = '0 0 * * *';",
      invalidCronFormat:
        'cronSchedule must be a string literal containing a valid 5-part cron expression. {{error}}',
      nonLiteralCronSchedule:
        'cronSchedule must be initialized with a string literal, not a variable or expression',
    },
  },

  create(context) {
    return {
      ClassDeclaration(node) {
        // Check if this class extends BubbleFlow
        if (!node.superClass || node.superClass.type !== 'Identifier') {
          return;
        }

        if (node.superClass.name !== 'BubbleFlow') {
          return;
        }

        // Check if it has type parameters (generics)
        const typeParameters =
          node.superTypeParameters || node.superTypeArguments;
        if (
          !typeParameters ||
          !typeParameters.params ||
          typeParameters.params.length === 0
        ) {
          return;
        }

        // Get the first type parameter
        const firstParam = typeParameters.params[0];

        // Check if it's a literal type with value 'schedule/cron'
        let eventType = null;
        if (firstParam.type === 'TSLiteralType' && firstParam.literal) {
          if (firstParam.literal.type === 'Literal') {
            eventType = firstParam.literal.value;
          }
        }

        // Only enforce for 'schedule/cron' event type
        if (eventType !== 'schedule/cron') {
          return;
        }

        // Now we need to check if the class has a cronSchedule property
        const classBody = node.body.body;
        let cronScheduleProperty = null;

        for (const member of classBody) {
          if (
            (member.type === 'PropertyDefinition' ||
              member.type === 'ClassProperty') &&
            member.key.type === 'Identifier' &&
            member.key.name === 'cronSchedule'
          ) {
            cronScheduleProperty = member;
            break;
          }
        }

        // If no cronSchedule property found, report error
        if (!cronScheduleProperty) {
          context.report({
            node,
            messageId: 'missingCronSchedule',
          });
          return;
        }

        // Validate the cronSchedule property has a string literal value
        if (!cronScheduleProperty.value) {
          context.report({
            node: cronScheduleProperty,
            messageId: 'nonLiteralCronSchedule',
          });
          return;
        }

        // Check if it's a string literal
        if (
          cronScheduleProperty.value.type !== 'Literal' ||
          typeof cronScheduleProperty.value.value !== 'string'
        ) {
          context.report({
            node: cronScheduleProperty,
            messageId: 'nonLiteralCronSchedule',
          });
          return;
        }

        // Validate the cron expression format
        const cronExpression = cronScheduleProperty.value.value;
        const validation = validateCronExpression(cronExpression);

        if (!validation.valid) {
          context.report({
            node: cronScheduleProperty.value,
            messageId: 'invalidCronFormat',
            data: {
              error: validation.error,
            },
          });
        }
      },
    };
  },
};
