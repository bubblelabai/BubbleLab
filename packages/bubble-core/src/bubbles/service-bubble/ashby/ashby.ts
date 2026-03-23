import { CredentialType } from '@bubblelab/shared-schemas';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import {
  AshbyParamsSchema,
  AshbyResultSchema,
  type AshbyParams,
  type AshbyParamsInput,
  type AshbyResult,
  type AshbyListCandidatesParams,
  type AshbyGetCandidateParams,
  type AshbyCreateCandidateParams,
  type AshbySearchCandidatesParams,
  type AshbyAddTagParams,
  type AshbyListTagsParams,
  type AshbyCreateTagParams,
  type AshbyListCustomFieldsParams,
  type AshbyListJobsParams,
  type AshbyGetJobParams,
  type AshbyListApplicationsParams,
  type AshbyGetApplicationParams,
  type AshbyCreateApplicationParams,
  type AshbyChangeApplicationStageParams,
  type AshbyUpdateCandidateParams,
  type AshbyCreateNoteParams,
  type AshbyListNotesParams,
  type AshbyListSourcesParams,
  type AshbyListInterviewStagesParams,
  type AshbyGetFileUrlParams,
  type AshbyListProjectsParams,
  type AshbyGetProjectParams,
  type AshbyListCandidateProjectsParams,
  type AshbyAddCandidateToProjectParams,
  type AshbyRemoveCandidateFromProjectParams,
} from './ashby.schema.js';

// Ashby API base URL
const ASHBY_API_BASE = 'https://api.ashbyhq.com';

/**
 * AshbyBubble - Integration with Ashby ATS (Applicant Tracking System)
 *
 * Provides operations for managing candidates in Ashby:
 * - List candidates with filtering
 * - Get candidate details
 * - Create new candidates
 * - Search candidates by email or name
 * - Add tags to candidates
 *
 * @example
 * ```typescript
 * // List all active candidates
 * const result = await new AshbyBubble({
 *   operation: 'list_candidates',
 *   status: 'Active',
 *   limit: 50,
 * }).action();
 *
 * // Get a specific candidate
 * const candidate = await new AshbyBubble({
 *   operation: 'get_candidate',
 *   candidate_id: 'abc123-uuid',
 * }).action();
 *
 * // Create a new candidate (Personal email becomes primary)
 * const newCandidate = await new AshbyBubble({
 *   operation: 'create_candidate',
 *   name: 'John Doe',
 *   emails: [
 *     { email: 'john.work@company.com', type: 'Work' },
 *     { email: 'john.doe@example.com', type: 'Personal' }, // This becomes primary
 *   ],
 * }).action();
 * ```
 */
export class AshbyBubble<
  T extends AshbyParamsInput = AshbyParamsInput,
> extends ServiceBubble<
  T,
  Extract<AshbyResult, { operation: T['operation'] }>
> {
  // REQUIRED: Static metadata for BubbleFactory
  static readonly service = 'ashby';
  static readonly authType = 'basic' as const;
  static readonly bubbleName = 'ashby' as const;
  static readonly type = 'service' as const;
  static readonly schema = AshbyParamsSchema;
  static readonly resultSchema = AshbyResultSchema;
  static readonly shortDescription =
    'Ashby ATS integration for candidate management';
  static readonly longDescription = `
    Ashby is an applicant tracking system (ATS) for modern recruiting teams.
    This bubble provides operations for:
    - Listing and filtering candidates, jobs, applications, and sources
    - Retrieving candidate, job, and application details
    - Creating and updating candidates
    - Searching candidates by email or name
    - Managing candidate tags (list, create, add to candidates)
    - Managing applications (create, change stage)
    - Adding and listing notes on candidates
    - Listing interview stages for jobs
    - Getting resume download URLs
    - Listing custom field definitions

    Security Features:
    - Uses HTTP Basic Authentication with API key
    - API key is stored encrypted and never exposed in logs

    Use Cases:
    - Sync candidates from external sources
    - Automate candidate tagging workflows
    - Build custom recruiting dashboards
    - Integrate recruiting data with other systems
    - Track application pipeline stages
    - Download candidate resumes
  `;
  static readonly alias = 'ashby-ats';

  constructor(
    params: T = {
      operation: 'list_candidates',
      limit: 100,
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Choose the appropriate credential for Ashby API
   */
  protected chooseCredential(): string | undefined {
    const params = this.params as AshbyParams;
    const credentials = params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.ASHBY_CRED];
  }

  /**
   * Test if the credential is valid by making a simple API call
   */
  async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      return false;
    }

    // Use API key info endpoint to validate credential
    const response = await this.makeAshbyRequest('apiKey.info', {});
    if (response.success !== true) {
      throw new Error('Ashby API key validation failed');
    }
    return true;
  }

  /**
   * Perform the Ashby operation
   */
  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<AshbyResult, { operation: T['operation'] }>> {
    void context; // Mark as intentionally unused

    // Cast to OUTPUT type - base class already validated and applied defaults
    const params = this.params as AshbyParams;
    const { operation } = params;

    try {
      switch (operation) {
        case 'list_candidates':
          return (await this.listCandidates(
            params as AshbyListCandidatesParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'get_candidate':
          return (await this.getCandidate(
            params as AshbyGetCandidateParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'create_candidate':
          return (await this.createCandidate(
            params as AshbyCreateCandidateParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'search_candidates':
          return (await this.searchCandidates(
            params as AshbySearchCandidatesParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'add_tag':
          return (await this.addTag(params as AshbyAddTagParams)) as Extract<
            AshbyResult,
            { operation: T['operation'] }
          >;

        case 'list_tags':
          return (await this.listTags(
            params as AshbyListTagsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'create_tag':
          return (await this.createTag(
            params as AshbyCreateTagParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_custom_fields':
          return (await this.listCustomFields(
            params as AshbyListCustomFieldsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_jobs':
          return (await this.listJobs(
            params as AshbyListJobsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'get_job':
          return (await this.getJob(params as AshbyGetJobParams)) as Extract<
            AshbyResult,
            { operation: T['operation'] }
          >;

        case 'list_applications':
          return (await this.listApplications(
            params as AshbyListApplicationsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'get_application':
          return (await this.getApplication(
            params as AshbyGetApplicationParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'create_application':
          return (await this.createApplication(
            params as AshbyCreateApplicationParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'change_application_stage':
          return (await this.changeApplicationStage(
            params as AshbyChangeApplicationStageParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'update_candidate':
          return (await this.updateCandidate(
            params as AshbyUpdateCandidateParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'create_note':
          return (await this.createNote(
            params as AshbyCreateNoteParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_notes':
          return (await this.listNotes(
            params as AshbyListNotesParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_sources':
          return (await this.listSources(
            params as AshbyListSourcesParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_interview_stages':
          return (await this.listInterviewStages(
            params as AshbyListInterviewStagesParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'get_file_url':
          return (await this.getFileUrl(
            params as AshbyGetFileUrlParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_projects':
          return (await this.listProjects(
            params as AshbyListProjectsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'get_project':
          return (await this.getProject(
            params as AshbyGetProjectParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'list_candidate_projects':
          return (await this.listCandidateProjects(
            params as AshbyListCandidateProjectsParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'add_candidate_to_project':
          return (await this.addCandidateToProject(
            params as AshbyAddCandidateToProjectParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        case 'remove_candidate_from_project':
          return (await this.removeCandidateFromProject(
            params as AshbyRemoveCandidateFromProjectParams
          )) as Extract<AshbyResult, { operation: T['operation'] }>;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        operation,
        success: false,
        error: errorMessage,
      } as Extract<AshbyResult, { operation: T['operation'] }>;
    }
  }

  /**
   * Extract error message from Ashby API error response
   */
  private extractErrorMessage(data: Record<string, unknown>): string {
    // Try multiple possible error locations in Ashby API responses
    // 1. Check errors array (most detailed)
    const errors = data.errors as Array<{ message?: string }> | undefined;
    if (errors && errors.length > 0 && errors[0]?.message) {
      return errors[0].message;
    }

    // 2. Check errorInfo object
    const errorInfo = data.errorInfo as Record<string, unknown> | undefined;
    if (errorInfo?.message) {
      return String(errorInfo.message);
    }

    // 3. Check top-level message
    if (data.message) {
      return String(data.message);
    }

    // 4. Check error field
    if (data.error) {
      return String(data.error);
    }

    // 5. Fallback: stringify the entire response for debugging
    return `Ashby API error: ${JSON.stringify(data)}`;
  }

  /**
   * Make an authenticated request to the Ashby API
   */
  private async makeAshbyRequest(
    endpoint: string,
    body: Record<string, unknown>,
    retries = 3
  ): Promise<Record<string, unknown>> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      throw new Error('Ashby API key is required');
    }

    // Ashby uses HTTP Basic Auth with API key as username, empty password
    const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const response = await fetch(`${ASHBY_API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Handle rate limiting with retry
      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : 1000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      let data: Record<string, unknown>;
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        // Non-JSON response — retry if attempts remain
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
          continue;
        }
        const text = await response.text().catch(() => '(unreadable)');
        throw new Error(
          `Failed to parse JSON from Ashby API (${endpoint}, HTTP ${response.status}): ${text.slice(0, 200)}`
        );
      }

      // Ashby returns success: false in the body for errors
      if (data.success === false) {
        const errorMessage = this.extractErrorMessage(data);
        throw new Error(errorMessage);
      }

      // Also check HTTP status code
      if (!response.ok) {
        const errorMessage = this.extractErrorMessage(data);
        throw new Error(`HTTP ${response.status}: ${errorMessage}`);
      }

      return data;
    }

    throw new Error(
      `Ashby API request failed after ${retries + 1} attempts (${endpoint})`
    );
  }

  /**
   * List candidates with optional filtering
   */
  private async listCandidates(
    params: AshbyListCandidatesParams
  ): Promise<Extract<AshbyResult, { operation: 'list_candidates' }>> {
    const body: Record<string, unknown> = {};

    if (params.limit !== undefined) {
      body.limit = params.limit;
    }
    if (params.cursor) {
      body.cursor = params.cursor;
    }
    if (params.status) {
      body.status = params.status;
    }
    if (params.job_id) {
      body.jobId = params.job_id;
    }
    if (params.created_after !== undefined) {
      body.createdAfter = params.created_after;
    }

    const response = await this.makeAshbyRequest('candidate.list', body);

    return {
      operation: 'list_candidates',
      success: true,
      candidates: response.results as Extract<
        AshbyResult,
        { operation: 'list_candidates' }
      >['candidates'],
      next_cursor: response.nextCursor as string | undefined,
      more_data_available: response.moreDataAvailable as boolean | undefined,
      sync_token: response.syncToken as string | undefined,
      error: '',
    };
  }

  /**
   * Get detailed information about a specific candidate
   */
  private async getCandidate(
    params: AshbyGetCandidateParams
  ): Promise<Extract<AshbyResult, { operation: 'get_candidate' }>> {
    const response = await this.makeAshbyRequest('candidate.info', {
      id: params.candidate_id,
    });

    return {
      operation: 'get_candidate',
      success: true,
      candidate: response.results as Extract<
        AshbyResult,
        { operation: 'get_candidate' }
      >['candidate'],
      error: '',
    };
  }

  /**
   * Normalize LinkedIn URL for comparison
   * Removes protocol, www, trailing slashes, and query params
   */
  private normalizeLinkedInUrl(url: string): string {
    try {
      // Parse URL to extract pathname
      const parsed = new URL(url);
      // Get the pathname and remove trailing slashes
      const path = parsed.pathname.replace(/\/+$/, '');
      // Normalize the path to lowercase
      return path.toLowerCase();
    } catch {
      // If URL parsing fails, just do basic normalization
      return url
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '')
        .split('?')[0];
    }
  }

  /**
   * Extract a searchable name from LinkedIn URL
   * e.g., "https://linkedin.com/in/john-doe" -> "john doe"
   */
  private extractNameFromLinkedInUrl(linkedinUrl: string): string | null {
    try {
      const parsed = new URL(linkedinUrl);
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      // LinkedIn URLs are typically /in/username or /pub/name/...
      if (pathParts.length >= 2 && pathParts[0] === 'in') {
        // Convert slug to name: "john-doe-123abc" -> "john doe"
        return pathParts[1]
          .replace(/-[a-f0-9]{6,}$/i, '') // Remove trailing ID hash
          .replace(/-/g, ' ')
          .trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find existing candidates with the same LinkedIn URL
   * Uses search by name extracted from LinkedIn URL for faster lookup
   */
  private async findCandidateByLinkedIn(
    linkedinUrl: string
  ): Promise<{ id: string; name: string; linkedinUrl: string } | null> {
    const normalizedInput = this.normalizeLinkedInUrl(linkedinUrl);

    // Extract name from LinkedIn URL for search
    const searchName = this.extractNameFromLinkedInUrl(linkedinUrl);
    if (!searchName) {
      return null;
    }

    // Search for candidates by name
    const response = await this.makeAshbyRequest('candidate.search', {
      name: searchName,
    });

    const candidates = response.results as Array<{
      id: string;
      name: string;
      socialLinks?: Array<{ url: string; type: string }>;
    }>;

    // Check each candidate for matching LinkedIn URL
    for (const candidate of candidates) {
      if (candidate.socialLinks) {
        for (const link of candidate.socialLinks) {
          if (
            link.type === 'LinkedIn' &&
            this.normalizeLinkedInUrl(link.url) === normalizedInput
          ) {
            return {
              id: candidate.id,
              name: candidate.name,
              linkedinUrl: link.url,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Create a new candidate
   */
  private async createCandidate(
    params: AshbyCreateCandidateParams
  ): Promise<Extract<AshbyResult, { operation: 'create_candidate' }>> {
    // Check for duplicate LinkedIn profile if not allowed
    if (params.linkedin_url && !params.allow_duplicate_linkedin) {
      const existingCandidate = await this.findCandidateByLinkedIn(
        params.linkedin_url
      );
      if (existingCandidate) {
        // Return existing candidate info - not creating a new one
        const duplicateCandidate = {
          id: existingCandidate.id,
          name: existingCandidate.name,
        };
        return {
          operation: 'create_candidate',
          success: true,
          candidate: duplicateCandidate,
          duplicate: true,
          error: '',
        };
      }
    }

    const body: Record<string, unknown> = {
      name: params.name,
    };

    if (params.emails && params.emails.length > 0) {
      // Find the personal email to use as primary
      const personalEmail = params.emails.find((e) => e.type === 'Personal');
      const otherEmails = params.emails.filter((e) => e !== personalEmail);

      if (personalEmail) {
        body.email = personalEmail.email;
        if (otherEmails.length > 0) {
          body.alternateEmailAddresses = otherEmails.map((e) => e.email);
        }
      } else {
        // No personal email found, use first as primary
        body.email = params.emails[0].email;
        if (params.emails.length > 1) {
          body.alternateEmailAddresses = params.emails
            .slice(1)
            .map((e) => e.email);
        }
      }
    }
    if (params.phone_number) {
      body.phoneNumber = params.phone_number;
    }
    if (params.linkedin_url) {
      body.linkedInUrl = params.linkedin_url;
    }
    if (params.github_url) {
      body.githubUrl = params.github_url;
    }
    if (params.website) {
      body.website = params.website;
    }
    if (params.source_id) {
      body.sourceId = params.source_id;
    }
    if (params.credited_to_user_id) {
      body.creditedToUserId = params.credited_to_user_id;
    }

    const response = await this.makeAshbyRequest('candidate.create', body);

    const candidate = response.results as Extract<
      AshbyResult,
      { operation: 'create_candidate' }
    >['candidate'];

    // If tag is provided, add it to the newly created candidate
    if (params.tag && candidate?.id) {
      let tagId = params.tag;

      // Check if it's a UUID format (tag ID) or a tag name
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(params.tag)) {
        // It's a tag name, create the tag first
        const tagResponse = await this.makeAshbyRequest('candidateTag.create', {
          title: params.tag,
        });
        const createdTag = tagResponse.results as { id: string } | undefined;
        if (createdTag?.id) {
          tagId = createdTag.id;
        }
      }

      // Add the tag to the candidate
      await this.makeAshbyRequest('candidate.addTag', {
        candidateId: candidate.id,
        tagId: tagId,
      });
    }

    return {
      operation: 'create_candidate',
      success: true,
      candidate,
      error: '',
    };
  }

  /**
   * Search for candidates by email or name
   */
  private async searchCandidates(
    params: AshbySearchCandidatesParams
  ): Promise<Extract<AshbyResult, { operation: 'search_candidates' }>> {
    const body: Record<string, unknown> = {};

    if (params.email) {
      body.email = params.email;
    }
    if (params.name) {
      body.name = params.name;
    }

    if (!params.email && !params.name) {
      throw new Error('Either email or name is required for search');
    }

    const response = await this.makeAshbyRequest('candidate.search', body);

    return {
      operation: 'search_candidates',
      success: true,
      candidates: response.results as Extract<
        AshbyResult,
        { operation: 'search_candidates' }
      >['candidates'],
      error: '',
    };
  }

  /**
   * Add a tag to a candidate
   */
  private async addTag(
    params: AshbyAddTagParams
  ): Promise<Extract<AshbyResult, { operation: 'add_tag' }>> {
    const response = await this.makeAshbyRequest('candidate.addTag', {
      candidateId: params.candidate_id,
      tagId: params.tag_id,
    });

    return {
      operation: 'add_tag',
      success: true,
      candidate: response.results as Extract<
        AshbyResult,
        { operation: 'add_tag' }
      >['candidate'],
      error: '',
    };
  }

  /**
   * List all candidate tags
   */
  private async listTags(
    params: AshbyListTagsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_tags' }>> {
    void params; // include_archived not used in current API
    const response = await this.makeAshbyRequest('candidateTag.list', {});

    const allTags = response.results as Array<{
      id: string;
      title: string;
      isArchived?: boolean;
    }>;

    // Filter out archived tags unless include_archived is true
    const tags = params.include_archived
      ? allTags
      : allTags.filter((tag) => !tag.isArchived);

    return {
      operation: 'list_tags',
      success: true,
      tags: tags as Extract<AshbyResult, { operation: 'list_tags' }>['tags'],
      error: '',
    };
  }

  /**
   * Create a new candidate tag
   */
  private async createTag(
    params: AshbyCreateTagParams
  ): Promise<Extract<AshbyResult, { operation: 'create_tag' }>> {
    const response = await this.makeAshbyRequest('candidateTag.create', {
      title: params.title,
    });

    return {
      operation: 'create_tag',
      success: true,
      tag: response.results as Extract<
        AshbyResult,
        { operation: 'create_tag' }
      >['tag'],
      error: '',
    };
  }

  /**
   * List all custom field definitions
   */
  private async listCustomFields(
    params: AshbyListCustomFieldsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_custom_fields' }>> {
    const body: Record<string, unknown> = {};

    if (params.limit !== undefined) {
      body.limit = params.limit;
    }
    if (params.cursor) {
      body.cursor = params.cursor;
    }
    if (params.sync_token) {
      body.syncToken = params.sync_token;
    }

    const response = await this.makeAshbyRequest('customField.list', body);

    return {
      operation: 'list_custom_fields',
      success: true,
      custom_fields: response.results as Extract<
        AshbyResult,
        { operation: 'list_custom_fields' }
      >['custom_fields'],
      next_cursor: response.nextCursor as string | undefined,
      more_data_available: response.moreDataAvailable as boolean | undefined,
      sync_token: response.syncToken as string | undefined,
      error: '',
    };
  }

  /**
   * List jobs with optional filtering
   */
  private async listJobs(
    params: AshbyListJobsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_jobs' }>> {
    const body: Record<string, unknown> = {};

    if (params.limit !== undefined) {
      body.limit = params.limit;
    }
    if (params.cursor) {
      body.cursor = params.cursor;
    }
    if (params.status) {
      body.status = [params.status]; // Ashby API expects status as an array
    }

    const response = await this.makeAshbyRequest('job.list', body);

    return {
      operation: 'list_jobs',
      success: true,
      jobs: response.results as Extract<
        AshbyResult,
        { operation: 'list_jobs' }
      >['jobs'],
      next_cursor: response.nextCursor as string | undefined,
      more_data_available: response.moreDataAvailable as boolean | undefined,
      error: '',
    };
  }

  /**
   * Get detailed information about a specific job
   */
  private async getJob(
    params: AshbyGetJobParams
  ): Promise<Extract<AshbyResult, { operation: 'get_job' }>> {
    const response = await this.makeAshbyRequest('job.info', {
      id: params.job_id,
    });

    // Also fetch interview stages using the job's default interview plan
    let interviewStages: Extract<
      AshbyResult,
      { operation: 'get_job' }
    >['interview_stages'];
    try {
      const jobData = response.results as Record<string, unknown>;
      const planId = jobData?.defaultInterviewPlanId as string | undefined;
      if (planId) {
        const stagesResponse = await this.makeAshbyRequest(
          'interviewStage.list',
          { interviewPlanId: planId }
        );
        interviewStages = stagesResponse.results as typeof interviewStages;
      }
    } catch {
      // Interview stages fetch is optional — don't fail the whole request
      interviewStages = undefined;
    }

    return {
      operation: 'get_job',
      success: true,
      job: response.results as Extract<
        AshbyResult,
        { operation: 'get_job' }
      >['job'],
      interview_stages: interviewStages,
      error: '',
    };
  }

  /**
   * List applications with optional filtering
   */
  private async listApplications(
    params: AshbyListApplicationsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_applications' }>> {
    const body: Record<string, unknown> = {};

    if (params.limit !== undefined) {
      body.limit = params.limit;
    }
    if (params.cursor) {
      body.cursor = params.cursor;
    }
    if (params.candidate_id) {
      body.candidateId = params.candidate_id;
    }
    if (params.job_id) {
      body.jobId = params.job_id;
    }
    if (params.status) {
      body.status = params.status;
    }
    if (params.created_after !== undefined) {
      body.createdAfter = params.created_after;
    }

    const response = await this.makeAshbyRequest('application.list', body);

    return {
      operation: 'list_applications',
      success: true,
      applications: response.results as Extract<
        AshbyResult,
        { operation: 'list_applications' }
      >['applications'],
      next_cursor: response.nextCursor as string | undefined,
      more_data_available: response.moreDataAvailable as boolean | undefined,
      error: '',
    };
  }

  /**
   * Get detailed information about a specific application
   */
  private async getApplication(
    params: AshbyGetApplicationParams
  ): Promise<Extract<AshbyResult, { operation: 'get_application' }>> {
    const response = await this.makeAshbyRequest('application.info', {
      applicationId: params.application_id,
    });

    const appResult = response.results as Record<string, unknown>;

    return {
      operation: 'get_application',
      success: true,
      application: appResult as Extract<
        AshbyResult,
        { operation: 'get_application' }
      >['application'],
      candidate: appResult?.candidate as Extract<
        AshbyResult,
        { operation: 'get_application' }
      >['candidate'],
      job: appResult?.job as Extract<
        AshbyResult,
        { operation: 'get_application' }
      >['job'],
      error: '',
    };
  }

  /**
   * Create an application (submit candidate to a job)
   */
  private async createApplication(
    params: AshbyCreateApplicationParams
  ): Promise<Extract<AshbyResult, { operation: 'create_application' }>> {
    const body: Record<string, unknown> = {
      candidateId: params.candidate_id,
      jobId: params.job_id,
    };

    if (params.interview_stage_id) {
      body.interviewStageId = params.interview_stage_id;
    }
    if (params.source_id) {
      body.sourceId = params.source_id;
    }

    const response = await this.makeAshbyRequest('application.create', body);

    return {
      operation: 'create_application',
      success: true,
      application: response.results as Extract<
        AshbyResult,
        { operation: 'create_application' }
      >['application'],
      error: '',
    };
  }

  /**
   * Change the interview stage of an application
   */
  private async changeApplicationStage(
    params: AshbyChangeApplicationStageParams
  ): Promise<Extract<AshbyResult, { operation: 'change_application_stage' }>> {
    const response = await this.makeAshbyRequest('application.changeStage', {
      applicationId: params.application_id,
      interviewStageId: params.interview_stage_id,
    });

    return {
      operation: 'change_application_stage',
      success: true,
      application: response.results as Extract<
        AshbyResult,
        { operation: 'change_application_stage' }
      >['application'],
      error: '',
    };
  }

  /**
   * Update an existing candidate
   */
  private async updateCandidate(
    params: AshbyUpdateCandidateParams
  ): Promise<Extract<AshbyResult, { operation: 'update_candidate' }>> {
    const body: Record<string, unknown> = {
      id: params.candidate_id,
    };

    if (params.name !== undefined) {
      body.name = params.name;
    }
    if (params.email !== undefined) {
      body.email = params.email;
    }
    if (params.phone_number !== undefined) {
      body.phoneNumber = params.phone_number;
    }
    if (params.linkedin_url !== undefined) {
      body.linkedInUrl = params.linkedin_url;
    }
    if (params.github_url !== undefined) {
      body.githubUrl = params.github_url;
    }
    if (params.website !== undefined) {
      body.website = params.website;
    }

    const response = await this.makeAshbyRequest('candidate.update', body);

    return {
      operation: 'update_candidate',
      success: true,
      candidate: response.results as Extract<
        AshbyResult,
        { operation: 'update_candidate' }
      >['candidate'],
      error: '',
    };
  }

  /**
   * Create a note on a candidate
   */
  private async createNote(
    params: AshbyCreateNoteParams
  ): Promise<Extract<AshbyResult, { operation: 'create_note' }>> {
    const response = await this.makeAshbyRequest('candidate.createNote', {
      candidateId: params.candidate_id,
      note: params.content,
    });

    return {
      operation: 'create_note',
      success: true,
      note: response.results as Extract<
        AshbyResult,
        { operation: 'create_note' }
      >['note'],
      error: '',
    };
  }

  /**
   * List notes for a candidate
   */
  private async listNotes(
    params: AshbyListNotesParams
  ): Promise<Extract<AshbyResult, { operation: 'list_notes' }>> {
    const response = await this.makeAshbyRequest('candidate.listNotes', {
      candidateId: params.candidate_id,
    });

    return {
      operation: 'list_notes',
      success: true,
      notes: response.results as Extract<
        AshbyResult,
        { operation: 'list_notes' }
      >['notes'],
      error: '',
    };
  }

  /**
   * List all candidate sources
   */
  private async listSources(
    _params: AshbyListSourcesParams
  ): Promise<Extract<AshbyResult, { operation: 'list_sources' }>> {
    const response = await this.makeAshbyRequest('source.list', {});

    return {
      operation: 'list_sources',
      success: true,
      sources: response.results as Extract<
        AshbyResult,
        { operation: 'list_sources' }
      >['sources'],
      error: '',
    };
  }

  /**
   * List interview stages for a job (resolves the interview plan ID automatically)
   */
  private async listInterviewStages(
    params: AshbyListInterviewStagesParams
  ): Promise<Extract<AshbyResult, { operation: 'list_interview_stages' }>> {
    // First get the job to find its defaultInterviewPlanId
    const jobResponse = await this.makeAshbyRequest('job.info', {
      id: params.job_id,
    });
    const jobData = jobResponse.results as Record<string, unknown>;
    const planId = jobData?.defaultInterviewPlanId as string | undefined;
    if (!planId) {
      throw new Error('Job does not have an interview plan');
    }

    const response = await this.makeAshbyRequest('interviewStage.list', {
      interviewPlanId: planId,
    });

    return {
      operation: 'list_interview_stages',
      success: true,
      interview_stages: response.results as Extract<
        AshbyResult,
        { operation: 'list_interview_stages' }
      >['interview_stages'],
      error: '',
    };
  }

  /**
   * Get a download URL for a file (e.g., resume)
   */
  private async getFileUrl(
    params: AshbyGetFileUrlParams
  ): Promise<Extract<AshbyResult, { operation: 'get_file_url' }>> {
    const response = await this.makeAshbyRequest('file.info', {
      fileHandle: params.file_handle,
    });

    return {
      operation: 'get_file_url',
      success: true,
      file: response.results as Extract<
        AshbyResult,
        { operation: 'get_file_url' }
      >['file'],
      error: '',
    };
  }

  /**
   * List all projects
   */
  private async listProjects(
    _params: AshbyListProjectsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_projects' }>> {
    const response = await this.makeAshbyRequest('project.list', {});

    return {
      operation: 'list_projects',
      success: true,
      projects: response.results as Extract<
        AshbyResult,
        { operation: 'list_projects' }
      >['projects'],
      error: '',
    };
  }

  /**
   * Get project details by finding it in the project list.
   */
  private async getProject(
    params: AshbyGetProjectParams
  ): Promise<Extract<AshbyResult, { operation: 'get_project' }>> {
    // Use project.list and filter — project.info has unreliable parameter format
    const listResponse = await this.makeAshbyRequest('project.list', {});
    const allProjects = listResponse.results as Array<{
      id: string;
      title: string;
      isArchived?: boolean;
    }>;
    const match = allProjects?.find((p) => p.id === params.project_id);
    if (!match) {
      throw new Error(`Project not found: ${params.project_id}`);
    }
    const response = { results: match };

    return {
      operation: 'get_project',
      success: true,
      project: response.results as Extract<
        AshbyResult,
        { operation: 'get_project' }
      >['project'],
      error: '',
    };
  }

  /**
   * List projects a candidate belongs to
   */
  private async listCandidateProjects(
    params: AshbyListCandidateProjectsParams
  ): Promise<Extract<AshbyResult, { operation: 'list_candidate_projects' }>> {
    const response = await this.makeAshbyRequest('candidate.listProjects', {
      candidateId: params.candidate_id,
    });

    return {
      operation: 'list_candidate_projects',
      success: true,
      projects: response.results as Extract<
        AshbyResult,
        { operation: 'list_candidate_projects' }
      >['projects'],
      error: '',
    };
  }

  /**
   * Add a candidate to a project
   */
  private async addCandidateToProject(
    params: AshbyAddCandidateToProjectParams
  ): Promise<Extract<AshbyResult, { operation: 'add_candidate_to_project' }>> {
    await this.makeAshbyRequest('candidate.addProject', {
      candidateId: params.candidate_id,
      projectId: params.project_id,
    });

    return {
      operation: 'add_candidate_to_project',
      success: true,
      error: '',
    };
  }

  /**
   * Remove a candidate from a project
   */
  private async removeCandidateFromProject(
    params: AshbyRemoveCandidateFromProjectParams
  ): Promise<
    Extract<AshbyResult, { operation: 'remove_candidate_from_project' }>
  > {
    await this.makeAshbyRequest('candidate.removeProject', {
      candidateId: params.candidate_id,
      projectId: params.project_id,
    });

    return {
      operation: 'remove_candidate_from_project',
      success: true,
      error: '',
    };
  }
}
