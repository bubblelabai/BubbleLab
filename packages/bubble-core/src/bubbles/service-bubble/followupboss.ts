import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define common FUB schemas
const FUBPersonSchema = z
  .object({
    id: z.number().describe('Unique person identifier'),
    firstName: z.string().optional().describe('First name'),
    lastName: z.string().optional().describe('Last name'),
    emails: z
      .array(
        z.object({
          value: z.string(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Email addresses'),
    phones: z
      .array(
        z.object({
          value: z.string(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Phone numbers'),
    stage: z.string().optional().describe('Current stage in pipeline'),
    source: z.string().optional().describe('Lead source'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    tags: z.array(z.string()).optional().describe('Tags applied to person'),
    created: z.string().optional().describe('Creation timestamp'),
    updated: z.string().optional().describe('Last update timestamp'),
  })
  .passthrough()
  .describe('FUB person/contact object');

const FUBTaskSchema = z
  .object({
    id: z.number().describe('Unique task identifier'),
    personId: z.number().optional().describe('Associated person ID'),
    name: z.string().describe('Task name/title'),
    description: z.string().optional().describe('Task description'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    completed: z.boolean().optional().describe('Whether task is completed'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB task object');

const FUBNoteSchema = z
  .object({
    id: z.number().describe('Unique note identifier'),
    personId: z.number().describe('Associated person ID'),
    subject: z.string().optional().describe('Note subject'),
    body: z.string().describe('Note content'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB note object');

const FUBDealSchema = z
  .object({
    id: z.number().describe('Unique deal identifier'),
    personId: z.number().optional().describe('Associated person ID'),
    name: z.string().optional().describe('Deal name'),
    price: z.number().optional().describe('Deal price/value'),
    stage: z.string().optional().describe('Deal stage'),
    closeDate: z.string().optional().describe('Expected close date'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB deal object');

const FUBEventSchema = z
  .object({
    id: z.number().optional().describe('Event identifier'),
    type: z
      .string()
      .describe('Event type (e.g., "Showing Request", "Registration")'),
    source: z.string().optional().describe('Event source'),
    message: z.string().optional().describe('Event message'),
    person: z
      .object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        emails: z.array(z.object({ value: z.string() })).optional(),
        phones: z.array(z.object({ value: z.string() })).optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional()
      .describe('Person data for the event'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB event object');

const FUBCallSchema = z
  .object({
    id: z.number().describe('Unique call identifier'),
    personId: z.number().describe('Associated person ID'),
    outcome: z.string().optional().describe('Call outcome'),
    note: z.string().optional().describe('Call notes'),
    duration: z.number().optional().describe('Call duration in seconds'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB call object');

const FUBAppointmentSchema = z
  .object({
    id: z.number().describe('Unique appointment identifier'),
    personId: z.number().optional().describe('Associated person ID'),
    title: z.string().optional().describe('Appointment title'),
    startTime: z.string().optional().describe('Start time'),
    endTime: z.string().optional().describe('End time'),
    location: z.string().optional().describe('Location'),
    created: z.string().optional().describe('Creation timestamp'),
  })
  .passthrough()
  .describe('FUB appointment object');

const FUBWebhookSchema = z
  .object({
    id: z.number().describe('Unique webhook identifier'),
    event: z.string().describe('Webhook event type'),
    url: z.string().describe('Callback URL'),
    status: z.string().optional().describe('Webhook status (Active/Inactive)'),
  })
  .passthrough()
  .describe('FUB webhook object');

// Supported webhook event types
const FUB_WEBHOOK_EVENTS = [
  'peopleCreated',
  'peopleUpdated',
  'peopleDeleted',
  'peopleTagsCreated',
  'peopleStageUpdated',
  'peopleRelationshipCreated',
  'peopleRelationshipUpdated',
  'peopleRelationshipDeleted',
  'notesCreated',
  'notesUpdated',
  'notesDeleted',
  'emailsCreated',
  'emailsUpdated',
  'emailsDeleted',
  'tasksCreated',
  'tasksUpdated',
  'tasksDeleted',
  'appointmentsCreated',
  'appointmentsUpdated',
  'appointmentsDeleted',
  'textMessagesCreated',
  'textMessagesUpdated',
  'textMessagesDeleted',
  'callsCreated',
  'callsUpdated',
  'callsDeleted',
  'dealsCreated',
  'dealsUpdated',
  'dealsDeleted',
  'eventsCreated',
  'stageCreated',
  'stageUpdated',
  'stageDeleted',
  'pipelineCreated',
  'pipelineUpdated',
  'pipelineDeleted',
  'pipelineStageCreated',
  'pipelineStageUpdated',
  'pipelineStageDeleted',
  'customFieldsCreated',
  'customFieldsUpdated',
  'customFieldsDeleted',
  'dealCustomFieldsCreated',
  'dealCustomFieldsUpdated',
  'dealCustomFieldsDeleted',
  'emEventsOpened',
  'emEventsClicked',
  'emEventsUnsubscribed',
  'reactionCreated',
  'reactionDeleted',
  'threadedReplyCreated',
  'threadedReplyUpdated',
  'threadedReplyDeleted',
] as const;

// Define the parameters schema for FUB operations
const FUBParamsSchema = z.discriminatedUnion('operation', [
  // People operations
  z.object({
    operation: z.literal('list_people').describe('List people/contacts'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    sort: z.string().optional().describe('Sort field'),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated fields to return (use "allFields" for all)'),
    includeTrash: z
      .boolean()
      .optional()
      .default(false)
      .describe('Include people in Trash stage'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('get_person').describe('Get a specific person by ID'),
    person_id: z.number().describe('Person ID to retrieve'),
    fields: z.string().optional().describe('Comma-separated fields to return'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z
      .literal('create_person')
      .describe('Create a new person/contact'),
    firstName: z.string().optional().describe('First name'),
    lastName: z.string().optional().describe('Last name'),
    emails: z
      .array(
        z.object({
          value: z.string().email(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Email addresses'),
    phones: z
      .array(
        z.object({
          value: z.string(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Phone numbers'),
    stage: z.string().optional().describe('Initial stage'),
    source: z.string().optional().describe('Lead source'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    tags: z.array(z.string()).optional().describe('Tags to apply'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('update_person').describe('Update an existing person'),
    person_id: z.number().describe('Person ID to update'),
    firstName: z.string().optional().describe('First name'),
    lastName: z.string().optional().describe('Last name'),
    emails: z
      .array(
        z.object({
          value: z.string().email(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Email addresses'),
    phones: z
      .array(
        z.object({
          value: z.string(),
          type: z.string().optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .optional()
      .describe('Phone numbers'),
    stage: z.string().optional().describe('Stage'),
    source: z.string().optional().describe('Lead source'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    tags: z.array(z.string()).optional().describe('Tags'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('delete_person').describe('Delete a person'),
    person_id: z.number().describe('Person ID to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Task operations
  z.object({
    operation: z.literal('list_tasks').describe('List tasks'),
    personId: z.number().optional().describe('Filter by person ID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('get_task').describe('Get a specific task by ID'),
    task_id: z.number().describe('Task ID to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('create_task').describe('Create a new task'),
    personId: z.number().optional().describe('Associated person ID'),
    name: z.string().min(1).describe('Task name/title'),
    description: z.string().optional().describe('Task description'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('update_task').describe('Update an existing task'),
    task_id: z.number().describe('Task ID to update'),
    name: z.string().optional().describe('Task name/title'),
    description: z.string().optional().describe('Task description'),
    dueDate: z.string().optional().describe('Due date (YYYY-MM-DD)'),
    completed: z.boolean().optional().describe('Whether task is completed'),
    assignedTo: z.number().optional().describe('Assigned user ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('delete_task').describe('Delete a task'),
    task_id: z.number().describe('Task ID to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Note operations
  z.object({
    operation: z.literal('list_notes').describe('List notes'),
    personId: z.number().optional().describe('Filter by person ID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('create_note').describe('Create a new note'),
    personId: z.number().describe('Associated person ID'),
    subject: z.string().optional().describe('Note subject'),
    body: z.string().min(1).describe('Note content'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('update_note').describe('Update an existing note'),
    note_id: z.number().describe('Note ID to update'),
    subject: z.string().optional().describe('Note subject'),
    body: z.string().optional().describe('Note content'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('delete_note').describe('Delete a note'),
    note_id: z.number().describe('Note ID to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Deal operations
  z.object({
    operation: z.literal('list_deals').describe('List deals'),
    personId: z.number().optional().describe('Filter by person ID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('get_deal').describe('Get a specific deal by ID'),
    deal_id: z.number().describe('Deal ID to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('create_deal').describe('Create a new deal'),
    personId: z.number().optional().describe('Associated person ID'),
    name: z.string().optional().describe('Deal name'),
    price: z.number().optional().describe('Deal price/value'),
    stage: z.string().optional().describe('Deal stage'),
    closeDate: z
      .string()
      .optional()
      .describe('Expected close date (YYYY-MM-DD)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('update_deal').describe('Update an existing deal'),
    deal_id: z.number().describe('Deal ID to update'),
    name: z.string().optional().describe('Deal name'),
    price: z.number().optional().describe('Deal price/value'),
    stage: z.string().optional().describe('Deal stage'),
    closeDate: z
      .string()
      .optional()
      .describe('Expected close date (YYYY-MM-DD)'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Event operations (preferred for new leads)
  z.object({
    operation: z.literal('list_events').describe('List/search events'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    personId: z.number().optional().describe('Filter by person ID'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('get_event').describe('Get a specific event by ID'),
    event_id: z.number().describe('Event ID to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z
      .literal('create_event')
      .describe('Create an event (preferred for new leads)'),
    type: z
      .string()
      .min(1)
      .describe('Event type (e.g., "Showing Request", "Registration")'),
    source: z.string().optional().describe('Event source'),
    message: z.string().optional().describe('Event message'),
    person: z
      .object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        emails: z.array(z.object({ value: z.string().email() })).optional(),
        phones: z.array(z.object({ value: z.string() })).optional(),
        tags: z.array(z.string()).optional(),
      })
      .describe('Person data for the event'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Call operations
  z.object({
    operation: z.literal('list_calls').describe('List calls'),
    personId: z.number().optional().describe('Filter by person ID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('create_call').describe('Log a call'),
    personId: z.number().describe('Associated person ID'),
    outcome: z.string().optional().describe('Call outcome'),
    note: z.string().optional().describe('Call notes'),
    duration: z.number().optional().describe('Call duration in seconds'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Appointment operations
  z.object({
    operation: z.literal('list_appointments').describe('List appointments'),
    personId: z.number().optional().describe('Filter by person ID'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .default(25)
      .describe('Number of results to return'),
    offset: z
      .number()
      .optional()
      .default(0)
      .describe('Number of results to skip'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z
      .literal('create_appointment')
      .describe('Create an appointment'),
    personId: z.number().optional().describe('Associated person ID'),
    title: z.string().min(1).describe('Appointment title'),
    startTime: z.string().describe('Start time (ISO 8601)'),
    endTime: z.string().optional().describe('End time (ISO 8601)'),
    location: z.string().optional().describe('Location'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  // Webhook operations
  z.object({
    operation: z.literal('list_webhooks').describe('List registered webhooks'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z
      .literal('get_webhook')
      .describe('Get a specific webhook by ID'),
    webhook_id: z.number().describe('Webhook ID to retrieve'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('create_webhook').describe('Register a new webhook'),
    event: z
      .enum(FUB_WEBHOOK_EVENTS)
      .describe('Webhook event type to subscribe to'),
    url: z
      .string()
      .url()
      .describe('HTTPS callback URL for webhook notifications'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z
      .literal('update_webhook')
      .describe('Update an existing webhook'),
    webhook_id: z.number().describe('Webhook ID to update'),
    event: z
      .enum(FUB_WEBHOOK_EVENTS)
      .optional()
      .describe('New webhook event type'),
    url: z.string().url().optional().describe('New HTTPS callback URL'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),

  z.object({
    operation: z.literal('delete_webhook').describe('Delete a webhook'),
    webhook_id: z.number().describe('Webhook ID to delete'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Object mapping credential types to values (injected at runtime)'
      ),
  }),
]);

// Define result schemas for different operations
const FUBResultSchema = z.discriminatedUnion('operation', [
  // People results
  z.object({
    operation: z.literal('list_people'),
    success: z.boolean(),
    people: z.array(FUBPersonSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('get_person'),
    success: z.boolean(),
    person: FUBPersonSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_person'),
    success: z.boolean(),
    person: FUBPersonSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('update_person'),
    success: z.boolean(),
    person: FUBPersonSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('delete_person'),
    success: z.boolean(),
    deleted_id: z.number().optional(),
    error: z.string(),
  }),

  // Task results
  z.object({
    operation: z.literal('list_tasks'),
    success: z.boolean(),
    tasks: z.array(FUBTaskSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('get_task'),
    success: z.boolean(),
    task: FUBTaskSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_task'),
    success: z.boolean(),
    task: FUBTaskSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('update_task'),
    success: z.boolean(),
    task: FUBTaskSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('delete_task'),
    success: z.boolean(),
    deleted_id: z.number().optional(),
    error: z.string(),
  }),

  // Note results
  z.object({
    operation: z.literal('list_notes'),
    success: z.boolean(),
    notes: z.array(FUBNoteSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_note'),
    success: z.boolean(),
    note: FUBNoteSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('update_note'),
    success: z.boolean(),
    note: FUBNoteSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('delete_note'),
    success: z.boolean(),
    deleted_id: z.number().optional(),
    error: z.string(),
  }),

  // Deal results
  z.object({
    operation: z.literal('list_deals'),
    success: z.boolean(),
    deals: z.array(FUBDealSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('get_deal'),
    success: z.boolean(),
    deal: FUBDealSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_deal'),
    success: z.boolean(),
    deal: FUBDealSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('update_deal'),
    success: z.boolean(),
    deal: FUBDealSchema.optional(),
    error: z.string(),
  }),

  // Event results
  z.object({
    operation: z.literal('list_events'),
    success: z.boolean(),
    events: z.array(FUBEventSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('get_event'),
    success: z.boolean(),
    event: FUBEventSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_event'),
    success: z.boolean(),
    event: FUBEventSchema.optional(),
    error: z.string(),
  }),

  // Call results
  z.object({
    operation: z.literal('list_calls'),
    success: z.boolean(),
    calls: z.array(FUBCallSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_call'),
    success: z.boolean(),
    call: FUBCallSchema.optional(),
    error: z.string(),
  }),

  // Appointment results
  z.object({
    operation: z.literal('list_appointments'),
    success: z.boolean(),
    appointments: z.array(FUBAppointmentSchema).optional(),
    _metadata: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_appointment'),
    success: z.boolean(),
    appointment: FUBAppointmentSchema.optional(),
    error: z.string(),
  }),

  // Webhook results
  z.object({
    operation: z.literal('list_webhooks'),
    success: z.boolean(),
    webhooks: z.array(FUBWebhookSchema).optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('get_webhook'),
    success: z.boolean(),
    webhook: FUBWebhookSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('create_webhook'),
    success: z.boolean(),
    webhook: FUBWebhookSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('update_webhook'),
    success: z.boolean(),
    webhook: FUBWebhookSchema.optional(),
    error: z.string(),
  }),

  z.object({
    operation: z.literal('delete_webhook'),
    success: z.boolean(),
    deleted_id: z.number().optional(),
    error: z.string(),
  }),
]);

type FUBResult = z.output<typeof FUBResultSchema>;
type FUBParams = z.input<typeof FUBParamsSchema>;

// Helper type to get the result type for a specific operation
export type FUBOperationResult<T extends FUBParams['operation']> = Extract<
  FUBResult,
  { operation: T }
>;

// Export the input type for external usage
export type FUBParamsInput = z.input<typeof FUBParamsSchema>;

export class FollowUpBossBubble<
  T extends FUBParams = FUBParams,
> extends ServiceBubble<T, Extract<FUBResult, { operation: T['operation'] }>> {
  static readonly type = 'service' as const;
  static readonly service = 'followupboss';
  static readonly authType = 'oauth' as const;
  static readonly bubbleName = 'followupboss';
  static readonly schema = FUBParamsSchema;
  static readonly resultSchema = FUBResultSchema;
  static readonly shortDescription = 'Follow Up Boss CRM integration';
  static readonly longDescription = `
    Follow Up Boss CRM integration for real estate professionals.
    Use cases:
    - Manage contacts/people with full CRUD operations
    - Create and track tasks
    - Add notes to contacts
    - Manage deals in the pipeline
    - Log calls and appointments
    - Create events (preferred method for new leads)
    - Automate lead management workflows
  `;
  static readonly alias = 'fub';

  constructor(
    params: T = { operation: 'list_people' } as Extract<
      FUBParams,
      { operation: 'list_people' }
    > as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  public async testCredential(): Promise<boolean> {
    try {
      const response = await fetch('https://api.followupboss.com/v1/me', {
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
          'X-System': process.env.FUB_SYSTEM_NAME || 'Bubble-Lab',
          'X-System-Key': process.env.FUB_SYSTEM_KEY || '',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async makeFUBApiRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<unknown> {
    const url = `https://api.followupboss.com/v1${endpoint}`;

    const requestHeaders: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/json',
      'X-System': process.env.FUB_SYSTEM_NAME || 'Bubble-Lab',
      'X-System-Key': process.env.FUB_SYSTEM_KEY || '',
    };

    const requestInit: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FUB API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return await response.text();
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<FUBResult, { operation: T['operation'] }>> {
    void context;

    const { operation } = this.params;

    try {
      const result = await (async (): Promise<FUBResult> => {
        switch (operation) {
          // People operations
          case 'list_people':
            return await this.listPeople(
              this.params as Extract<FUBParams, { operation: 'list_people' }>
            );
          case 'get_person':
            return await this.getPerson(
              this.params as Extract<FUBParams, { operation: 'get_person' }>
            );
          case 'create_person':
            return await this.createPerson(
              this.params as Extract<FUBParams, { operation: 'create_person' }>
            );
          case 'update_person':
            return await this.updatePerson(
              this.params as Extract<FUBParams, { operation: 'update_person' }>
            );
          case 'delete_person':
            return await this.deletePerson(
              this.params as Extract<FUBParams, { operation: 'delete_person' }>
            );

          // Task operations
          case 'list_tasks':
            return await this.listTasks(
              this.params as Extract<FUBParams, { operation: 'list_tasks' }>
            );
          case 'get_task':
            return await this.getTask(
              this.params as Extract<FUBParams, { operation: 'get_task' }>
            );
          case 'create_task':
            return await this.createTask(
              this.params as Extract<FUBParams, { operation: 'create_task' }>
            );
          case 'update_task':
            return await this.updateTask(
              this.params as Extract<FUBParams, { operation: 'update_task' }>
            );
          case 'delete_task':
            return await this.deleteTask(
              this.params as Extract<FUBParams, { operation: 'delete_task' }>
            );

          // Note operations
          case 'list_notes':
            return await this.listNotes(
              this.params as Extract<FUBParams, { operation: 'list_notes' }>
            );
          case 'create_note':
            return await this.createNote(
              this.params as Extract<FUBParams, { operation: 'create_note' }>
            );
          case 'update_note':
            return await this.updateNote(
              this.params as Extract<FUBParams, { operation: 'update_note' }>
            );
          case 'delete_note':
            return await this.deleteNote(
              this.params as Extract<FUBParams, { operation: 'delete_note' }>
            );

          // Deal operations
          case 'list_deals':
            return await this.listDeals(
              this.params as Extract<FUBParams, { operation: 'list_deals' }>
            );
          case 'get_deal':
            return await this.getDeal(
              this.params as Extract<FUBParams, { operation: 'get_deal' }>
            );
          case 'create_deal':
            return await this.createDeal(
              this.params as Extract<FUBParams, { operation: 'create_deal' }>
            );
          case 'update_deal':
            return await this.updateDeal(
              this.params as Extract<FUBParams, { operation: 'update_deal' }>
            );

          // Event operations
          case 'list_events':
            return await this.listEvents(
              this.params as Extract<FUBParams, { operation: 'list_events' }>
            );
          case 'get_event':
            return await this.getEvent(
              this.params as Extract<FUBParams, { operation: 'get_event' }>
            );
          case 'create_event':
            return await this.createEvent(
              this.params as Extract<FUBParams, { operation: 'create_event' }>
            );

          // Call operations
          case 'list_calls':
            return await this.listCalls(
              this.params as Extract<FUBParams, { operation: 'list_calls' }>
            );
          case 'create_call':
            return await this.createCall(
              this.params as Extract<FUBParams, { operation: 'create_call' }>
            );

          // Appointment operations
          case 'list_appointments':
            return await this.listAppointments(
              this.params as Extract<
                FUBParams,
                { operation: 'list_appointments' }
              >
            );
          case 'create_appointment':
            return await this.createAppointment(
              this.params as Extract<
                FUBParams,
                { operation: 'create_appointment' }
              >
            );

          // Webhook operations
          case 'list_webhooks':
            return await this.listWebhooks(
              this.params as Extract<FUBParams, { operation: 'list_webhooks' }>
            );
          case 'get_webhook':
            return await this.getWebhook(
              this.params as Extract<FUBParams, { operation: 'get_webhook' }>
            );
          case 'create_webhook':
            return await this.createWebhook(
              this.params as Extract<FUBParams, { operation: 'create_webhook' }>
            );
          case 'update_webhook':
            return await this.updateWebhook(
              this.params as Extract<FUBParams, { operation: 'update_webhook' }>
            );
          case 'delete_webhook':
            return await this.deleteWebhook(
              this.params as Extract<FUBParams, { operation: 'delete_webhook' }>
            );

          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
      })();

      return result as Extract<FUBResult, { operation: T['operation'] }>;
    } catch (error) {
      return {
        operation,
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as Extract<FUBResult, { operation: T['operation'] }>;
    }
  }

  // People operations
  private async listPeople(
    params: Extract<FUBParams, { operation: 'list_people' }>
  ): Promise<Extract<FUBResult, { operation: 'list_people' }>> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.sort) queryParams.set('sort', params.sort);
    if (params.fields) queryParams.set('fields', params.fields);
    if (params.includeTrash) queryParams.set('includeTrash', 'true');

    const response = (await this.makeFUBApiRequest(
      `/people?${queryParams.toString()}`
    )) as { people?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_people',
      success: true,
      people: response.people as z.infer<typeof FUBPersonSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async getPerson(
    params: Extract<FUBParams, { operation: 'get_person' }>
  ): Promise<Extract<FUBResult, { operation: 'get_person' }>> {
    const queryParams = params.fields ? `?fields=${params.fields}` : '';
    const response = (await this.makeFUBApiRequest(
      `/people/${params.person_id}${queryParams}`
    )) as z.infer<typeof FUBPersonSchema>;

    return {
      operation: 'get_person',
      success: true,
      person: response,
      error: '',
    };
  }

  private async createPerson(
    params: Extract<FUBParams, { operation: 'create_person' }>
  ): Promise<Extract<FUBResult, { operation: 'create_person' }>> {
    const { operation: _, credentials: __, ...personData } = params;
    const response = (await this.makeFUBApiRequest(
      '/people',
      'POST',
      personData
    )) as z.infer<typeof FUBPersonSchema>;

    return {
      operation: 'create_person',
      success: true,
      person: response,
      error: '',
    };
  }

  private async updatePerson(
    params: Extract<FUBParams, { operation: 'update_person' }>
  ): Promise<Extract<FUBResult, { operation: 'update_person' }>> {
    const { operation: _, credentials: __, person_id, ...personData } = params;
    const response = (await this.makeFUBApiRequest(
      `/people/${person_id}`,
      'PUT',
      personData
    )) as z.infer<typeof FUBPersonSchema>;

    return {
      operation: 'update_person',
      success: true,
      person: response,
      error: '',
    };
  }

  private async deletePerson(
    params: Extract<FUBParams, { operation: 'delete_person' }>
  ): Promise<Extract<FUBResult, { operation: 'delete_person' }>> {
    await this.makeFUBApiRequest(`/people/${params.person_id}`, 'DELETE');

    return {
      operation: 'delete_person',
      success: true,
      deleted_id: params.person_id,
      error: '',
    };
  }

  // Task operations
  private async listTasks(
    params: Extract<FUBParams, { operation: 'list_tasks' }>
  ): Promise<Extract<FUBResult, { operation: 'list_tasks' }>> {
    const queryParams = new URLSearchParams();
    if (params.personId)
      queryParams.set('personId', params.personId.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = (await this.makeFUBApiRequest(
      `/tasks?${queryParams.toString()}`
    )) as { tasks?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_tasks',
      success: true,
      tasks: response.tasks as z.infer<typeof FUBTaskSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async getTask(
    params: Extract<FUBParams, { operation: 'get_task' }>
  ): Promise<Extract<FUBResult, { operation: 'get_task' }>> {
    const response = (await this.makeFUBApiRequest(
      `/tasks/${params.task_id}`
    )) as z.infer<typeof FUBTaskSchema>;

    return {
      operation: 'get_task',
      success: true,
      task: response,
      error: '',
    };
  }

  private async createTask(
    params: Extract<FUBParams, { operation: 'create_task' }>
  ): Promise<Extract<FUBResult, { operation: 'create_task' }>> {
    const { operation: _, credentials: __, ...taskData } = params;
    const response = (await this.makeFUBApiRequest(
      '/tasks',
      'POST',
      taskData
    )) as z.infer<typeof FUBTaskSchema>;

    return {
      operation: 'create_task',
      success: true,
      task: response,
      error: '',
    };
  }

  private async updateTask(
    params: Extract<FUBParams, { operation: 'update_task' }>
  ): Promise<Extract<FUBResult, { operation: 'update_task' }>> {
    const { operation: _, credentials: __, task_id, ...taskData } = params;
    const response = (await this.makeFUBApiRequest(
      `/tasks/${task_id}`,
      'PUT',
      taskData
    )) as z.infer<typeof FUBTaskSchema>;

    return {
      operation: 'update_task',
      success: true,
      task: response,
      error: '',
    };
  }

  private async deleteTask(
    params: Extract<FUBParams, { operation: 'delete_task' }>
  ): Promise<Extract<FUBResult, { operation: 'delete_task' }>> {
    await this.makeFUBApiRequest(`/tasks/${params.task_id}`, 'DELETE');

    return {
      operation: 'delete_task',
      success: true,
      deleted_id: params.task_id,
      error: '',
    };
  }

  // Note operations
  private async listNotes(
    params: Extract<FUBParams, { operation: 'list_notes' }>
  ): Promise<Extract<FUBResult, { operation: 'list_notes' }>> {
    const queryParams = new URLSearchParams();
    if (params.personId)
      queryParams.set('personId', params.personId.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = (await this.makeFUBApiRequest(
      `/notes?${queryParams.toString()}`
    )) as { notes?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_notes',
      success: true,
      notes: response.notes as z.infer<typeof FUBNoteSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async createNote(
    params: Extract<FUBParams, { operation: 'create_note' }>
  ): Promise<Extract<FUBResult, { operation: 'create_note' }>> {
    const { operation: _, credentials: __, ...noteData } = params;
    const response = (await this.makeFUBApiRequest(
      '/notes',
      'POST',
      noteData
    )) as z.infer<typeof FUBNoteSchema>;

    return {
      operation: 'create_note',
      success: true,
      note: response,
      error: '',
    };
  }

  private async updateNote(
    params: Extract<FUBParams, { operation: 'update_note' }>
  ): Promise<Extract<FUBResult, { operation: 'update_note' }>> {
    const { operation: _, credentials: __, note_id, ...noteData } = params;
    const response = (await this.makeFUBApiRequest(
      `/notes/${note_id}`,
      'PUT',
      noteData
    )) as z.infer<typeof FUBNoteSchema>;

    return {
      operation: 'update_note',
      success: true,
      note: response,
      error: '',
    };
  }

  private async deleteNote(
    params: Extract<FUBParams, { operation: 'delete_note' }>
  ): Promise<Extract<FUBResult, { operation: 'delete_note' }>> {
    await this.makeFUBApiRequest(`/notes/${params.note_id}`, 'DELETE');

    return {
      operation: 'delete_note',
      success: true,
      deleted_id: params.note_id,
      error: '',
    };
  }

  // Deal operations
  private async listDeals(
    params: Extract<FUBParams, { operation: 'list_deals' }>
  ): Promise<Extract<FUBResult, { operation: 'list_deals' }>> {
    const queryParams = new URLSearchParams();
    if (params.personId)
      queryParams.set('personId', params.personId.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = (await this.makeFUBApiRequest(
      `/deals?${queryParams.toString()}`
    )) as { deals?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_deals',
      success: true,
      deals: response.deals as z.infer<typeof FUBDealSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async getDeal(
    params: Extract<FUBParams, { operation: 'get_deal' }>
  ): Promise<Extract<FUBResult, { operation: 'get_deal' }>> {
    const response = (await this.makeFUBApiRequest(
      `/deals/${params.deal_id}`
    )) as z.infer<typeof FUBDealSchema>;

    return {
      operation: 'get_deal',
      success: true,
      deal: response,
      error: '',
    };
  }

  private async createDeal(
    params: Extract<FUBParams, { operation: 'create_deal' }>
  ): Promise<Extract<FUBResult, { operation: 'create_deal' }>> {
    const { operation: _, credentials: __, ...dealData } = params;
    const response = (await this.makeFUBApiRequest(
      '/deals',
      'POST',
      dealData
    )) as z.infer<typeof FUBDealSchema>;

    return {
      operation: 'create_deal',
      success: true,
      deal: response,
      error: '',
    };
  }

  private async updateDeal(
    params: Extract<FUBParams, { operation: 'update_deal' }>
  ): Promise<Extract<FUBResult, { operation: 'update_deal' }>> {
    const { operation: _, credentials: __, deal_id, ...dealData } = params;
    const response = (await this.makeFUBApiRequest(
      `/deals/${deal_id}`,
      'PUT',
      dealData
    )) as z.infer<typeof FUBDealSchema>;

    return {
      operation: 'update_deal',
      success: true,
      deal: response,
      error: '',
    };
  }

  // Event operations
  private async listEvents(
    params: Extract<FUBParams, { operation: 'list_events' }>
  ): Promise<Extract<FUBResult, { operation: 'list_events' }>> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.personId)
      queryParams.set('personId', params.personId.toString());

    const response = (await this.makeFUBApiRequest(
      `/events?${queryParams.toString()}`
    )) as { events?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_events',
      success: true,
      events: response.events as z.infer<typeof FUBEventSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async getEvent(
    params: Extract<FUBParams, { operation: 'get_event' }>
  ): Promise<Extract<FUBResult, { operation: 'get_event' }>> {
    const response = (await this.makeFUBApiRequest(
      `/events/${params.event_id}`
    )) as z.infer<typeof FUBEventSchema>;

    return {
      operation: 'get_event',
      success: true,
      event: response,
      error: '',
    };
  }

  private async createEvent(
    params: Extract<FUBParams, { operation: 'create_event' }>
  ): Promise<Extract<FUBResult, { operation: 'create_event' }>> {
    const { operation: _, credentials: __, ...eventData } = params;
    const response = (await this.makeFUBApiRequest(
      '/events',
      'POST',
      eventData
    )) as z.infer<typeof FUBEventSchema>;

    return {
      operation: 'create_event',
      success: true,
      event: response,
      error: '',
    };
  }

  // Call operations
  private async listCalls(
    params: Extract<FUBParams, { operation: 'list_calls' }>
  ): Promise<Extract<FUBResult, { operation: 'list_calls' }>> {
    const queryParams = new URLSearchParams();
    if (params.personId)
      queryParams.set('personId', params.personId.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = (await this.makeFUBApiRequest(
      `/calls?${queryParams.toString()}`
    )) as { calls?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_calls',
      success: true,
      calls: response.calls as z.infer<typeof FUBCallSchema>[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async createCall(
    params: Extract<FUBParams, { operation: 'create_call' }>
  ): Promise<Extract<FUBResult, { operation: 'create_call' }>> {
    const { operation: _, credentials: __, ...callData } = params;
    const response = (await this.makeFUBApiRequest(
      '/calls',
      'POST',
      callData
    )) as z.infer<typeof FUBCallSchema>;

    return {
      operation: 'create_call',
      success: true,
      call: response,
      error: '',
    };
  }

  // Appointment operations
  private async listAppointments(
    params: Extract<FUBParams, { operation: 'list_appointments' }>
  ): Promise<Extract<FUBResult, { operation: 'list_appointments' }>> {
    const queryParams = new URLSearchParams();
    if (params.personId)
      queryParams.set('personId', params.personId.toString());
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const response = (await this.makeFUBApiRequest(
      `/appointments?${queryParams.toString()}`
    )) as { appointments?: unknown[]; _metadata?: unknown };

    return {
      operation: 'list_appointments',
      success: true,
      appointments: response.appointments as z.infer<
        typeof FUBAppointmentSchema
      >[],
      _metadata: response._metadata as {
        total?: number;
        limit?: number;
        offset?: number;
      },
      error: '',
    };
  }

  private async createAppointment(
    params: Extract<FUBParams, { operation: 'create_appointment' }>
  ): Promise<Extract<FUBResult, { operation: 'create_appointment' }>> {
    const { operation: _, credentials: __, ...appointmentData } = params;
    const response = (await this.makeFUBApiRequest(
      '/appointments',
      'POST',
      appointmentData
    )) as z.infer<typeof FUBAppointmentSchema>;

    return {
      operation: 'create_appointment',
      success: true,
      appointment: response,
      error: '',
    };
  }

  // Webhook operations
  private async listWebhooks(
    params: Extract<FUBParams, { operation: 'list_webhooks' }>
  ): Promise<Extract<FUBResult, { operation: 'list_webhooks' }>> {
    void params;
    const response = (await this.makeFUBApiRequest('/webhooks')) as {
      webhooks?: unknown[];
    };

    return {
      operation: 'list_webhooks',
      success: true,
      webhooks: response.webhooks as z.infer<typeof FUBWebhookSchema>[],
      error: '',
    };
  }

  private async getWebhook(
    params: Extract<FUBParams, { operation: 'get_webhook' }>
  ): Promise<Extract<FUBResult, { operation: 'get_webhook' }>> {
    const response = (await this.makeFUBApiRequest(
      `/webhooks/${params.webhook_id}`
    )) as z.infer<typeof FUBWebhookSchema>;

    return {
      operation: 'get_webhook',
      success: true,
      webhook: response,
      error: '',
    };
  }

  private async createWebhook(
    params: Extract<FUBParams, { operation: 'create_webhook' }>
  ): Promise<Extract<FUBResult, { operation: 'create_webhook' }>> {
    const { operation: _, credentials: __, ...webhookData } = params;
    const response = (await this.makeFUBApiRequest(
      '/webhooks',
      'POST',
      webhookData
    )) as z.infer<typeof FUBWebhookSchema>;

    return {
      operation: 'create_webhook',
      success: true,
      webhook: response,
      error: '',
    };
  }

  private async updateWebhook(
    params: Extract<FUBParams, { operation: 'update_webhook' }>
  ): Promise<Extract<FUBResult, { operation: 'update_webhook' }>> {
    const {
      operation: _,
      credentials: __,
      webhook_id,
      ...webhookData
    } = params;
    const response = (await this.makeFUBApiRequest(
      `/webhooks/${webhook_id}`,
      'PUT',
      webhookData
    )) as z.infer<typeof FUBWebhookSchema>;

    return {
      operation: 'update_webhook',
      success: true,
      webhook: response,
      error: '',
    };
  }

  private async deleteWebhook(
    params: Extract<FUBParams, { operation: 'delete_webhook' }>
  ): Promise<Extract<FUBResult, { operation: 'delete_webhook' }>> {
    await this.makeFUBApiRequest(`/webhooks/${params.webhook_id}`, 'DELETE');

    return {
      operation: 'delete_webhook',
      success: true,
      deleted_id: params.webhook_id,
      error: '',
    };
  }

  protected chooseCredential(): string | undefined {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }

    if (credentials[CredentialType.FUB_API_KEY_CRED]) {
      return credentials[CredentialType.FUB_API_KEY_CRED];
    }

    if (credentials[CredentialType.FUB_CRED]) {
      return credentials[CredentialType.FUB_CRED];
    }

    return undefined;
  }

  private getAuthHeader(): string {
    const { credentials } = this.params as {
      credentials?: Record<string, string>;
    };

    if (!credentials || typeof credentials !== 'object') {
      throw new Error('No Follow Up Boss credentials provided');
    }

    // OAuth takes priority - uses Bearer token
    if (credentials[CredentialType.FUB_CRED]) {
      return `Bearer ${credentials[CredentialType.FUB_CRED]}`;
    }

    // Fall back to API key - uses Basic auth (key as username, empty password)
    if (credentials[CredentialType.FUB_API_KEY_CRED]) {
      const apiKey = credentials[CredentialType.FUB_API_KEY_CRED];
      return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
    }

    throw new Error(
      'No Follow Up Boss credentials provided (OAuth or API key)'
    );
  }
}
