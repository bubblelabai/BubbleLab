/**
 * Tests for document generation template API endpoints
 */

// @ts-expect-error bun:test
import { describe, expect, it } from 'bun:test';
import { validateBubbleFlow } from '../services/validation.js';
import { generateDocumentGenerationTemplate } from '../services/templates/document-generation-template.js';
import { TestApp } from '../test/test-app.js';
import { db } from '../db/index.js';
import { bubbleFlows } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { TEST_USER_ID } from '../test/setup.js';

describe('POST /bubbleflow-template/document-generation', () => {
  it('should generate and validate document generation template successfully', async () => {
    const templateData = {
      name: 'Expense Report Processor',
      description: 'Process receipts and invoices to extract expense data',
      outputDescription:
        'Extract expense tracking data with vendor name, date, amount, and category',
      useCase: 'document-generation' as const,
      outputFormat: 'html' as const,
    };

    // Test the template generation function directly
    const generatedCode = generateDocumentGenerationTemplate(templateData);
    expect(generatedCode).toContain('ExpenseReportProcessor');
    expect(generatedCode).toContain('BubbleFlow');
    expect(generatedCode).toContain('ParseDocumentWorkflow');
    expect(generatedCode).toContain('GenerateDocumentWorkflow');

    // Test template validation
    const validationResult = await validateBubbleFlow(generatedCode);
    if (!validationResult.valid) {
      console.error('Validation errors:', validationResult.errors);
    }
    expect(validationResult.valid).toBe(true);
    expect(validationResult.bubbleParameters).toBeDefined();

    // Test API endpoint
    const response = await TestApp.post(
      '/bubbleflow-template/document-generation',
      templateData,
      { 'X-User-ID': TEST_USER_ID }
    );

    if (response.status !== 201) {
      const errorData = (await response.json()) as any;
      console.log('Unexpected response status:', response.status);
      console.log('Response data:', errorData);
      console.log('Request body:', JSON.stringify(templateData, null, 2));
    }
    expect(response.status).toBe(201);
    const responseData = (await response.json()) as any;

    expect(responseData.id).toBeTypeOf('number');
    expect(responseData.name).toBe(templateData.name);
    expect(responseData.description).toBe(templateData.description);
    expect(responseData.eventType).toBe('webhook/http');
    expect(responseData.webhook).toBeDefined();
    expect(responseData.webhook.active).toBe(true);

    // Clean up
    await db.delete(bubbleFlows).where(eq(bubbleFlows.id, responseData.id));
  });

  it('should fail validation with missing required fields', async () => {
    const invalidData = {
      name: 'Test',
      // Missing description, outputDescription, and useCase
    };

    const response = await TestApp.post(
      '/bubbleflow-template/document-generation',
      invalidData,
      { 'X-User-ID': TEST_USER_ID }
    );

    expect(response.status).toBe(400);
    const errorData = (await response.json()) as any;
    expect(String(errorData.error)).toMatch(/validation failed/i);
  });

  it('should generate template with custom options', async () => {
    const templateData = {
      name: 'Advanced Document Processor',
      description: 'Advanced document processing with custom settings',
      outputDescription: 'Extract detailed information with metadata',
      useCase: 'document-generation' as const,
      outputFormat: 'csv' as const,
      conversionOptions: {
        preserveStructure: false,
        includeVisualDescriptions: false,
        extractNumericalData: true,
        combinePages: false,
      },
      imageOptions: {
        format: 'jpeg' as const,
        quality: 0.8,
        dpi: 150,
      },
      aiOptions: {
        model: 'google/gemini-2.5-pro',
        temperature: 0.3,
        maxTokens: 50000,
        jsonMode: true,
      },
    };

    const generatedCode = generateDocumentGenerationTemplate(templateData);
    expect(generatedCode).toContain('preserveStructure: false');
    expect(generatedCode).toContain('includeVisualDescriptions: false');
    expect(generatedCode).toContain("format: 'jpeg'");
    expect(generatedCode).toContain('quality: 0.8');
    expect(generatedCode).toContain('dpi: 150');
    expect(generatedCode).toContain('google/gemini-2.5-pro');
    expect(generatedCode).toContain('temperature: 0.3');
    expect(generatedCode).toContain('maxTokens: 50000');

    const response = await TestApp.post(
      '/bubbleflow-template/document-generation',
      templateData,
      { 'X-User-ID': TEST_USER_ID }
    );

    expect(response.status).toBe(201);
    const responseData = (await response.json()) as any;

    // Clean up
    await db.delete(bubbleFlows).where(eq(bubbleFlows.id, responseData.id));
  });
});
