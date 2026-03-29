import { BubbleFlow, type WebhookEvent } from '../../../index.js';
import { AsanaBubble } from './asana.js';

export interface Output {
  testResults: {
    operation: string;
    success: boolean;
    details?: string;
  }[];
}

export interface TestPayload extends WebhookEvent {
  testName?: string;
}

/**
 * Integration flow test for the Asana bubble.
 * Exercises major operations: projects, sections, tasks, comments, tags,
 * users, teams, workspaces, search, and dependencies.
 */
export class AsanaIntegrationTest extends BubbleFlow<'webhook/http'> {
  async handle(_payload: TestPayload): Promise<Output> {
    const results: Output['testResults'] = [];

    // 1. List workspaces
    const workspacesResult = await new AsanaBubble({
      operation: 'list_workspaces',
      limit: 10,
    }).action();

    results.push({
      operation: 'list_workspaces',
      success: workspacesResult.success,
      details: workspacesResult.success
        ? `Found ${workspacesResult.workspaces?.length} workspaces`
        : workspacesResult.error,
    });

    // 2. List projects
    const projectsResult = await new AsanaBubble({
      operation: 'list_projects',
      limit: 10,
      opt_fields: ['name', 'color', 'archived'],
    }).action();

    results.push({
      operation: 'list_projects',
      success: projectsResult.success,
      details: projectsResult.success
        ? `Found ${projectsResult.projects?.length} projects`
        : projectsResult.error,
    });

    // 3. Create a test project
    const projectName = `Integration Test ${Date.now()}`;
    const createProjectResult = await new AsanaBubble({
      operation: 'create_project',
      name: projectName,
      notes: 'Created by Asana integration test',
      layout: 'list',
    }).action();

    results.push({
      operation: 'create_project',
      success: createProjectResult.success,
      details: createProjectResult.success
        ? `Created project: ${(createProjectResult.project as Record<string, unknown>)?.name}`
        : createProjectResult.error,
    });

    const projectGid = (createProjectResult.project as Record<string, unknown>)
      ?.gid as string | undefined;

    if (!projectGid) {
      results.push({
        operation: 'remaining',
        success: false,
        details: 'Skipped — could not create test project',
      });
      return { testResults: results };
    }

    // 4. Get project details
    const getProjectResult = await new AsanaBubble({
      operation: 'get_project',
      project_gid: projectGid,
      opt_fields: ['name', 'notes', 'color', 'created_at'],
    }).action();

    results.push({
      operation: 'get_project',
      success: getProjectResult.success,
      details: getProjectResult.success
        ? `Got project: ${(getProjectResult.project as Record<string, unknown>)?.name}`
        : getProjectResult.error,
    });

    // 5. Create section in project
    const createSectionResult = await new AsanaBubble({
      operation: 'create_section',
      project_gid: projectGid,
      name: 'In Progress',
    }).action();

    results.push({
      operation: 'create_section',
      success: createSectionResult.success,
      details: createSectionResult.success
        ? `Created section: ${(createSectionResult.section as Record<string, unknown>)?.name}`
        : createSectionResult.error,
    });

    const sectionGid = (createSectionResult.section as Record<string, unknown>)
      ?.gid as string | undefined;

    // 6. List sections
    const listSectionsResult = await new AsanaBubble({
      operation: 'list_sections',
      project_gid: projectGid,
    }).action();

    results.push({
      operation: 'list_sections',
      success: listSectionsResult.success,
      details: listSectionsResult.success
        ? `Found ${listSectionsResult.sections?.length} sections`
        : listSectionsResult.error,
    });

    // 7. Create a task with edge-case characters
    const createTaskResult = await new AsanaBubble({
      operation: 'create_task',
      name: 'Test Task: "Special Chars" & émojis 🎉',
      notes: 'Description with\nnewlines\nand "quotes"',
      projects: [projectGid],
      due_on: '2025-12-31',
    }).action();

    results.push({
      operation: 'create_task',
      success: createTaskResult.success,
      details: createTaskResult.success
        ? `Created task: ${(createTaskResult.task as Record<string, unknown>)?.gid}`
        : createTaskResult.error,
    });

    const taskGid = (createTaskResult.task as Record<string, unknown>)?.gid as
      | string
      | undefined;

    if (!taskGid) {
      // Clean up project and return
      await new AsanaBubble({
        operation: 'update_project',
        project_gid: projectGid,
        archived: true,
      }).action();
      return { testResults: results };
    }

    // 8. Get task details
    const getTaskResult = await new AsanaBubble({
      operation: 'get_task',
      task_gid: taskGid,
      opt_fields: [
        'name',
        'notes',
        'due_on',
        'completed',
        'assignee',
        'projects',
      ],
    }).action();

    results.push({
      operation: 'get_task',
      success: getTaskResult.success,
      details: getTaskResult.success
        ? `Got task: ${(getTaskResult.task as Record<string, unknown>)?.name}`
        : getTaskResult.error,
    });

    // 9. Update task
    const updateTaskResult = await new AsanaBubble({
      operation: 'update_task',
      task_gid: taskGid,
      name: 'Updated Task Name',
      notes: 'Updated description',
      completed: false,
    }).action();

    results.push({
      operation: 'update_task',
      success: updateTaskResult.success,
      details: updateTaskResult.success
        ? `Updated task: ${(updateTaskResult.task as Record<string, unknown>)?.name}`
        : updateTaskResult.error,
    });

    // 10. Add task to section
    if (sectionGid) {
      const addToSectionResult = await new AsanaBubble({
        operation: 'add_task_to_section',
        task_gid: taskGid,
        section_gid: sectionGid,
      }).action();

      results.push({
        operation: 'add_task_to_section',
        success: addToSectionResult.success,
        details: addToSectionResult.success
          ? 'Added task to section'
          : addToSectionResult.error,
      });
    }

    // 11. Add a comment
    const commentResult = await new AsanaBubble({
      operation: 'add_comment',
      task_gid: taskGid,
      text: 'Integration test comment with "special chars"',
    }).action();

    results.push({
      operation: 'add_comment',
      success: commentResult.success,
      details: commentResult.success
        ? 'Added comment to task'
        : commentResult.error,
    });

    // 12. Get task stories
    const storiesResult = await new AsanaBubble({
      operation: 'get_task_stories',
      task_gid: taskGid,
      limit: 10,
    }).action();

    results.push({
      operation: 'get_task_stories',
      success: storiesResult.success,
      details: storiesResult.success
        ? `Got ${storiesResult.stories?.length} stories`
        : storiesResult.error,
    });

    // 13. Search tasks
    const searchResult = await new AsanaBubble({
      operation: 'search_tasks',
      text: 'Updated Task Name',
      completed: false,
      limit: 5,
    }).action();

    results.push({
      operation: 'search_tasks',
      success: searchResult.success,
      details: searchResult.success
        ? `Search found ${searchResult.tasks?.length} tasks`
        : searchResult.error,
    });

    // 14. List users
    const usersResult = await new AsanaBubble({
      operation: 'list_users',
      limit: 5,
    }).action();

    results.push({
      operation: 'list_users',
      success: usersResult.success,
      details: usersResult.success
        ? `Found ${usersResult.users?.length} users`
        : usersResult.error,
    });

    // 15. Get current user
    const meResult = await new AsanaBubble({
      operation: 'get_user',
      user_gid: 'me',
    }).action();

    results.push({
      operation: 'get_user',
      success: meResult.success,
      details: meResult.success
        ? `Current user: ${(meResult.user as Record<string, unknown>)?.name}`
        : meResult.error,
    });

    // 16. List tags
    const tagsResult = await new AsanaBubble({
      operation: 'list_tags',
      limit: 10,
    }).action();

    results.push({
      operation: 'list_tags',
      success: tagsResult.success,
      details: tagsResult.success
        ? `Found ${tagsResult.tags?.length} tags`
        : tagsResult.error,
    });

    // 17. List teams
    const teamsResult = await new AsanaBubble({
      operation: 'list_teams',
      limit: 10,
    }).action();

    results.push({
      operation: 'list_teams',
      success: teamsResult.success,
      details: teamsResult.success
        ? `Found ${teamsResult.teams?.length} teams`
        : teamsResult.error,
    });

    // 18. Create a second task for dependency testing
    const task2Result = await new AsanaBubble({
      operation: 'create_task',
      name: 'Dependency test task',
      projects: [projectGid],
    }).action();

    const task2Gid = (task2Result.task as Record<string, unknown>)?.gid as
      | string
      | undefined;

    if (task2Gid) {
      // 19. Set dependency
      const depResult = await new AsanaBubble({
        operation: 'set_dependencies',
        task_gid: task2Gid,
        dependencies: [taskGid],
      }).action();

      results.push({
        operation: 'set_dependencies',
        success: depResult.success,
        details: depResult.success ? 'Set task dependency' : depResult.error,
      });

      // Clean up second task
      await new AsanaBubble({
        operation: 'delete_task',
        task_gid: task2Gid,
      }).action();
    }

    // 20. Delete task
    const deleteResult = await new AsanaBubble({
      operation: 'delete_task',
      task_gid: taskGid,
    }).action();

    results.push({
      operation: 'delete_task',
      success: deleteResult.success,
      details: deleteResult.success ? 'Deleted test task' : deleteResult.error,
    });

    // 21. Archive (clean up) test project
    const archiveResult = await new AsanaBubble({
      operation: 'update_project',
      project_gid: projectGid,
      archived: true,
    }).action();

    results.push({
      operation: 'update_project (archive)',
      success: archiveResult.success,
      details: archiveResult.success
        ? 'Archived test project'
        : archiveResult.error,
    });

    return { testResults: results };
  }
}
