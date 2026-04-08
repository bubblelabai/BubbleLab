import {
  BubbleFlow,
  ClerkBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  userId: string;
  organizationId: string;
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

export class ClerkIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];
    let userId = '';
    let organizationId = '';

    // 1. List users
    const listUsersResult = await new ClerkBubble({
      operation: 'list_users',
      limit: 5,
    }).action();
    results.push({
      operation: 'list_users',
      success: listUsersResult.success,
      details: listUsersResult.success
        ? `Found ${(listUsersResult as { users?: unknown[] }).users?.length || 0} users`
        : listUsersResult.error,
    });

    // 2. Create a test user with edge-case data
    const testEmail = `clerk-test-${Date.now()}@bubblelab-test.dev`;
    const createUserResult = await new ClerkBubble({
      operation: 'create_user',
      email_address: [testEmail],
      first_name: "Test O'Brien",
      last_name: 'User Jr.',
      public_metadata: { source: 'integration-test', unicode: 'cafe\u0301' },
    }).action();
    results.push({
      operation: 'create_user',
      success: createUserResult.success,
      details: createUserResult.success
        ? `Created user ${(createUserResult as { user?: { id?: string } }).user?.id}`
        : createUserResult.error,
    });
    userId = (createUserResult as { user?: { id?: string } }).user?.id || '';

    if (userId) {
      // 3. Get the created user
      const getUserResult = await new ClerkBubble({
        operation: 'get_user',
        user_id: userId,
      }).action();
      results.push({
        operation: 'get_user',
        success: getUserResult.success,
        details: getUserResult.success
          ? `Retrieved user ${userId}`
          : getUserResult.error,
      });

      // 4. Update the user
      const updateUserResult = await new ClerkBubble({
        operation: 'update_user',
        user_id: userId,
        first_name: 'Updated',
        last_name: 'Name',
      }).action();
      results.push({
        operation: 'update_user',
        success: updateUserResult.success,
        details: updateUserResult.success
          ? `Updated user ${userId}`
          : updateUserResult.error,
      });

      // 5. Ban the user
      const banResult = await new ClerkBubble({
        operation: 'ban_user',
        user_id: userId,
      }).action();
      results.push({
        operation: 'ban_user',
        success: banResult.success,
        details: banResult.success ? `Banned user ${userId}` : banResult.error,
      });

      // 6. Unban the user
      const unbanResult = await new ClerkBubble({
        operation: 'unban_user',
        user_id: userId,
      }).action();
      results.push({
        operation: 'unban_user',
        success: unbanResult.success,
        details: unbanResult.success
          ? `Unbanned user ${userId}`
          : unbanResult.error,
      });

      // 7. Get user subscription (billing)
      const subscriptionResult = await new ClerkBubble({
        operation: 'get_user_subscription',
        user_id: userId,
      }).action();
      results.push({
        operation: 'get_user_subscription',
        success: subscriptionResult.success,
        details: subscriptionResult.success
          ? `Got subscription for user ${userId}`
          : subscriptionResult.error,
      });

      // 8. Delete the test user (cleanup)
      const deleteResult = await new ClerkBubble({
        operation: 'delete_user',
        user_id: userId,
      }).action();
      results.push({
        operation: 'delete_user',
        success: deleteResult.success,
        details: deleteResult.success
          ? `Deleted user ${userId}`
          : deleteResult.error,
      });
    }

    // 9. List organizations
    const listOrgsResult = await new ClerkBubble({
      operation: 'list_organizations',
      limit: 5,
    }).action();
    results.push({
      operation: 'list_organizations',
      success: listOrgsResult.success,
      details: listOrgsResult.success
        ? `Found ${(listOrgsResult as { organizations?: unknown[] }).organizations?.length || 0} organizations`
        : listOrgsResult.error,
    });

    // 10. Create a test organization
    const orgSlug = `test-org-${Date.now()}`;
    const createOrgResult = await new ClerkBubble({
      operation: 'create_organization',
      name: 'BubbleLab Test Org',
      slug: orgSlug,
      public_metadata: { source: 'integration-test' },
    }).action();
    results.push({
      operation: 'create_organization',
      success: createOrgResult.success,
      details: createOrgResult.success
        ? `Created org ${(createOrgResult as { organization?: { id?: string } }).organization?.id}`
        : createOrgResult.error,
    });
    organizationId =
      (createOrgResult as { organization?: { id?: string } }).organization
        ?.id || '';

    if (organizationId) {
      // 11. Get the organization
      const getOrgResult = await new ClerkBubble({
        operation: 'get_organization',
        organization_id: organizationId,
      }).action();
      results.push({
        operation: 'get_organization',
        success: getOrgResult.success,
        details: getOrgResult.success
          ? `Retrieved org ${organizationId}`
          : getOrgResult.error,
      });

      // 12. Update the organization
      const updateOrgResult = await new ClerkBubble({
        operation: 'update_organization',
        organization_id: organizationId,
        name: 'Updated Test Org',
      }).action();
      results.push({
        operation: 'update_organization',
        success: updateOrgResult.success,
        details: updateOrgResult.success
          ? `Updated org ${organizationId}`
          : updateOrgResult.error,
      });

      // 13. List memberships
      const membershipsResult = await new ClerkBubble({
        operation: 'list_organization_memberships',
        organization_id: organizationId,
      }).action();
      results.push({
        operation: 'list_organization_memberships',
        success: membershipsResult.success,
        details: membershipsResult.success
          ? `Found ${(membershipsResult as { memberships?: unknown[] }).memberships?.length || 0} memberships`
          : membershipsResult.error,
      });

      // 14. Delete the test organization (cleanup)
      const deleteOrgResult = await new ClerkBubble({
        operation: 'delete_organization',
        organization_id: organizationId,
      }).action();
      results.push({
        operation: 'delete_organization',
        success: deleteOrgResult.success,
        details: deleteOrgResult.success
          ? `Deleted org ${organizationId}`
          : deleteOrgResult.error,
      });
    }

    // 15. List invitations
    const listInvResult = await new ClerkBubble({
      operation: 'list_invitations',
      limit: 5,
    }).action();
    results.push({
      operation: 'list_invitations',
      success: listInvResult.success,
      details: listInvResult.success
        ? `Found ${(listInvResult as { invitations?: unknown[] }).invitations?.length || 0} invitations`
        : listInvResult.error,
    });

    // 16. List sessions
    const listSessionsResult = await new ClerkBubble({
      operation: 'list_sessions',
      limit: 5,
    }).action();
    results.push({
      operation: 'list_sessions',
      success: listSessionsResult.success,
      details: listSessionsResult.success
        ? `Found ${(listSessionsResult as { sessions?: unknown[] }).sessions?.length || 0} sessions`
        : listSessionsResult.error,
    });

    return { userId, organizationId, testResults: results };
  }
}
