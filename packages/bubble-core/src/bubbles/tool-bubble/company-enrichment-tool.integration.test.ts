/**
 * Integration tests for CompanyEnrichmentTool
 * Tests against real Crustdata API
 *
 * Prerequisites:
 * - CRUSTDATA_API_KEY environment variable must be set
 */

import { CompanyEnrichmentTool } from './company-enrichment-tool.js';
import { CrustdataBubble } from '../service-bubble/crustdata/index.js';
import { BubbleFactory } from '../../bubble-factory.js';
import { CredentialType } from '@bubblelab/shared-schemas';

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

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.results).toBeDefined();
      expect(result.data.results!.length).toBeGreaterThan(0);

      const company = result.data.results![0];
      expect(company.company_id).toBeDefined();
      expect(company.company_name).toBeTruthy();
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

      console.log(result.data);

      expect(hasCxos || hasDecisionMakers || hasFounders).toBe(true);
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
  });

  describe('CompanyEnrichmentTool (Tool Layer)', () => {
    it('should enrich company by domain', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'stripe.com',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.contacts).toBeDefined();
      expect(Array.isArray(result.data.contacts)).toBe(true);
      expect(result.data.contacts.length).toBeGreaterThan(0);
      expect(result.data.contacts.length).toBeLessThanOrEqual(5);

      // Verify contact structure
      const contact = result.data.contacts[0];
      expect(contact.role).toMatch(/cxo|decision_maker|founder/);
      expect(contact.name).toBeTruthy();

      // Verify company info
      expect(result.data.company).toBeDefined();
      if (result.data.company) {
        expect(result.data.company.name).toBeTruthy();
      }
    }, 120000);

    it('should enrich company by name', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'Anthropic',
        limit: 10,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.contacts.length).toBeGreaterThan(0);
    }, 120000);

    it('should enrich company by LinkedIn URL', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'https://www.linkedin.com/company/stripe',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data.success).toBe(true);
      expect(result.data.contacts.length).toBeGreaterThan(0);
    }, 120000);

    it('should prioritize CXOs in results', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'stripe.com',
        limit: 20,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);

      // If there are CXOs and other contacts, CXOs should come first
      const contacts = result.data.contacts;
      let lastCxoIndex = -1;
      let firstNonCxoIndex = contacts.length;

      contacts.forEach((contact, index) => {
        if (contact.role === 'cxo') {
          lastCxoIndex = index;
        } else if (firstNonCxoIndex === contacts.length) {
          firstNonCxoIndex = index;
        }
      });

      // All CXOs should come before non-CXOs
      if (lastCxoIndex >= 0 && firstNonCxoIndex < contacts.length) {
        expect(lastCxoIndex).toBeLessThan(firstNonCxoIndex);
      }
    }, 120000);

    it('should handle invalid company gracefully', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'thiscompanydefinitelydoesnotexist123456789xyz',
        limit: 5,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data.error).toBeTruthy();
      expect(result.data.contacts).toEqual([]);
    }, 30000);

    it('should handle missing credentials', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'stripe.com',
        limit: 5,
        // No credentials provided
      });

      const result = await tool.action();

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('CRUSTDATA_API_KEY');
    });
  });

  describe('Contact Profile Completeness', () => {
    it('should return contacts with full profile information', async () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'stripe.com',
        limit: 10,
        credentials,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);

      // Check that contacts have expected fields
      for (const contact of result.data.contacts) {
        // Required fields
        expect(contact).toHaveProperty('name');
        expect(contact).toHaveProperty('role');
        expect(contact).toHaveProperty('linkedinUrl');

        // Optional but commonly populated fields
        expect(contact).toHaveProperty('title');
        expect(contact).toHaveProperty('headline');
        expect(contact).toHaveProperty('email');
        expect(contact).toHaveProperty('location');
        expect(contact).toHaveProperty('skills');
        expect(contact).toHaveProperty('currentEmployment');
        expect(contact).toHaveProperty('pastEmployment');
        expect(contact).toHaveProperty('education');
      }
    }, 120000);
  });

  describe('BubbleFactory Integration', () => {
    it('should be registered in BubbleFactory', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();

      const bubbleNames = factory.list();
      expect(bubbleNames).toContain('crustdata');
      expect(bubbleNames).toContain('company-enrichment-tool');

      const crustdataClass = factory.get('crustdata');
      expect(crustdataClass).toBeDefined();

      const toolClass = factory.get('company-enrichment-tool');
      expect(toolClass).toBeDefined();
    });

    it('should be creatable through BubbleFactory', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();

      const bubble = factory.createBubble('company-enrichment-tool', {
        companyIdentifier: 'stripe.com',
        limit: 3,
        credentials,
      });

      expect(bubble).toBeInstanceOf(CompanyEnrichmentTool);

      const result = await bubble.action();
      expect(result.success).toBe(true);
    }, 120000);

    it('should have correct static metadata', () => {
      expect(CompanyEnrichmentTool.bubbleName).toBe('company-enrichment-tool');
      expect(CompanyEnrichmentTool.type).toBe('tool');
      expect(CompanyEnrichmentTool.alias).toBe('enrich');
      expect(CompanyEnrichmentTool.shortDescription).toBeTruthy();
      expect(CompanyEnrichmentTool.longDescription).toBeTruthy();
    });
  });

  describe('Schema Validation', () => {
    it('should have valid Zod schemas', () => {
      expect(CompanyEnrichmentTool.schema).toBeDefined();
      expect(CompanyEnrichmentTool.resultSchema).toBeDefined();

      // Validate default parameters
      const defaultParams = {
        companyIdentifier: 'stripe.com',
        limit: 10,
      };

      const parsed = CompanyEnrichmentTool.schema.safeParse(defaultParams);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid parameters', () => {
      // Empty company identifier
      const emptyResult = CompanyEnrichmentTool.schema.safeParse({
        companyIdentifier: '',
        limit: 10,
      });
      expect(emptyResult.success).toBe(false);

      // Limit too high
      const highLimitResult = CompanyEnrichmentTool.schema.safeParse({
        companyIdentifier: 'stripe.com',
        limit: 100,
      });
      expect(highLimitResult.success).toBe(false);
    });

    it('should apply default limit when not provided', () => {
      const tool = new CompanyEnrichmentTool({
        companyIdentifier: 'stripe.com',
        credentials,
      });

      // @ts-expect-error - accessing private params for testing
      expect(tool.params.limit).toBe(10);
    });
  });

  describe('AI Agent Tool Integration', () => {
    it('should provide toolAgent method for AI agents', async () => {
      expect(typeof CompanyEnrichmentTool.toolAgent).toBe('function');

      const tool = CompanyEnrichmentTool.toolAgent(credentials, {
        companyIdentifier: 'anthropic.com',
        limit: 3,
      });

      expect(tool).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.schema).toBeDefined();
      expect(typeof tool.func).toBe('function');

      // Test the tool function
      const result = await tool.func({
        companyIdentifier: 'stripe.com',
        limit: 3,
      });

      expect(result).toBeDefined();
      if (
        typeof result === 'object' &&
        result !== null &&
        'contacts' in result
      ) {
        expect(Array.isArray(result.contacts)).toBe(true);
      }
    }, 120000);
  });
});
