/**
 * Integration tests for CompanyEnrichmentTool
 * Tests against real Crustdata API
 *
 * Prerequisites:
 * - CRUSTDATA_API_KEY environment variable must be set
 */

import { CrustdataBubble } from '../service-bubble/crustdata/index.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { compareMultipleWithSchema } from '../../utils/schema-comparison.js';

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
      const validationResult = compareMultipleWithSchema(
        CrustdataBubble.resultSchema,
        result.data.results!
      );
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
      const validationResult = compareMultipleWithSchema(
        CrustdataBubble.resultSchema,
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
      console.log(JSON.stringify(result, null, 2));
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

      // Use schema validation util to check matching schema
      const validationResult = compareMultipleWithSchema(
        CrustdataBubble.resultSchema,
        [result.data]
      );
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
  });
});
