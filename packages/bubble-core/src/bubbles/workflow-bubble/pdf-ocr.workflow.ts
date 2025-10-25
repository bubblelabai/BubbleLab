/**
 * PDF OCR WORKFLOW
 *
 * A comprehensive workflow that converts PDF documents to images and passes them
 * to an AI agent along with discovered form fields to parse and extract schema information.
 *
 * This workflow combines:
 * 1. PDF field discovery using pdf-lib
 * 2. PDF to images conversion using pdf-img-convert
 * 3. AI agent analysis for schema parsing and field extraction
 *
 * Returns structured JSON containing field IDs from discovery and extracted field names
 * with their values from AI analysis.
 */

import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { PDFFormOperationsWorkflow } from './pdf-form-operations.workflow.js';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';
import { AvailableModels } from '@bubblelab/shared-schemas';

/**
 * System prompts for different modes
 */
const IDENTIFY_MODE_PROMPT = `You are an expert OCR and form field extraction specialist. Analyze the provided PDF images and form field discovery data to extract structured information.

IMPORTANT: The form field IDs are numbered in natural reading order (left to right, top to bottom). Use this ordering to help identify what each field represents.

Your task:
1. Examine the PDF images to identify all visible text and form fields
2. Cross-reference with the discovered form field metadata (field IDs follow natural reading order)
3. Generate descriptive field names based on the PDF content, context, and field position
4. Return a JSON array with field information

Return format: JSON array of objects with:
- id: number (MUST use the exact ID from discovery data when available - these IDs are in natural reading order)
- fieldName: string (descriptive name based on PDF content, context, and field position)
- confidence: number (0.0-1.0, your confidence in the field identification)

Focus on generating meaningful, descriptive field names that accurately represent what each field is for based on the PDF context and natural reading order.`;

const AUTOFILL_MODE_PROMPT = `You are an expert OCR and form field extraction specialist with autofill capabilities. Analyze the provided PDF images, form field discovery data, and client information to extract and fill structured information.

IMPORTANT: The form field IDs are numbered in natural reading order (left to right, top to bottom). Use this ordering to help identify what each field represents and to match client information appropriately.


Your task:
1. Examine the PDF images to identify all visible text and form fields
2. Cross-reference with the discovered form field metadata (field IDs follow natural reading order)
3. Generate descriptive field names based on the PDF content, context, and field position
4. Use the provided client information to determine appropriate values for each field
5. Return a JSON array with ALL discovered fields (every single field ID must have an entry)

Return format: JSON array of objects with:
- id: number (MUST use the exact ID from discovery data when available - these IDs are in natural reading order)
- originalFieldName: string (MUST use the exact field name from discovery data when available, for precise field matching)
- fieldName: string (descriptive name based on PDF content, context, and natural reading order)
- value: string (appropriate value from client information, or empty string if not applicable)
- confidence: number (0.0-1.0, your confidence in the field identification and value assignment)

CRITICAL: 
- You MUST return an entry for EVERY field ID from the discovery data - no field should be omitted
- For fields that match discovered form field metadata, you MUST include the originalFieldName exactly as provided in the discovery data. This is essential for proper form filling.

Rules for value assignment:
- Use the natural reading order (field ID sequence) to understand form structure and field relationships
- Only fill values that clearly match the client information provided
- Use empty string for fields where no appropriate value can be determined from client information
- Format values appropriately for the field type (dates, numbers, etc.)
- Be conservative - if unsure, use empty string rather than guessing
- EVERY discovered field ID must appear in your response, even if the value is empty

Focus on accuracy and appropriate value mapping based on the client information context and natural field ordering.`;

/**
 * Field extraction result interface for identify mode
 */
interface IdentifyFieldResult {
  id: number;
  fieldName: string;
  confidence: number;
}

/**
 * Field extraction result interface for autofill mode
 */
interface AutofillFieldResult {
  id: number;
  originalFieldName?: string; // Original field name from discovery for matching
  fieldName: string;
  value: string;
  confidence: number;
}

/**
 * Union type for field extraction results
 */
type FieldExtractionResult = IdentifyFieldResult | AutofillFieldResult;

/**
 * Parameters schema for PDF OCR workflow using discriminated union for different modes
 */
const PDFOcrWorkflowParamsSchema = z.discriminatedUnion('mode', [
  // Identify mode - just identifies fields and generates descriptive names
  z.object({
    mode: z
      .literal('identify')
      .describe('Identify form fields and generate descriptive names'),
    pdfData: z
      .string()
      .min(1, 'PDF data is required')
      .describe('Base64 encoded PDF data'),
    discoveryOptions: z
      .object({
        targetPage: z
          .number()
          .positive()
          .optional()
          .describe(
            'Extract fields from specific page only (default: all pages)'
          ),
      })
      .default({})
      .describe('Options for PDF field discovery'),
    imageOptions: z
      .object({
        format: z
          .enum(['png', 'jpeg'])
          .default('png')
          .describe('Output image format'),
        quality: z
          .number()
          .min(0.1)
          .max(1.0)
          .default(0.8)
          .describe('JPEG quality (0.1-1.0, only for JPEG format)'),
        dpi: z
          .number()
          .min(72)
          .max(300)
          .default(150)
          .describe('Output DPI (dots per inch)'),
        pages: z
          .array(z.number().positive())
          .optional()
          .describe(
            'Specific page numbers to convert (1-indexed). If not provided, converts all pages'
          ),
      })
      .default({
        format: 'png',
        quality: 0.8,
        dpi: 150,
      })
      .describe('Options for PDF to images conversion'),
    aiOptions: z
      .object({
        model: AvailableModels.default('google/gemini-2.5-flash').describe(
          'AI model to use for field identification'
        ),
        temperature: z
          .number()
          .min(0)
          .max(2)
          .default(0.3)
          .describe('Temperature for AI responses (lower = more consistent)'),
        maxTokens: z
          .number()
          .positive()
          .default(50000)
          .describe('Maximum tokens for AI response'),
        jsonMode: z
          .boolean()
          .default(true)
          .describe('Enable JSON mode to ensure clean JSON output'),
      })
      .default({
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 50000,
        jsonMode: true,
      })
      .describe('AI agent configuration options'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Credentials for AI model access (GOOGLE_GEMINI_CRED, OPENAI_CRED, etc.)'
      ),
  }),

  // Autofill mode - identifies fields and fills them based on client information
  z.object({
    mode: z
      .literal('autofill')
      .describe('Identify form fields and autofill with client information'),
    pdfData: z
      .string()
      .min(1, 'PDF data is required')
      .describe('Base64 encoded PDF data'),
    clientInformation: z
      .string()
      .min(1, 'Client information is required for autofill mode')
      .describe(
        'Free text containing client information to use for autofilling form fields'
      ),
    discoveryOptions: z
      .object({
        targetPage: z
          .number()
          .positive()
          .optional()
          .describe(
            'Extract fields from specific page only (default: all pages)'
          ),
      })
      .default({})
      .describe('Options for PDF field discovery'),
    imageOptions: z
      .object({
        format: z
          .enum(['png', 'jpeg'])
          .default('png')
          .describe('Output image format'),
        quality: z
          .number()
          .min(0.1)
          .max(1.0)
          .default(0.8)
          .describe('JPEG quality (0.1-1.0, only for JPEG format)'),
        dpi: z
          .number()
          .min(72)
          .max(300)
          .default(150)
          .describe('Output DPI (dots per inch)'),
        pages: z
          .array(z.number().positive())
          .optional()
          .describe(
            'Specific page numbers to convert (1-indexed). If not provided, converts all pages'
          ),
      })
      .default({
        format: 'png',
        quality: 0.8,
        dpi: 150,
      })
      .describe('Options for PDF to images conversion'),
    aiOptions: z
      .object({
        model: AvailableModels.default('google/gemini-2.5-flash').describe(
          'AI model to use for field identification and autofill'
        ),
        temperature: z
          .number()
          .min(0)
          .max(2)
          .default(0.3)
          .describe('Temperature for AI responses (lower = more consistent)'),
        maxTokens: z
          .number()
          .positive()
          .default(50000)
          .describe('Maximum tokens for AI response'),
        jsonMode: z
          .boolean()
          .default(true)
          .describe('Enable JSON mode to ensure clean JSON output'),
      })
      .default({
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 50000,
        jsonMode: true,
      })
      .describe('AI agent configuration options'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe(
        'Credentials for AI model access (GOOGLE_GEMINI_CRED, OPENAI_CRED, etc.)'
      ),
  }),
]);

/**
 * Result schema for PDF OCR workflow using discriminated union for different modes
 */
const PDFOcrWorkflowResultSchema = z.discriminatedUnion('mode', [
  // Identify mode result
  z.object({
    mode: z.literal('identify').describe('Result from identify mode'),
    extractedFields: z
      .array(
        z.object({
          id: z.number().describe('Field ID from discovery or auto-generated'),
          fieldName: z
            .string()
            .describe('Descriptive name generated based on PDF content'),
          confidence: z
            .number()
            .min(0)
            .max(1)
            .describe('AI confidence in the field identification (0.0-1.0)'),
        })
      )
      .describe('Array of identified fields with descriptive names'),
    discoveryData: z
      .object({
        totalFields: z.number(),
        fieldsWithCoordinates: z.number(),
        pages: z.array(z.number()),
      })
      .describe('Summary of field discovery results'),
    imageData: z
      .object({
        totalPages: z.number(),
        convertedPages: z.number(),
        format: z.string(),
        dpi: z.number(),
      })
      .describe('Summary of image conversion results'),
    aiAnalysis: z
      .object({
        model: z.string(),
        iterations: z.number(),
        processingTime: z.number().optional(),
      })
      .describe('AI analysis metadata'),
    success: z
      .boolean()
      .describe('Whether the workflow completed successfully'),
    error: z.string().describe('Error message if workflow failed'),
  }),

  // Autofill mode result
  z.object({
    mode: z.literal('autofill').describe('Result from autofill mode'),
    extractedFields: z
      .array(
        z.object({
          id: z.number().describe('Field ID from discovery or auto-generated'),
          originalFieldName: z
            .string()
            .optional()
            .describe(
              'Original field name from discovery for precise matching'
            ),
          fieldName: z
            .string()
            .describe('Descriptive name generated based on PDF content'),
          value: z
            .string()
            .describe('Value to fill in the field based on client information'),
          confidence: z
            .number()
            .min(0)
            .max(1)
            .describe(
              'AI confidence in the field identification and value assignment (0.0-1.0)'
            ),
        })
      )
      .describe('Array of identified fields with values for autofill'),
    filledPdfData: z.string().describe('Base64 encoded filled PDF data'),
    discoveryData: z
      .object({
        totalFields: z.number(),
        fieldsWithCoordinates: z.number(),
        pages: z.array(z.number()),
      })
      .describe('Summary of field discovery results'),
    imageData: z
      .object({
        totalPages: z.number(),
        convertedPages: z.number(),
        format: z.string(),
        dpi: z.number(),
      })
      .describe('Summary of image conversion results'),
    aiAnalysis: z
      .object({
        model: z.string(),
        iterations: z.number(),
        processingTime: z.number().optional(),
      })
      .describe('AI analysis metadata'),
    fillResults: z
      .object({
        filledFields: z.number(),
        successfullyFilled: z.number(),
      })
      .describe('Summary of PDF filling results'),
    success: z
      .boolean()
      .describe('Whether the workflow completed successfully'),
    error: z.string().describe('Error message if workflow failed'),
  }),
]);

type PDFOcrWorkflowParams = z.input<typeof PDFOcrWorkflowParamsSchema>;
type PDFOcrWorkflowResult = z.output<typeof PDFOcrWorkflowResultSchema>;

// Helper type to get the result type for a specific mode (for external consumption)
export type PDFOcrModeResult<T extends PDFOcrWorkflowParams['mode']> = Extract<
  PDFOcrWorkflowResult,
  { mode: T }
>;

// Additional helper type that matches the Slack pattern for operation results
export type PDFOcrOperationResult<T extends PDFOcrWorkflowParams['mode']> =
  Extract<PDFOcrWorkflowResult, { mode: T }>;

/**
 * PDF OCR Workflow
 * Combines PDF field discovery, image conversion, and AI analysis for comprehensive form field extraction
 */
export class PDFOcrWorkflow<
  T extends PDFOcrWorkflowParams = PDFOcrWorkflowParams,
> extends WorkflowBubble<
  T,
  Extract<PDFOcrWorkflowResult, { mode: T['mode'] }>
> {
  static readonly type = 'workflow' as const;
  static readonly bubbleName: BubbleName = 'pdf-ocr-workflow';
  static readonly schema = PDFOcrWorkflowParamsSchema;
  static readonly resultSchema = PDFOcrWorkflowResultSchema;
  static readonly shortDescription =
    'PDF OCR workflow: identify fields or autofill forms using AI analysis';
  static readonly longDescription = `
    Comprehensive PDF OCR workflow with two modes for form field processing:
    
    **Identify Mode:**
    - Discovers and names form fields from PDF documents
    - Returns field IDs, descriptive names, and confidence scores
    - Useful for form schema generation and document understanding
    
    **Autofill Mode:**
    - Identifies form fields AND fills them using provided client information
    - Returns field data with values plus a filled PDF
    - Uses AI to intelligently map client data to appropriate form fields
    
    Process:
    1. Discover form fields using PyMuPDF (field names, types, coordinates)
    2. Convert PDF pages to high-quality images using PyMuPDF
    3. Send images + discovery data + client info (autofill mode) to AI agent
    4. For autofill mode: Use PDF Form Operations to fill the form with AI-determined values
    
    Features:
    - Two distinct modes: identify vs autofill
    - Cross-references visual analysis with form field metadata
    - Supports both fillable PDFs and scanned documents
    - Generates meaningful field names based on PDF content and context
    - Intelligent value mapping from client information (autofill mode)
    - Configurable image quality and AI model selection
    - Returns confidence scores for field identification accuracy
    
    Use cases:
    - **Identify**: Form schema generation, document structure analysis
    - **Autofill**: Automated form filling, client onboarding, data entry automation
    
    Input: Base64 encoded PDF data + mode + client information (autofill mode)
    Output: Mode-specific results with field data and optional filled PDF
  `;
  static readonly alias = 'pdf-ocr';

  constructor(params: T, context?: BubbleContext) {
    super(params, context);
  }

  protected async performAction(): Promise<
    Extract<PDFOcrWorkflowResult, { mode: T['mode'] }>
  > {
    const startTime = Date.now();

    console.log('[PDFOcrWorkflow] Starting comprehensive PDF OCR analysis');
    console.log(
      '[PDFOcrWorkflow] PDF data length:',
      this.params.pdfData.length
    );

    try {
      // Step 1: Discover form fields
      console.log('[PDFOcrWorkflow] Step 1: Discovering form fields...');
      const discoveryWorkflow = new PDFFormOperationsWorkflow(
        {
          operation: 'discover',
          pdfData: this.params.pdfData,
          targetPage: this.params.discoveryOptions?.targetPage,
          credentials: this.params.credentials,
        },
        this.context
      );

      const discoveryResult = await discoveryWorkflow.action();

      if (!discoveryResult.success) {
        throw new Error(`Field discovery failed: ${discoveryResult.error}`);
      }

      console.log(
        `[PDFOcrWorkflow] Discovered ${discoveryResult.data?.totalFields} fields`
      );

      // Step 2: Convert PDF to images
      console.log('[PDFOcrWorkflow] Step 2: Converting PDF to images...');
      const imageWorkflow = new PDFFormOperationsWorkflow(
        {
          operation: 'convert-to-images',
          pdfData: this.params.pdfData,
          format: this.params.imageOptions?.format || 'png',
          quality: this.params.imageOptions?.quality || 0.8,
          dpi: this.params.imageOptions?.dpi || 150,
          pages: this.params.imageOptions?.pages,
          credentials: this.params.credentials,
        },
        this.context
      );

      const imageResult = await imageWorkflow.action();

      if (!imageResult.success) {
        throw new Error(`Image conversion failed: ${imageResult.error}`);
      }

      console.log(
        `[PDFOcrWorkflow] Converted ${imageResult.data?.convertedPages} pages to images`
      );

      // Step 3: Prepare data for AI analysis
      console.log('[PDFOcrWorkflow] Step 3: Preparing data for AI analysis...');

      // Prepare images for AI agent
      const imageInputs =
        imageResult.data?.images?.map((image) => ({
          type: 'base64' as const,
          data: image.imageData,
          mimeType: image.format === 'png' ? 'image/png' : 'image/jpeg',
          description: `Page ${image.pageNumber} - PDF form field extraction`,
        })) || [];

      // Prepare discovery data summary for AI prompt
      const fieldsData = discoveryResult.data?.fields || [];
      const discoveryContext =
        fieldsData.length > 0
          ? `\nDiscovered form fields metadata:
${fieldsData
  .map(
    (field) =>
      `- ID: ${field.id}, Name: "${field.name}", Type: ${field.type}, Page: ${field.page}, Value: "${field.current_value}", Coordinates: (${field.x}, ${field.y}, ${field.width}x${field.height})`
  )
  .join('\n')}`
          : '\nNo structured form fields discovered. Perform pure OCR analysis of the images.';

      // Choose system prompt based on mode
      const basePrompt =
        this.params.mode === 'identify'
          ? IDENTIFY_MODE_PROMPT
          : AUTOFILL_MODE_PROMPT;

      // Add client information context for autofill mode
      const clientContext =
        this.params.mode === 'autofill'
          ? `\n\nClient Information:\n${this.params.clientInformation}\n\nUse this information to fill appropriate field values.`
          : '';

      const enhancedPrompt = basePrompt + discoveryContext + clientContext;

      // Step 4: AI analysis
      console.log('[PDFOcrWorkflow] Step 4: Performing AI analysis...');
      const aiAgent = new AIAgentBubble(
        {
          message:
            this.params.mode === 'identify'
              ? `Please analyze these PDF pages and identify all form fields. 
        
Please return a JSON array of field objects as specified in the system prompt. Focus on:
1. Identifying all text fields, checkboxes, and form elements
2. Generating descriptive field names based on labels, context, and purpose
3. Cross-referencing with any discovered form field metadata provided
4. Providing confidence scores for field identification

Return only the JSON array, no additional text or formatting.`
              : `Please analyze these PDF pages and identify all form fields, then fill them using the provided client information. 
        
Please return a JSON array of field objects as specified in the system prompt. Focus on:
1. Identifying all text fields, checkboxes, and form elements
2. Generating descriptive field names based on labels, context, and purpose
3. Cross-referencing with any discovered form field metadata provided
4. Using the client information to determine appropriate values for each field
5. Providing confidence scores for field identification and value assignment

Return only the JSON array, no additional text or formatting.`,
          images: imageInputs,
          systemPrompt: enhancedPrompt,
          model: {
            model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
            temperature: this.params.aiOptions?.temperature || 0.3,
            maxTokens: this.params.aiOptions?.maxTokens || 50000,
            jsonMode: this.params.aiOptions?.jsonMode ?? true,
          },
          credentials: this.params.credentials,
          tools: [], // No tools needed for this analysis
          maxIterations: 3,
        },
        this.context
      );

      const aiResult = await aiAgent.action();

      if (!aiResult.success) {
        throw new Error(`AI analysis failed: ${aiResult.error}`);
      }

      console.log('[PDFOcrWorkflow] AI analysis completed');

      // Step 5: Parse AI response and structure results
      console.log('[PDFOcrWorkflow] Step 5: Processing AI results...');

      let extractedFields: FieldExtractionResult[] = [];

      try {
        // Parse the AI response as JSON
        const aiResponse = aiResult.data?.response || '[]';
        const parsedFields = JSON.parse(aiResponse);

        if (Array.isArray(parsedFields)) {
          extractedFields = parsedFields.map((field, index) => {
            const baseField = {
              id: field.id || index + 1000, // Use provided ID or generate one
              fieldName: field.fieldName || field.name || `field_${index + 1}`,
              confidence: Math.min(Math.max(field.confidence || 0.8, 0), 1), // Clamp between 0-1
            };

            // Add value for autofill mode
            if (this.params.mode === 'autofill') {
              return {
                ...baseField,
                originalFieldName: field.originalFieldName,
                value: field.value || '',
              } as AutofillFieldResult;
            }

            return baseField as IdentifyFieldResult;
          });
        } else {
          console.warn(
            '[PDFOcrWorkflow] AI response was not an array, attempting to extract fields from object'
          );
          // If AI returned an object instead of array, try to convert it
          if (typeof parsedFields === 'object' && parsedFields !== null) {
            extractedFields = Object.entries(parsedFields).map(
              ([key], index) => {
                const baseField = {
                  id: index + 1000,
                  fieldName: key,
                  confidence: 0.7, // Lower confidence for converted data
                };

                // Add value for autofill mode
                if (this.params.mode === 'autofill') {
                  return {
                    ...baseField,
                    originalFieldName: undefined,
                    value: '',
                  } as AutofillFieldResult;
                }

                return baseField as IdentifyFieldResult;
              }
            );
          }
        }
      } catch {
        console.warn(
          '[PDFOcrWorkflow] Failed to parse AI response as JSON, attempting text extraction'
        );
        // Fallback: try to extract field-value pairs from text response
        const response = aiResult.data?.response || '';
        const lines = response
          .split('\n')
          .filter((line) => line.trim().length > 0);

        extractedFields = lines.map((line, index) => {
          const match = line.match(/^[•\-*]?\s*(.+?):\s*(.+)$/);
          if (match) {
            const baseField = {
              id: index + 1000,
              fieldName: match[1].trim(),
              confidence: 0.6, // Lower confidence for regex-extracted data
            };

            // Add value for autofill mode
            if (this.params.mode === 'autofill') {
              return {
                ...baseField,
                originalFieldName: undefined,
                value: match[2]?.trim() || '',
              } as AutofillFieldResult;
            }

            return baseField as IdentifyFieldResult;
          }
          const baseField = {
            id: index + 1000,
            fieldName: `extracted_text_${index + 1}`,
            confidence: 0.5,
          };

          // Add value for autofill mode
          if (this.params.mode === 'autofill') {
            return {
              ...baseField,
              originalFieldName: undefined,
              value: '',
            } as AutofillFieldResult;
          }

          return baseField as IdentifyFieldResult;
        });
      }

      const processingTime = Date.now() - startTime;

      console.log(
        `[PDFOcrWorkflow] Extracted ${extractedFields.length} fields`
      );
      console.log(
        `[PDFOcrWorkflow] Total processing time: ${processingTime}ms`
      );

      // Handle autofill mode - fill the PDF with extracted values
      let filledPdfData = '';
      let fillResults = { filledFields: 0, successfullyFilled: 0 };

      if (this.params.mode === 'autofill') {
        console.log(
          '[PDFOcrWorkflow] Step 5: Filling PDF with extracted values...'
        );

        // Create field values map from autofill results
        const fieldValues: Record<string, string> = {};

        extractedFields.forEach((field) => {
          if ('value' in field && field.value) {
            let matchingDiscoveredField:
              | {
                  type: string;
                  name: string;
                  id: number;
                  label: string;
                  width: number;
                  height: number;
                  page: number;
                  field_type: string;
                  current_value: string;
                  choices: string[];
                  rect: [number, number, number, number];
                  x: number;
                  y: number;
                  field_flags: number;
                  potential_labels: string[];
                }
              | undefined = undefined;

            // First try: Use originalFieldName if available (most precise)
            if (field.originalFieldName) {
              matchingDiscoveredField = fieldsData.find(
                (f) => f.name === field.originalFieldName
              );
              if (matchingDiscoveredField) {
                console.log(
                  `[PDFOcrWorkflow] DEBUG: Direct match via originalFieldName: "${field.originalFieldName}" = "${field.value}"`
                );
              }
            }

            // Second try: Match by exact field name
            if (!matchingDiscoveredField) {
              matchingDiscoveredField = fieldsData.find(
                (f) => f.name === field.fieldName
              );
              if (matchingDiscoveredField) {
                console.log(
                  `[PDFOcrWorkflow] DEBUG: Exact match via fieldName: "${field.fieldName}" -> "${matchingDiscoveredField.name}" = "${field.value}"`
                );
              }
            }

            // Third try: Fuzzy match by normalized field name (remove spaces, lowercase)
            if (!matchingDiscoveredField) {
              const normalizedFieldName = field.fieldName
                .toLowerCase()
                .replace(/\s+/g, '');

              matchingDiscoveredField = fieldsData.find(
                (f) =>
                  f.name.toLowerCase().replace(/\s+/g, '') ===
                  normalizedFieldName
              );

              if (matchingDiscoveredField) {
                console.log(
                  `[PDFOcrWorkflow] DEBUG: Fuzzy match: "${field.fieldName}" -> "${matchingDiscoveredField.name}" = "${field.value}"`
                );
              }
            }

            if (matchingDiscoveredField) {
              fieldValues[matchingDiscoveredField.name] = field.value;
            } else {
              console.log(
                `[PDFOcrWorkflow] DEBUG: No match found for AI field: "${field.fieldName}" (originalFieldName: "${field.originalFieldName}", value: "${field.value}")`
              );
            }
          }
        });

        if (Object.keys(fieldValues).length > 0) {
          console.log(
            `[PDFOcrWorkflow] Attempting to fill ${Object.keys(fieldValues).length} fields`
          );

          // Use PDF Form Operations to fill the form
          const fillWorkflow = new PDFFormOperationsWorkflow(
            {
              operation: 'fill',
              pdfData: this.params.pdfData,
              fieldValues,
              credentials: this.params.credentials,
            },
            this.context
          );

          const fillResult = await fillWorkflow.action();

          if (fillResult.success && fillResult.data) {
            filledPdfData = fillResult.data.filledPdfData;
            fillResults = {
              filledFields: Object.keys(fieldValues).length,
              successfullyFilled: fillResult.data.filledFields,
            };
            console.log(
              `[PDFOcrWorkflow] Successfully filled ${fillResults.successfullyFilled} fields`
            );
          } else {
            console.warn(
              `[PDFOcrWorkflow] PDF filling failed: ${fillResult.error}`
            );
            // Fall back to original PDF
            filledPdfData = this.params.pdfData;
          }
        } else {
          console.log(
            '[PDFOcrWorkflow] No field values found for filling, returning original PDF'
          );
          filledPdfData = this.params.pdfData;
        }
      }

      // TypeScript can't narrow the generic T inside the conditional, so we need to help it
      const result = await (async (): Promise<PDFOcrWorkflowResult> => {
        // Return appropriate result based on mode
        if (this.params.mode === 'identify') {
          return {
            mode: 'identify' as const,
            extractedFields: extractedFields as IdentifyFieldResult[],
            discoveryData: {
              totalFields: discoveryResult.data?.totalFields || 0,
              fieldsWithCoordinates: fieldsData.filter(
                (f) => f.x !== 0 || f.y !== 0
              ).length,
              pages: [...new Set(fieldsData.map((f) => f.page))],
            },
            imageData: {
              totalPages: imageResult.data?.totalPages || 0,
              convertedPages: imageResult.data?.convertedPages || 0,
              format: this.params.imageOptions?.format || 'png',
              dpi: this.params.imageOptions?.dpi || 150,
            },
            aiAnalysis: {
              model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
              iterations: aiResult.data?.iterations || 0,
              processingTime,
            },
            success: true,
            error: '',
          };
        } else {
          return {
            mode: 'autofill' as const,
            extractedFields: extractedFields as AutofillFieldResult[],
            filledPdfData,
            discoveryData: {
              totalFields: discoveryResult.data?.totalFields || 0,
              fieldsWithCoordinates: fieldsData.filter(
                (f) => f.x !== 0 || f.y !== 0
              ).length,
              pages: [...new Set(fieldsData.map((f) => f.page))],
            },
            imageData: {
              totalPages: imageResult.data?.totalPages || 0,
              convertedPages: imageResult.data?.convertedPages || 0,
              format: this.params.imageOptions?.format || 'png',
              dpi: this.params.imageOptions?.dpi || 150,
            },
            aiAnalysis: {
              model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
              iterations: aiResult.data?.iterations || 0,
              processingTime,
            },
            fillResults,
            success: true,
            error: '',
          };
        }
      })();

      // The result is guaranteed to match T['mode'] because of the discriminated union
      return result as Extract<PDFOcrWorkflowResult, { mode: T['mode'] }>;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('[PDFOcrWorkflow] Workflow failed:', error);

      // Return appropriate error result based on mode
      const errorResult = (() => {
        if (this.params.mode === 'identify') {
          return {
            mode: 'identify' as const,
            extractedFields: [] as IdentifyFieldResult[],
            discoveryData: {
              totalFields: 0,
              fieldsWithCoordinates: 0,
              pages: [] as number[],
            },
            imageData: {
              totalPages: 0,
              convertedPages: 0,
              format: this.params.imageOptions?.format || 'png',
              dpi: this.params.imageOptions?.dpi || 150,
            },
            aiAnalysis: {
              model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
              iterations: 0,
              processingTime,
            },
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during PDF OCR workflow',
          };
        } else {
          return {
            mode: 'autofill' as const,
            extractedFields: [] as AutofillFieldResult[],
            filledPdfData: '',
            discoveryData: {
              totalFields: 0,
              fieldsWithCoordinates: 0,
              pages: [] as number[],
            },
            imageData: {
              totalPages: 0,
              convertedPages: 0,
              format: this.params.imageOptions?.format || 'png',
              dpi: this.params.imageOptions?.dpi || 150,
            },
            aiAnalysis: {
              model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
              iterations: 0,
              processingTime,
            },
            fillResults: {
              filledFields: 0,
              successfullyFilled: 0,
            },
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error during PDF OCR workflow',
          };
        }
      })();

      return errorResult as Extract<PDFOcrWorkflowResult, { mode: T['mode'] }>;
    }
  }
}
