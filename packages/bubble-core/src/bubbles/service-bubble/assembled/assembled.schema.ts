import { z } from 'zod';

// ─── Credentials ────────────────────────────────────────────────────────────

const credentialsField = z
  .record(z.string())
  .optional()
  .describe('Credentials for authentication');

// ─── Shared field helpers ───────────────────────────────────────────────────

const paginationFields = {
  limit: z
    .number()
    .optional()
    .default(20)
    .describe('Maximum number of results to return (default 20, max 500)'),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe('Number of results to skip for pagination'),
};

// ─── People schemas ─────────────────────────────────────────────────────────

const listPeopleSchema = z.object({
  operation: z.literal('list_people').describe('List people/agents'),
  credentials: credentialsField,
  ...paginationFields,
  channel: z
    .string()
    .optional()
    .describe(
      'Filter by channel (phone, email, chat, sms, social, back_office)'
    ),
  team: z.string().optional().describe('Filter by team name'),
  site: z.string().optional().describe('Filter by site name'),
  queue: z.string().optional().describe('Filter by queue name'),
  search: z
    .string()
    .optional()
    .describe('Search by name, email, or imported_id'),
});

const getPersonSchema = z.object({
  operation: z.literal('get_person').describe('Get a single person by ID'),
  credentials: credentialsField,
  person_id: z.string().describe('The Assembled person ID'),
});

const createPersonSchema = z.object({
  operation: z.literal('create_person').describe('Create a new person/agent'),
  credentials: credentialsField,
  first_name: z.string().describe('First name of the person'),
  last_name: z.string().describe('Last name of the person'),
  email: z.string().optional().describe('Email address of the person'),
  imported_id: z
    .string()
    .optional()
    .describe('External/imported ID for the person'),
  channels: z
    .array(z.string())
    .optional()
    .describe(
      'Channels the person works on (phone, email, chat, sms, social, back_office)'
    ),
  teams: z
    .array(z.string())
    .optional()
    .describe('Team names to assign the person to'),
  queues: z
    .array(z.string())
    .optional()
    .describe('Queue names to assign the person to'),
  site: z.string().optional().describe('Site name for the person'),
  timezone: z
    .string()
    .optional()
    .describe('Timezone for the person (e.g. America/Los_Angeles)'),
  roles: z
    .array(z.string())
    .optional()
    .describe('Roles to assign (e.g. agent, admin)'),
  staffable: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether the person can be scheduled'),
});

const updatePersonSchema = z.object({
  operation: z.literal('update_person').describe('Update an existing person'),
  credentials: credentialsField,
  person_id: z.string().describe('The Assembled person ID to update'),
  first_name: z.string().optional().describe('Updated first name'),
  last_name: z.string().optional().describe('Updated last name'),
  email: z.string().optional().describe('Updated email address'),
  channels: z.array(z.string()).optional().describe('Updated channels list'),
  teams: z.array(z.string()).optional().describe('Updated team names'),
  queues: z.array(z.string()).optional().describe('Updated queue names'),
  site: z.string().optional().describe('Updated site name'),
  timezone: z.string().optional().describe('Updated timezone'),
  staffable: z.boolean().optional().describe('Updated staffable status'),
});

// ─── Activities schemas ─────────────────────────────────────────────────────

const listActivitiesSchema = z.object({
  operation: z
    .literal('list_activities')
    .describe('List activities/schedule events in a time window'),
  credentials: credentialsField,
  start_time: z
    .number()
    .describe('Start of time window as Unix timestamp (seconds)'),
  end_time: z
    .number()
    .describe('End of time window as Unix timestamp (seconds)'),
  agent_ids: z
    .array(z.string())
    .optional()
    .describe('Filter by specific agent IDs'),
  queue: z.string().optional().describe('Filter by queue name'),
  include_agents: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include agent details in response'),
});

const createActivitySchema = z.object({
  operation: z
    .literal('create_activity')
    .describe('Create a new activity/schedule event'),
  credentials: credentialsField,
  agent_id: z.string().describe('Agent ID to assign the activity to'),
  type_id: z.string().describe('Activity type ID'),
  start_time: z.number().describe('Activity start as Unix timestamp (seconds)'),
  end_time: z.number().describe('Activity end as Unix timestamp (seconds)'),
  channels: z
    .array(z.string())
    .optional()
    .describe('Channels for this activity (phone, email, chat, etc.)'),
  description: z.string().optional().describe('Description of the activity'),
  allow_conflicts: z
    .boolean()
    .optional()
    .default(false)
    .describe('Whether to allow overlapping activities'),
});

const deleteActivitiesSchema = z.object({
  operation: z
    .literal('delete_activities')
    .describe('Delete activities for specified agents within a time window'),
  credentials: credentialsField,
  agent_ids: z
    .array(z.string())
    .describe('Agent IDs whose activities to delete'),
  start_time: z
    .number()
    .describe('Start of deletion window as Unix timestamp (seconds)'),
  end_time: z
    .number()
    .describe('End of deletion window as Unix timestamp (seconds)'),
});

// ─── Time Off schemas ───────────────────────────────────────────────────────

const createTimeOffSchema = z.object({
  operation: z.literal('create_time_off').describe('Create a time off request'),
  credentials: credentialsField,
  agent_id: z.string().describe('Agent ID requesting time off'),
  start_time: z.number().describe('Time off start as Unix timestamp (seconds)'),
  end_time: z.number().describe('Time off end as Unix timestamp (seconds)'),
  type_id: z
    .string()
    .optional()
    .describe('Activity type ID for the time off (must be a time-off type)'),
  status: z
    .enum(['approved', 'pending'])
    .optional()
    .default('pending')
    .describe('Initial status of the time off request'),
  notes: z.string().optional().describe('Notes for the time off request'),
});

const listTimeOffSchema = z.object({
  operation: z.literal('list_time_off').describe('List time off requests'),
  credentials: credentialsField,
  ...paginationFields,
  agent_ids: z.array(z.string()).optional().describe('Filter by agent IDs'),
  status: z
    .enum(['approved', 'pending', 'denied', 'cancelled'])
    .optional()
    .describe('Filter by time off request status'),
});

const cancelTimeOffSchema = z.object({
  operation: z.literal('cancel_time_off').describe('Cancel a time off request'),
  credentials: credentialsField,
  time_off_id: z.string().describe('ID of the time off request to cancel'),
});

// ─── Filter schemas (queues, teams) ─────────────────────────────────────────

const listQueuesSchema = z.object({
  operation: z.literal('list_queues').describe('List all queues'),
  credentials: credentialsField,
});

const listTeamsSchema = z.object({
  operation: z.literal('list_teams').describe('List all teams'),
  credentials: credentialsField,
});

// ─── Combined Params Schema ─────────────────────────────────────────────────

export const AssembledParamsSchema = z.discriminatedUnion('operation', [
  listPeopleSchema,
  getPersonSchema,
  createPersonSchema,
  updatePersonSchema,
  listActivitiesSchema,
  createActivitySchema,
  deleteActivitiesSchema,
  createTimeOffSchema,
  listTimeOffSchema,
  cancelTimeOffSchema,
  listQueuesSchema,
  listTeamsSchema,
]);

export type AssembledParams = z.output<typeof AssembledParamsSchema>;
export type AssembledParamsInput = z.input<typeof AssembledParamsSchema>;

// ─── Result Schemas ─────────────────────────────────────────────────────────

const personResultSchema = z.object({
  operation: z.literal('list_people'),
  success: z.boolean(),
  error: z.string(),
  people: z.array(z.record(z.unknown())).optional(),
  total: z.number().optional(),
});

const getPersonResultSchema = z.object({
  operation: z.literal('get_person'),
  success: z.boolean(),
  error: z.string(),
  person: z.record(z.unknown()).optional(),
});

const createPersonResultSchema = z.object({
  operation: z.literal('create_person'),
  success: z.boolean(),
  error: z.string(),
  person: z.record(z.unknown()).optional(),
});

const updatePersonResultSchema = z.object({
  operation: z.literal('update_person'),
  success: z.boolean(),
  error: z.string(),
  person: z.record(z.unknown()).optional(),
});

const listActivitiesResultSchema = z.object({
  operation: z.literal('list_activities'),
  success: z.boolean(),
  error: z.string(),
  activities: z.record(z.record(z.unknown())).optional(),
  agents: z.record(z.record(z.unknown())).optional(),
});

const createActivityResultSchema = z.object({
  operation: z.literal('create_activity'),
  success: z.boolean(),
  error: z.string(),
  activity: z.record(z.unknown()).optional(),
});

const deleteActivitiesResultSchema = z.object({
  operation: z.literal('delete_activities'),
  success: z.boolean(),
  error: z.string(),
});

const createTimeOffResultSchema = z.object({
  operation: z.literal('create_time_off'),
  success: z.boolean(),
  error: z.string(),
  time_off: z.record(z.unknown()).optional(),
});

const listTimeOffResultSchema = z.object({
  operation: z.literal('list_time_off'),
  success: z.boolean(),
  error: z.string(),
  requests: z.array(z.record(z.unknown())).optional(),
});

const cancelTimeOffResultSchema = z.object({
  operation: z.literal('cancel_time_off'),
  success: z.boolean(),
  error: z.string(),
});

const listQueuesResultSchema = z.object({
  operation: z.literal('list_queues'),
  success: z.boolean(),
  error: z.string(),
  queues: z.array(z.record(z.unknown())).optional(),
});

const listTeamsResultSchema = z.object({
  operation: z.literal('list_teams'),
  success: z.boolean(),
  error: z.string(),
  teams: z.array(z.record(z.unknown())).optional(),
});

export const AssembledResultSchema = z.discriminatedUnion('operation', [
  personResultSchema,
  getPersonResultSchema,
  createPersonResultSchema,
  updatePersonResultSchema,
  listActivitiesResultSchema,
  createActivityResultSchema,
  deleteActivitiesResultSchema,
  createTimeOffResultSchema,
  listTimeOffResultSchema,
  cancelTimeOffResultSchema,
  listQueuesResultSchema,
  listTeamsResultSchema,
]);

export type AssembledResult = z.infer<typeof AssembledResultSchema>;
