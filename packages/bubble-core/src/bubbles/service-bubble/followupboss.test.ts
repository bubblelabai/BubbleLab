import { GetBubbleDetailsTool } from '../tool-bubble/get-bubble-details-tool.js';
import { describe, expect } from 'vitest';

describe('FollowUpBoss Bubble Details', () => {
  it('should get bubble details for followupboss', async () => {
    const tool = new GetBubbleDetailsTool({ bubbleName: 'followupboss' });
    const result = await tool.action();
    console.log(result.data?.usageExample);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.name).toBe('followupboss');
    expect(result.data?.alias).toBe('fub');
    expect(result.data?.usageExample).toBeDefined();
    expect(result.data?.usageExample).toContain('peopleCreated');
    expect(result.data?.usageExample).toContain('peopleUpdated');
    expect(result.data?.usageExample).toContain('peopleDeleted');
    expect(result.data?.usageExample).toContain('peopleTagsCreated');
    expect(result.data?.usageExample).toContain('peopleStageUpdated');
    expect(result.data?.usageExample).toContain('peopleRelationshipCreated');
    expect(result.data?.usageExample).toContain('peopleRelationshipUpdated');
    expect(result.data?.usageExample).toContain('peopleRelationshipDeleted');
  });
});
