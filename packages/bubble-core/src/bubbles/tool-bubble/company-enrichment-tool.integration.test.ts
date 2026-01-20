/**
 * Integration tests for CompanyEnrichmentTool and PeopleSearchTool
 * Tests against real Crustdata API
 *
 * Prerequisites:
 * - CRUSTDATA_API_KEY environment variable must be set
 */

import {
  CrustdataBubble,
  IdentifyResultItemSchema,
  PersonDBProfileSchema,
} from '../service-bubble/crustdata/index.js';
import { PeopleSearchTool } from './people-search-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import {
  compareMultipleWithSchema,
  extractUnionVariant,
} from '../../utils/schema-comparison.js';

// Skip tests if API key is not available
const CRUSTDATA_API_KEY = process.env.CRUSTDATA_API_KEY;
const describeIfApiKey = CRUSTDATA_API_KEY ? describe : describe.skip;

describeIfApiKey('CompanyEnrichmentTool Integration Tests', () => {
  const credentials = {
    [CredentialType.CRUSTDATA_API_KEY]: CRUSTDATA_API_KEY!,
  };

  describe('CrustdataBubble (Service Layer)', () => {
    it('should identify a company by domain', async () => {
      const bubble = new CrustdataBubble({
        operation: 'identify',
        query_company_website: 'stripe.com',
        count: 1,
        credentials,
      });

      const result = await bubble.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.results).toBeDefined();
      expect(result.data.results!.length).toBeGreaterThan(0);

      const company = result.data.results![0];
      expect(company.company_id).toBeDefined();
      expect(company.company_name).toBeTruthy();

      // Use schema validation util to check matching schema
      // Extract the 'identify' variant from the discriminated union
      // Then get the results field schema, or use IdentifyResultItemSchema directly
      const identifyDataSchema = extractUnionVariant(
        CrustdataBubble.resultSchema,
        'identify'
      );
      expect(identifyDataSchema).toBeDefined();
      const validationResult = compareMultipleWithSchema(identifyDataSchema!, [
        result.data,
      ]);
      console.log(validationResult.summary);
      expect(validationResult.itemCount).toBe(1);
      expect(validationResult.status).toBe('PASS');
    }, 30000);

    it('should identify a company by name', async () => {
      const bubble = new CrustdataBubble({
        operation: 'identify',
        query_company_name: 'Anthropic',
        count: 1,
        credentials,
      });

      const result = await bubble.action();

      console.log(result.data);
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.results).toBeDefined();
      expect(result.data.results!.length).toBeGreaterThan(0);

      // Use schema validation util to check matching schema
      // Extract the 'identify' variant from the discriminated union
      // Then get the results field schema, or use IdentifyResultItemSchema directly
      const validationResult = compareMultipleWithSchema(
        IdentifyResultItemSchema,
        result.data.results!
      );
      console.log(validationResult.summary);
      expect(validationResult.itemCount).toBe(1);
      expect(validationResult.status).toBe('PASS');
    }, 30000);

    it('should enrich a company by domain', async () => {
      const bubble = new CrustdataBubble({
        operation: 'enrich',
        company_domain: 'stripe.com',
        fields: 'decision_makers,cxos,founders.profiles',
        credentials,
      });

      const result = await bubble.action();
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);

      // Should have some contacts
      const hasCxos = result.data.cxos && result.data.cxos.length > 0;
      const hasDecisionMakers =
        result.data.decision_makers && result.data.decision_makers.length > 0;
      const hasFounders =
        result.data.founders?.profiles &&
        result.data.founders.profiles.length > 0;
      expect(hasCxos || hasDecisionMakers || hasFounders).toBe(true);
      // Extract the 'enrich' variant from the discriminated union
      const enrichDataSchema = extractUnionVariant(
        CrustdataBubble.resultSchema,
        'enrich'
      );
      expect(enrichDataSchema).toBeDefined();

      const validationResult = compareMultipleWithSchema(enrichDataSchema!, [
        result.data,
      ]);
      console.log(validationResult.summary);
      expect(validationResult.itemCount).toBe(1);
      expect(validationResult.status).toBe('PASS');
    }, 60000);

    it('should handle invalid company gracefully', async () => {
      const bubble = new CrustdataBubble({
        operation: 'identify',
        query_company_name: 'thiscompanydefinitelydoesnotexist123456789',
        count: 1,
        credentials,
      });

      const result = await bubble.action();

      // Should return success with empty results, not fail
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.results?.length ?? 0).toBe(0);
    }, 30000);

    describe('PersonDB In-Database Search Operation', () => {
      it('should search for people by company name filter', async () => {
        const bubble = new CrustdataBubble({
          operation: 'person_search_db',
          filters: {
            column: 'current_employers.name',
            type: '(.)',
            value: 'Google',
          },
          limit: 2,
          credentials,
        });

        const result = await bubble.action();

        console.log(JSON.stringify(result, null, 2));
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);

        // Type assertion for person_search_db result
        const data = result.data as {
          operation: 'person_search_db';
          success: boolean;
          profiles?: Array<Record<string, unknown>>;
          total_count?: number;
          next_cursor?: string;
          error: string;
        };

        expect(data.profiles).toBeDefined();
        expect(data.profiles!.length).toBeGreaterThan(0);
        expect(data.total_count).toBeGreaterThan(0);

        // Validate the profiles schema
        const validationResult = compareMultipleWithSchema(
          PersonDBProfileSchema,
          data.profiles!
        );
        console.log(validationResult.summary);
        expect(validationResult.status).toBe('PASS');
      }, 60000);

      it('should search for people by job title filter', async () => {
        const bubble = new CrustdataBubble({
          operation: 'person_search_db',
          filters: {
            column: 'current_employers.title',
            type: '(.)',
            value: 'CEO',
          },
          limit: 5,
          credentials,
        });

        const result = await bubble.action();

        console.log(JSON.stringify(result, null, 2));
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);

        const data = result.data as {
          operation: 'person_search_db';
          success: boolean;
          profiles?: Array<Record<string, unknown>>;
          total_count?: number;
          error: string;
        };

        expect(data.profiles).toBeDefined();
        expect(data.profiles!.length).toBeGreaterThan(0);
      }, 60000);

      it('should search with combined filters using AND', async () => {
        const bubble = new CrustdataBubble({
          operation: 'person_search_db',
          filters: {
            op: 'and',
            conditions: [
              {
                column: 'current_employers.name',
                type: '(.)',
                value: 'Microsoft',
              },
              {
                column: 'current_employers.title',
                type: '(.)',
                value: 'Engineer',
              },
            ],
          },
          limit: 5,
          credentials,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);

        const data = result.data as {
          operation: 'person_search_db';
          success: boolean;
          profiles?: Array<Record<string, unknown>>;
          total_count?: number;
          error: string;
        };

        expect(data.profiles).toBeDefined();
      }, 60000);

      it('should validate person_search_db result schema', async () => {
        const bubble = new CrustdataBubble({
          operation: 'person_search_db',
          filters: {
            column: 'current_employers.name',
            type: '(.)',
            value: 'Stripe',
          },
          limit: 3,
          credentials,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);

        // Extract the 'person_search_db' variant from the discriminated union
        const personSearchDBSchema = extractUnionVariant(
          CrustdataBubble.resultSchema,
          'person_search_db'
        );
        expect(personSearchDBSchema).toBeDefined();

        const validationResult = compareMultipleWithSchema(
          personSearchDBSchema!,
          [result.data]
        );
        console.log(validationResult.summary);
        expect(validationResult.itemCount).toBe(1);
        expect(validationResult.status).toBe('PASS');
      }, 60000);

      it('should search with seniority level filter', async () => {
        const bubble = new CrustdataBubble({
          operation: 'person_search_db',
          filters: {
            op: 'and',
            conditions: [
              {
                column: 'current_employers.name',
                type: '(.)',
                value: 'Anthropic',
              },
              {
                column: 'current_employers.seniority_level',
                type: 'in',
                value: ['CXO', 'Vice President', 'Director'],
              },
            ],
          },
          limit: 10,
          credentials,
        });

        const result = await bubble.action();

        console.log(JSON.stringify(result, null, 2));
        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);
      }, 60000);
    });
  });

  describe('PeopleSearchTool (Tool Layer)', () => {
    it('should search for people by company name', async () => {
      const tool = new PeopleSearchTool({
        companyName: 'Stripe',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.people.length).toBeGreaterThan(0);
      expect(result.data.totalCount).toBeGreaterThan(0);

      // Verify people have expected fields
      const person = result.data.people[0];
      expect(person.name).toBeDefined();
    }, 60000);

    it('should search for people by job title', async () => {
      const tool = new PeopleSearchTool({
        jobTitle: 'Software Engineer',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.people.length).toBeGreaterThan(0);
    }, 60000);

    it('should search for people by company and title', async () => {
      const tool = new PeopleSearchTool({
        companyName: 'Google',
        jobTitle: 'Engineer',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
    }, 60000);

    it('should filter by seniority levels', async () => {
      const tool = new PeopleSearchTool({
        companyName: 'Anthropic',
        seniorityLevels: ['CXO', 'Vice President', 'Director'],
        limit: 10,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.people.length).toBeGreaterThan(0);

      // All returned people should have a seniority level
      for (const person of result.data.people) {
        expect(person.seniorityLevel).toBeDefined();
      }
    }, 60000);

    it('should return error when no search criteria provided', async () => {
      const tool = new PeopleSearchTool({
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true); // Tool execution succeeded
      expect(result.data.success).toBe(false); // But search failed due to validation
      expect(result.data.error).toContain('At least one search criteria');
    }, 30000);
    it('should search by location', async () => {
      const tool = new PeopleSearchTool({
        location: 'San Francisco Bay Area',
        jobTitle: 'Engineer',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
    }, 60000);

    it('should search by skills', async () => {
      const tool = new PeopleSearchTool({
        skills: ['Python', 'Machine Learning'],
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
    }, 60000);

    it('should filter by minimum years of experience', async () => {
      const tool = new PeopleSearchTool({
        companyName: 'Meta',
        minYearsExperience: 10,
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);

      // All returned people should have >= 10 years of experience
      for (const person of result.data.people) {
        if (person.yearsOfExperience !== null) {
          expect(person.yearsOfExperience).toBeGreaterThanOrEqual(10);
        }
      }
    }, 60000);

    it('should search by geo radius (75 miles)', async () => {
      const tool = new PeopleSearchTool({
        locationRadius: {
          location: 'San Francisco',
          radiusMiles: 75,
        },
        jobTitles: ['Hardware Engineer', 'Technical Product Manager'],
        limit: 10,
        credentials,
      });

      const result = await tool.action();

      console.log(JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.people.length).toBeGreaterThan(0);
    }, 60000);
  });
});
