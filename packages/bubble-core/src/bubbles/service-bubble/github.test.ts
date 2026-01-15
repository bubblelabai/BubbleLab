import { describe, it, expect } from 'vitest';
import { GithubBubble } from './github.js';
import { CredentialType } from '@bubblelab/shared-schemas';

describe('GithubBubble', () => {
  describe('Schema Validation', () => {
    it('should validate get_file operation with required parameters', () => {
      const params = {
        operation: 'get_file' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'README.md',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate get_file operation with optional ref parameter', () => {
      const params = {
        operation: 'get_file' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'README.md',
        ref: 'main',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate list_pull_requests operation with defaults', () => {
      const params = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('open');
        expect(result.data.sort).toBe('created');
        expect(result.data.direction).toBe('desc');
        expect(result.data.per_page).toBe(30);
        expect(result.data.page).toBe(1);
      }
    });

    it('should validate get_pull_request operation', () => {
      const params = {
        operation: 'get_pull_request' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        pull_number: 1,
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate create_pr_comment operation', () => {
      const params = {
        operation: 'create_pr_comment' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        pull_number: 1,
        body: 'Great work!',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate list_repositories operation with defaults', () => {
      const params = {
        operation: 'list_repositories' as const,
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.visibility).toBe('all');
        expect(result.data.sort).toBe('updated');
        expect(result.data.direction).toBe('desc');
      }
    });

    it('should validate get_repository operation', () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate create_issue_comment operation', () => {
      const params = {
        operation: 'create_issue_comment' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        issue_number: 1,
        body: 'Thanks for reporting this!',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
    });

    it('should validate list_issues operation with defaults', () => {
      const params = {
        operation: 'list_issues' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.state).toBe('open');
        expect(result.data.sort).toBe('created');
        expect(result.data.direction).toBe('desc');
      }
    });

    it('should validate get_directory operation with optional path', () => {
      const params = {
        operation: 'get_directory' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe('');
      }
    });

    it('should fail validation without required parameters', () => {
      const params = {
        operation: 'get_file' as const,
        // missing owner, repo, path
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should fail validation with empty owner', () => {
      const params = {
        operation: 'get_file' as const,
        owner: '',
        repo: 'Hello-World',
        path: 'README.md',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should fail validation with empty comment body', () => {
      const params = {
        operation: 'create_pr_comment' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        pull_number: 1,
        body: '',
      };

      const result = GithubBubble.schema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe('Bubble Instantiation', () => {
    it('should instantiate with valid parameters', () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const bubble = new GithubBubble(params);
      expect(bubble).toBeInstanceOf(GithubBubble);
      expect(GithubBubble.bubbleName).toBe('github');
    });

    it('should instantiate with default parameters', () => {
      const bubble = new GithubBubble();
      expect(bubble).toBeInstanceOf(GithubBubble);
      expect(GithubBubble.bubbleName).toBe('github');
    });
  });

  describe('Credential Selection', () => {
    it('should choose GITHUB_TOKEN credential when provided', () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        credentials: {
          [CredentialType.GITHUB_TOKEN]: 'ghp_test_token',
        },
      };

      const bubble = new GithubBubble(params);
      // @ts-expect-error - Accessing protected method for testing
      const credential = bubble.chooseCredential();
      expect(credential).toBe('ghp_test_token');
    });

    it('should return undefined when no credentials provided', () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const bubble = new GithubBubble(params);
      // @ts-expect-error - Accessing protected method for testing
      const credential = bubble.chooseCredential();
      expect(credential).toBeUndefined();
    });
  });

  describe('Static Metadata', () => {
    it('should have correct static metadata', () => {
      expect(GithubBubble.bubbleName).toBe('github');
      expect(GithubBubble.type).toBe('service');
      expect(GithubBubble.service).toBe('github');
      expect(GithubBubble.authType).toBe('apikey');
      expect(GithubBubble.alias).toBe('gh');
      expect(GithubBubble.shortDescription).toBeTruthy();
      expect(GithubBubble.longDescription).toBeTruthy();
      expect(GithubBubble.schema).toBeDefined();
      expect(GithubBubble.resultSchema).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return error result when operation fails without credentials', async () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const bubble = new GithubBubble(params);
      const result = await bubble.action();

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('GitHub token credential not found');
    });
  });

  describe('Type Safety', () => {
    it('should correctly type discriminated union params', () => {
      const getFileParams = {
        operation: 'get_file' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'README.md',
      };

      const listPRsParams = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'open' as const,
      };

      const bubble1 = new GithubBubble(getFileParams);
      const bubble2 = new GithubBubble(listPRsParams);

      expect(bubble1).toBeInstanceOf(GithubBubble);
      expect(bubble2).toBeInstanceOf(GithubBubble);
    });
  });

  describe('Mock Result Generation', () => {
    it('should generate mock result for get_repository operation', () => {
      const params = {
        operation: 'get_repository' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const bubble = new GithubBubble(params);
      const mockResult = bubble.generateMockResult();

      expect(mockResult.success).toBe(true);
      expect(mockResult.data).toBeDefined();
    });

    it('should generate mock result for list_pull_requests operation', () => {
      const params = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
      };

      const bubble = new GithubBubble(params);
      const mockResult = bubble.generateMockResult();

      expect(mockResult.success).toBe(true);
      expect(mockResult.data).toBeDefined();
      // Mock result may not be an array, just verify it exists
      expect(mockResult).toHaveProperty('data');
    });

    it('should generate mock result for get_file operation', () => {
      const params = {
        operation: 'get_file' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'README.md',
      };

      const bubble = new GithubBubble(params);
      const mockResult = bubble.generateMockResult();

      expect(mockResult.success).toBe(true);
      expect(mockResult.data).toBeDefined();
    });
  });

  describe('Parameter Validation Edge Cases', () => {
    it('should validate per_page limits for list_pull_requests', () => {
      const paramsValid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        per_page: 50,
      };

      const paramsInvalid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        per_page: 150,
      };

      expect(GithubBubble.schema.safeParse(paramsValid).success).toBe(true);
      expect(GithubBubble.schema.safeParse(paramsInvalid).success).toBe(false);
    });

    it('should validate state enum values', () => {
      const paramsValid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'all' as const,
      };

      const paramsInvalid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'invalid',
      };

      expect(GithubBubble.schema.safeParse(paramsValid).success).toBe(true);
      expect(GithubBubble.schema.safeParse(paramsInvalid).success).toBe(false);
    });

    it('should validate sort enum values', () => {
      const paramsValid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        sort: 'popularity' as const,
      };

      const paramsInvalid = {
        operation: 'list_pull_requests' as const,
        owner: 'octocat',
        repo: 'Hello-World',
        sort: 'invalid',
      };

      expect(GithubBubble.schema.safeParse(paramsValid).success).toBe(true);
      expect(GithubBubble.schema.safeParse(paramsInvalid).success).toBe(false);
    });
  });

  describe('Integration Tests (Real GitHub API)', () => {
    const getGithubToken = (): string | undefined => {
      return process.env.GITHUB_TOKEN;
    };

    it('should get repository details from a real repo', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (get_repository) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_repository',
        owner: 'octocat',
        repo: 'Hello-World',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('get_repository');
      expect(result.data.data).toBeDefined();
      if (result.data.data) {
        expect(result.data.data.name).toBe('Hello-World');
        expect(result.data.data.owner.login).toBe('octocat');
      }
    });

    it('should get a file from a real repo', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (get_file) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_file',
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'README',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('get_file');
      expect(result.data.data).toBeDefined();
      if (result.data.data) {
        expect(result.data.data.name).toBe('README');
        expect(result.data.data.path).toBe('README');
        expect(result.data.data.type).toBe('file');
      }
    });

    it('should list directory contents from a real repo', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (get_directory) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_directory',
        owner: 'octocat',
        repo: 'Hello-World',
        path: '',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('get_directory');
      expect(result.data.data).toBeDefined();
      expect(Array.isArray(result.data.data)).toBe(true);
    });

    it('should list pull requests from a real repo', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (list_pull_requests) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'list_pull_requests',
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'all',
        per_page: 5,
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('list_pull_requests');
      expect(result.data.data).toBeDefined();
      expect(Array.isArray(result.data.data)).toBe(true);
    });

    it('should list issues from a real repo', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (list_issues) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'list_issues',
        owner: 'octocat',
        repo: 'Hello-World',
        state: 'all',
        per_page: 5,
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('list_issues');
      expect(result.data.data).toBeDefined();
      expect(Array.isArray(result.data.data)).toBe(true);
    });

    it('should list repositories for authenticated user', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (list_repositories) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'list_repositories',
        visibility: 'all',
        per_page: 5,
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.operation).toBe('list_repositories');
      expect(result.data.data).toBeDefined();
      expect(Array.isArray(result.data.data)).toBe(true);
    });

    it('should test credential validation', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (testCredential) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_repository',
        owner: 'octocat',
        repo: 'Hello-World',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const isValid = await bubble.testCredential();
      expect(isValid).toBe(true);
    });

    it('should fail with invalid credentials', async () => {
      const bubble = new GithubBubble({
        operation: 'get_repository',
        owner: 'octocat',
        repo: 'Hello-World',
        credentials: { [CredentialType.GITHUB_TOKEN]: 'ghp_invalid_token_123' },
      });

      const result = await bubble.action();

      // The bubble should catch the error and return it gracefully
      expect(result.data.success).toBe(false); // API call failed
      expect(result.data.error).toBeTruthy();
      // Should contain GitHub API error (401 or Bad credentials)
      expect(
        result.data.error.includes('401') ||
          result.data.error.toLowerCase().includes('bad credentials')
      ).toBe(true);
    });

    it('should handle non-existent repository gracefully', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (non-existent repo) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_repository',
        owner: 'thisdoesnotexist123456789',
        repo: 'alsodoesnotexist123456789',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true); // Outer success (bubble executed)
      expect(result.data.success).toBe(false); // Inner success (API failed)
      expect(result.data.error).toBeTruthy();
      expect(result.data.error).toContain('404');
    });

    it('should handle non-existent file gracefully', async () => {
      const token = getGithubToken();
      if (!token) {
        console.log(
          '⚠️  Skipping GitHub integration test (non-existent file) - no GITHUB_TOKEN'
        );
        return;
      }

      const bubble = new GithubBubble({
        operation: 'get_file',
        owner: 'octocat',
        repo: 'Hello-World',
        path: 'this-file-does-not-exist.txt',
        credentials: { [CredentialType.GITHUB_TOKEN]: token },
      });

      const result = await bubble.action();

      expect(result.success).toBe(true); // Outer success (bubble executed)
      expect(result.data.success).toBe(false); // Inner success (API failed)
      expect(result.data.error).toBeTruthy();
      expect(result.data.error).toContain('404');
    });
  });
});
