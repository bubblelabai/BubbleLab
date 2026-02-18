import { describe, it, expect } from 'vitest';
import { AttioParamsSchema, AttioResultSchema } from './attio.schema.js';
import { AttioBubble } from './attio.js';

describe('AttioParamsSchema', () => {
  it('should validate list_records operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_records',
      object: 'people',
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should validate list_records with defaults', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_records',
      object: 'companies',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
      expect(result.data.offset).toBe(0);
    }
  });

  it('should validate get_record operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'get_record',
      object: 'people',
      record_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('should validate create_record operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_record',
      object: 'people',
      values: {
        name: [{ first_name: 'John', last_name: 'Doe' }],
        email_addresses: [{ email_address: 'john@example.com' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate create_record with matching_attribute (upsert)', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_record',
      object: 'people',
      values: {
        email_addresses: [{ email_address: 'john@example.com' }],
      },
      matching_attribute: 'email_addresses',
    });
    expect(result.success).toBe(true);
  });

  it('should validate update_record operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'update_record',
      object: 'companies',
      record_id: '123e4567-e89b-12d3-a456-426614174000',
      values: {
        name: [{ value: 'Acme Corp' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate delete_record operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'delete_record',
      object: 'people',
      record_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('should validate create_note operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_note',
      parent_object: 'people',
      parent_record_id: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Meeting Notes',
      content: 'Discussed Q4 roadmap',
    });
    expect(result.success).toBe(true);
  });

  it('should validate list_notes operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_notes',
    });
    expect(result.success).toBe(true);
  });

  it('should validate create_task operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_task',
      content: 'Follow up with client',
      deadline_at: '2025-12-31T23:59:59Z',
      linked_records: [
        {
          target_object: 'people',
          target_record_id: '123e4567-e89b-12d3-a456-426614174000',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should validate list_tasks operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_tasks',
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should validate update_task operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'update_task',
      task_id: '123e4567-e89b-12d3-a456-426614174000',
      is_completed: true,
    });
    expect(result.success).toBe(true);
  });

  it('should validate delete_task operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'delete_task',
      task_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('should validate list_lists operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_lists',
    });
    expect(result.success).toBe(true);
  });

  it('should validate create_entry operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_entry',
      list: 'sales-pipeline',
      parent_object: 'companies',
      parent_record_id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });

  it('should validate list_entries operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_entries',
      list: 'sales-pipeline',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid operation', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'invalid_operation',
    });
    expect(result.success).toBe(false);
  });

  it('should reject list_records without object', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'list_records',
    });
    expect(result.success).toBe(false);
  });

  it('should reject create_task without content', () => {
    const result = AttioParamsSchema.safeParse({
      operation: 'create_task',
    });
    expect(result.success).toBe(false);
  });
});

describe('AttioResultSchema', () => {
  it('should validate successful list_records result', () => {
    const result = AttioResultSchema.safeParse({
      operation: 'list_records',
      records: [{ id: '123', values: {} }],
      success: true,
      error: '',
    });
    expect(result.success).toBe(true);
  });

  it('should validate error result', () => {
    const result = AttioResultSchema.safeParse({
      operation: 'get_record',
      success: false,
      error: 'Record not found',
    });
    expect(result.success).toBe(true);
  });
});

describe('AttioBubble', () => {
  it('should construct with default parameters', () => {
    const bubble = new AttioBubble();
    expect(bubble).toBeDefined();
  });

  it('should construct with specific operation', () => {
    const bubble = new AttioBubble({
      operation: 'list_records',
      object: 'companies',
      limit: 10,
    });
    expect(bubble).toBeDefined();
  });

  it('should have correct static properties', () => {
    expect(AttioBubble.bubbleName).toBe('attio');
    expect(AttioBubble.type).toBe('service');
    expect(AttioBubble.authType).toBe('oauth');
    expect(AttioBubble.service).toBe('attio');
  });
});
