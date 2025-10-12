/**
 * PDF FORM OPERATIONS WORKFLOW
 *
 * A unified workflow for PDF form operations including field discovery,
 * form filling, checkbox analysis, and form validation using pdf-lib.
 *
 * Provides multiple operations similar to Resend email service:
 * - discover: Extract all form fields with metadata
 * - fill: Fill form fields with provided values
 * - analyze-checkboxes: Get checkbox states and possible values
 * - validate: Verify form field values and completion
 */

import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { spawn } from 'child_process';
import path from 'path';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';

/**
 * PDF Form Field metadata interface
 */
interface PDFFormFieldData {
  id: number;
  page: number;
  name: string;
  type: string;
  field_type: string;
  current_value: string;
  choices: string[];
  rect: [number, number, number, number];
  x: number;
  y: number;
  width: number;
  height: number;
  field_flags: number;
  label: string;
  potential_labels: string[];
}

/**
 * Checkbox analysis result interface
 */
interface CheckboxAnalysisResult {
  page: number;
  current_value: string;
  possible_values: string[];
  field_flags: number;
}

/**
 * Form validation result interface
 */
interface FormValidationResult {
  value: string;
  type: string;
  page: number;
}

/**
 * Image conversion result interface
 */
interface ImageConversionResult {
  pageNumber: number;
  imageData: string;
  format: string;
  width: number;
  height: number;
}

/**
 * Operation-specific parameter schemas
 */
const DiscoverOperationSchema = z.object({
  operation: z.literal('discover'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
  targetPage: z
    .number()
    .optional()
    .describe('Extract fields from specific page only (default: all pages)'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

const FillOperationSchema = z.object({
  operation: z.literal('fill'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
  fieldValues: z
    .record(z.string(), z.string())
    .describe('Field name to value mapping'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

const AnalyzeCheckboxesOperationSchema = z.object({
  operation: z.literal('analyze-checkboxes'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

const ValidateOperationSchema = z.object({
  operation: z.literal('validate'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

const ConvertToImagesOperationSchema = z.object({
  operation: z.literal('convert-to-images'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
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
    .array(z.number())
    .optional()
    .describe(
      'Specific page numbers to convert (1-indexed). If not provided, converts all pages'
    ),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

const ConvertToMarkdownOperationSchema = z.object({
  operation: z.literal('convert-to-markdown'),
  pdfData: z.string().describe('Base64 encoded PDF data'),
  pages: z
    .array(z.number())
    .optional()
    .describe(
      'Specific page numbers to convert (1-indexed). If not provided, converts all pages'
    ),
  includeFormFields: z
    .boolean()
    .default(true)
    .describe('Whether to include form field information in the markdown'),
  credentials: z.record(z.nativeEnum(CredentialType), z.string()).optional(),
});

/**
 * Combined parameters schema using discriminated union
 */
const PDFFormOperationsParamsSchema = z.discriminatedUnion('operation', [
  DiscoverOperationSchema,
  FillOperationSchema,
  AnalyzeCheckboxesOperationSchema,
  ValidateOperationSchema,
  ConvertToImagesOperationSchema,
  ConvertToMarkdownOperationSchema,
]);

/**
 * Operation-specific result schemas
 */
const DiscoverResultSchema = z.object({
  operation: z.literal('discover'),
  fields: z.array(
    z.object({
      id: z.number(),
      page: z.number(),
      name: z.string(),
      type: z.string(),
      field_type: z.string(),
      current_value: z.string(),
      choices: z.array(z.string()),
      rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      field_flags: z.number(),
      label: z.string(),
      potential_labels: z.array(z.string()),
    })
  ),
  totalFields: z.number(),
  success: z.boolean(),
  error: z.string(),
});

const FillResultSchema = z.object({
  operation: z.literal('fill'),
  filledPdfData: z.string().describe('Base64 encoded filled PDF data'),
  filledFields: z.number(),
  verification: z.record(
    z.string(),
    z.object({
      value: z.string(),
      type: z.string(),
      page: z.number(),
    })
  ),
  success: z.boolean(),
  error: z.string(),
});

const AnalyzeCheckboxesResultSchema = z.object({
  operation: z.literal('analyze-checkboxes'),
  checkboxes: z.record(
    z.string(),
    z.object({
      page: z.number(),
      current_value: z.string(),
      possible_values: z.array(z.string()),
      field_flags: z.number(),
    })
  ),
  totalCheckboxes: z.number(),
  success: z.boolean(),
  error: z.string(),
});

const ValidateResultSchema = z.object({
  operation: z.literal('validate'),
  fields: z.record(
    z.string(),
    z.object({
      value: z.string(),
      type: z.string(),
      page: z.number(),
    })
  ),
  totalFields: z.number(),
  filledFields: z.number(),
  emptyFields: z.number(),
  success: z.boolean(),
  error: z.string(),
});

const ConvertToImagesResultSchema = z.object({
  operation: z.literal('convert-to-images'),
  images: z.array(
    z.object({
      pageNumber: z.number(),
      imageData: z.string().describe('Base64 encoded image data'),
      format: z.string(),
      width: z.number(),
      height: z.number(),
    })
  ),
  totalPages: z.number(),
  convertedPages: z.number(),
  success: z.boolean(),
  error: z.string(),
});

const ConvertToMarkdownResultSchema = z.object({
  operation: z.literal('convert-to-markdown'),
  markdown: z.string().describe('Markdown representation of the PDF content'),
  pages: z.array(
    z.object({
      pageNumber: z.number(),
      markdown: z.string().describe('Markdown content for this page'),
      formFields: z
        .array(
          z.object({
            id: z.number(),
            name: z.string(),
            type: z.string(),
            value: z.string(),
            x: z.number(),
            y: z.number(),
          })
        )
        .optional(),
    })
  ),
  totalPages: z.number(),
  convertedPages: z.number(),
  success: z.boolean(),
  error: z.string(),
});

/**
 * Combined result schema using discriminated union
 */
const PDFFormOperationsResultSchema = z.discriminatedUnion('operation', [
  DiscoverResultSchema,
  FillResultSchema,
  AnalyzeCheckboxesResultSchema,
  ValidateResultSchema,
  ConvertToImagesResultSchema,
  ConvertToMarkdownResultSchema,
]);

type PDFFormOperationsParams = z.output<typeof PDFFormOperationsParamsSchema>;
type PDFFormOperationsResult = z.output<typeof PDFFormOperationsResultSchema>;

/**
 * PDF Form Operations Workflow
 * Provides unified interface for PDF form operations using pdf-lib
 */
export class PDFFormOperationsWorkflow<
  T extends PDFFormOperationsParams = PDFFormOperationsParams,
> extends WorkflowBubble<
  T,
  Extract<PDFFormOperationsResult, { operation: T['operation'] }>
> {
  static readonly type = 'workflow' as const;
  static readonly bubbleName = 'pdf-form-operations';
  static readonly schema = PDFFormOperationsParamsSchema;
  static readonly resultSchema = PDFFormOperationsResultSchema;
  static readonly shortDescription =
    'PDF form field operations (discover, fill, analyze, validate, convert-to-images, convert-to-markdown)';
  static readonly longDescription = `
    Unified PDF form operations workflow providing comprehensive form field manipulation.
    
    Operations:
    - discover: Extract all form fields with coordinates and metadata
    - fill: Fill form fields with provided values and return filled PDF
    - analyze-checkboxes: Analyze checkbox fields and their possible values
    - validate: Verify form field values and completion status
    - convert-to-images: Convert PDF pages to PNG/JPEG images with customizable quality and DPI
    - convert-to-markdown: Convert PDF to markdown format using AI analysis of visual content
    
    Uses PyMuPDF (fitz) library via Python scripts for all PDF operations.
    
    Input: Base64 encoded PDF data
    Output: Operation-specific results with success/error handling
  `;
  static readonly alias = 'pdf-forms';

  constructor(
    params: T = {
      operation: 'discover',
      pdfData: '',
    } as T,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  /**
   * Execute a Python script with the given arguments (stdin input)
   */
  private async executePythonScript(
    scriptName: string,
    args: string[] = [],
    stdinData?: Buffer
  ): Promise<{ stdout: string; stderr: string; stdoutBuffer: Buffer }> {
    const scriptsDir = path.join(__dirname, '..', '..', '..', 'scripts');
    const scriptPath = path.join(scriptsDir, scriptName);
    const pythonPath = process.env.PYTHON_PATH || 'python3';

    return new Promise((resolve, reject) => {
      const child = spawn(pythonPath, [scriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: scriptsDir,
      });

      let stdout = '';
      let stderr = '';
      const stdoutChunks: Buffer[] = [];

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        stdoutChunks.push(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          const stdoutBuffer = Buffer.concat(stdoutChunks);
          resolve({ stdout, stderr, stdoutBuffer });
        } else {
          reject(
            new Error(
              `Script ${scriptName} exited with code ${code}: ${stderr}`
            )
          );
        }
      });

      child.on('error', (error) => {
        reject(
          new Error(`Failed to spawn script ${scriptName}: ${error.message}`)
        );
      });

      // Send stdin data if provided
      if (stdinData) {
        child.stdin.write(stdinData);
      }
      child.stdin.end();
    });
  }

  /**
   * Execute a Python script with file input (for optimized memory usage)
   */
  private async executePythonFileScript(
    scriptName: string,
    args: string[] = [],
    inputFilePath: string
  ): Promise<{ stdout: string; stderr: string; stdoutBuffer: Buffer }> {
    const scriptsDir = path.join(__dirname, '..', '..', '..', 'scripts');
    const scriptPath = path.join(scriptsDir, scriptName);
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const { createReadStream } = await import('fs');

    return new Promise((resolve, reject) => {
      const child = spawn(pythonPath, [scriptPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: scriptsDir,
      });

      let stdout = '';
      let stderr = '';
      const stdoutChunks: Buffer[] = [];

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        stdoutChunks.push(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          const stdoutBuffer = Buffer.concat(stdoutChunks);
          resolve({ stdout, stderr, stdoutBuffer });
        } else {
          reject(
            new Error(
              `Script ${scriptName} exited with code ${code}: ${stderr}`
            )
          );
        }
      });

      child.on('error', (error) => {
        reject(
          new Error(`Failed to spawn script ${scriptName}: ${error.message}`)
        );
      });

      // For file-based scripts, we read the file and pipe it to stdin
      const fileStream = createReadStream(inputFilePath);

      fileStream.on('error', (error: Error) => {
        reject(new Error(`Failed to read input file: ${error.message}`));
      });

      fileStream.pipe(child.stdin);

      fileStream.on('end', () => {
        child.stdin.end();
      });
    });
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<PDFFormOperationsResult, { operation: T['operation'] }>> {
    void context;

    console.log(
      '[PDFFormOperations] Starting operation:',
      this.params.operation
    );

    try {
      // Decode PDF data
      const pdfBuffer = Buffer.from(this.params.pdfData, 'base64');

      // TypeScript can't narrow the generic T inside the switch, so we need to help it
      const result = await (async (): Promise<PDFFormOperationsResult> => {
        switch (this.params.operation) {
          case 'discover':
            return await this.discoverFields(pdfBuffer, this.params.targetPage);

          case 'fill':
            return await this.fillFields(pdfBuffer, this.params.fieldValues);

          case 'analyze-checkboxes':
            return await this.analyzeCheckboxes(pdfBuffer);

          case 'validate':
            return await this.validateFields(pdfBuffer);

          case 'convert-to-images':
            return await this.convertToImages(pdfBuffer, this.params.pages);

          case 'convert-to-markdown':
            return await this.convertToMarkdown(
              pdfBuffer,
              this.params.pages,
              this.params.includeFormFields
            );

          default:
            // TypeScript should prevent this, but adding for safety
            throw new Error(
              `Unknown operation: ${(this.params as { operation: string }).operation}`
            );
        }
      })();

      // The result is guaranteed to match T['operation'] because of the discriminated union
      return result as Extract<
        PDFFormOperationsResult,
        { operation: T['operation'] }
      >;
    } catch (error) {
      console.error('[PDFFormOperations] Error during operation:', error);

      // Return error result with proper operation type
      const baseError = {
        success: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during PDF operation',
      };

      // Return type-safe error result based on operation
      const errorResult = (() => {
        switch (this.params.operation) {
          case 'discover':
            return {
              ...baseError,
              operation: 'discover' as const,
              fields: [],
              totalFields: 0,
            };
          case 'fill':
            return {
              ...baseError,
              operation: 'fill' as const,
              filledPdfData: '',
              filledFields: 0,
              verification: {},
            };
          case 'analyze-checkboxes':
            return {
              ...baseError,
              operation: 'analyze-checkboxes' as const,
              checkboxes: {},
              totalCheckboxes: 0,
            };
          case 'validate':
            return {
              ...baseError,
              operation: 'validate' as const,
              fields: {},
              totalFields: 0,
              filledFields: 0,
              emptyFields: 0,
            };
          case 'convert-to-images':
            return {
              ...baseError,
              operation: 'convert-to-images' as const,
              images: [],
              totalPages: 0,
              convertedPages: 0,
            };
          case 'convert-to-markdown':
            return {
              ...baseError,
              operation: 'convert-to-markdown' as const,
              markdown: '',
              pages: [],
              totalPages: 0,
              convertedPages: 0,
            };
          default:
            throw error; // Should never reach here due to TypeScript
        }
      })();

      return errorResult as Extract<
        PDFFormOperationsResult,
        { operation: T['operation'] }
      >;
    }
  }

  /**
   * Discover all form fields in the PDF
   */
  private async discoverFields(
    pdfBuffer: Buffer,
    targetPage?: number
  ): Promise<z.output<typeof DiscoverResultSchema>> {
    console.log('[PDFFormOperations] Discovering fields...');

    try {
      const args =
        targetPage !== undefined ? ['--page', targetPage.toString()] : [];
      const result = await this.executePythonScript(
        'discover_pdf_fields.py',
        args,
        pdfBuffer
      );

      const fields: PDFFormFieldData[] = JSON.parse(result.stdout);

      console.log('[PDFFormOperations] Discovered', fields.length, 'fields');

      return {
        operation: 'discover' as const,
        fields,
        totalFields: fields.length,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[PDFFormOperations] Error discovering fields:', error);
      return {
        operation: 'discover' as const,
        fields: [],
        totalFields: 0,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to discover PDF fields',
      };
    }
  }

  /**
   * Fill form fields with provided values
   */
  private async fillFields(
    pdfBuffer: Buffer,
    fieldValues: Record<string, string>
  ): Promise<z.output<typeof FillResultSchema>> {
    console.log('[PDFFormOperations] Filling fields...');
    console.log(
      '[PDFFormOperations] Field values to set:',
      Object.keys(fieldValues)
    );

    try {
      const args = [JSON.stringify(fieldValues)];
      const result = await this.executePythonScript(
        'fill_form_fields_fitz_v2.py',
        args,
        pdfBuffer
      );

      // The Python script returns the filled PDF binary data via stdout.buffer
      const filledPdfData = result.stdoutBuffer.toString('base64');

      // Get verification data by calling the discover script on the filled PDF
      const verifyResult = await this.executePythonScript(
        'discover_pdf_fields.py',
        [],
        result.stdoutBuffer
      );
      const fields: PDFFormFieldData[] = JSON.parse(verifyResult.stdout);

      // Build verification object
      const verification: Record<string, FormValidationResult> = {};
      let filledCount = 0;

      for (const field of fields) {
        if (field.name in fieldValues) {
          verification[field.name] = {
            value: field.current_value,
            type: field.field_type,
            page: field.page,
          };
          if (field.current_value) {
            filledCount++;
          }
        }
      }

      console.log(
        '[PDFFormOperations] Successfully filled',
        filledCount,
        'fields'
      );

      return {
        operation: 'fill' as const,
        filledPdfData,
        filledFields: filledCount,
        verification,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[PDFFormOperations] Error filling fields:', error);
      return {
        operation: 'fill' as const,
        filledPdfData: '',
        filledFields: 0,
        verification: {},
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to fill PDF fields',
      };
    }
  }

  /**
   * Analyze checkbox fields and their possible values
   */
  private async analyzeCheckboxes(
    pdfBuffer: Buffer
  ): Promise<z.output<typeof AnalyzeCheckboxesResultSchema>> {
    console.log('[PDFFormOperations] Analyzing checkboxes...');

    try {
      const result = await this.executePythonScript(
        'get_checkbox_values.py',
        [],
        pdfBuffer
      );
      const checkboxes: Record<string, CheckboxAnalysisResult> = JSON.parse(
        result.stdout
      );

      console.log(
        '[PDFFormOperations] Found',
        Object.keys(checkboxes).length,
        'checkboxes'
      );

      return {
        operation: 'analyze-checkboxes' as const,
        checkboxes,
        totalCheckboxes: Object.keys(checkboxes).length,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[PDFFormOperations] Error analyzing checkboxes:', error);
      return {
        operation: 'analyze-checkboxes' as const,
        checkboxes: {},
        totalCheckboxes: 0,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze PDF checkboxes',
      };
    }
  }

  /**
   * Validate form fields and their values
   */
  private async validateFields(
    pdfBuffer: Buffer
  ): Promise<z.output<typeof ValidateResultSchema>> {
    console.log('[PDFFormOperations] Validating fields...');

    try {
      const result = await this.executePythonScript(
        'discover_pdf_fields.py',
        [],
        pdfBuffer
      );
      const fields: PDFFormFieldData[] = JSON.parse(result.stdout);

      const validationResults: Record<string, FormValidationResult> = {};
      let filledFields = 0;

      for (const field of fields) {
        const hasValue =
          field.current_value && field.current_value.trim().length > 0;

        // For checkboxes, consider 'Yes' as filled, 'Off' as empty
        const isFilledCheckbox =
          field.field_type === 'CheckBox' && field.current_value !== 'Off';

        if (hasValue || isFilledCheckbox) {
          filledFields++;
        }

        validationResults[field.name] = {
          value: field.current_value,
          type: field.field_type,
          page: field.page,
        };
      }

      const totalFields = Object.keys(validationResults).length;
      const emptyFields = totalFields - filledFields;

      console.log('[PDFFormOperations] Validation complete:', {
        total: totalFields,
        filled: filledFields,
        empty: emptyFields,
      });

      return {
        operation: 'validate' as const,
        fields: validationResults,
        totalFields,
        filledFields,
        emptyFields,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[PDFFormOperations] Error validating fields:', error);
      return {
        operation: 'validate' as const,
        fields: {},
        totalFields: 0,
        filledFields: 0,
        emptyFields: 0,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to validate PDF fields',
      };
    }
  }

  /**
   * Convert PDF pages to images
   */
  private async convertToImages(
    pdfBuffer: Buffer,
    pages?: number[]
  ): Promise<z.output<typeof ConvertToImagesResultSchema>> {
    console.log('[PDFFormOperations] Converting PDF to images...');
    console.log(
      '[PDFFormOperations] Using optimized memory-efficient conversion'
    );

    let tempDir: string | null = null;
    let tempPdfPath: string | null = null;

    try {
      // Create temporary directory and save PDF file
      tempDir = mkdtempSync(path.join(tmpdir(), 'pdf-conversion-'));
      tempPdfPath = path.join(tempDir, 'input.pdf');
      writeFileSync(tempPdfPath, pdfBuffer);

      console.log('[PDFFormOperations] Saved PDF to temp file:', tempPdfPath);

      // Prepare arguments for the optimized script
      const args: string[] = [];

      // Add specific pages if provided (convert to JSON array format)
      if (pages && pages.length > 0) {
        args.push(JSON.stringify(pages));
      }

      // Use the memory-optimized script
      const result = await this.executePythonFileScript(
        'pdf_to_markdown_images.py',
        args,
        tempPdfPath
      );

      console.log('[PDFFormOperations] Python stderr:', result.stderr);
      console.log(
        '[PDFFormOperations] Python stdout length:',
        result.stdout.length
      );
      console.log(
        '[PDFFormOperations] Python stdout preview:',
        result.stdout.substring(0, 200)
      );

      // Parse and immediately transform to avoid storing duplicate data
      const imageResults: Array<{
        page: number;
        format: string;
        data: string;
        width: number;
        height: number;
        size_kb: number;
      }> = JSON.parse(result.stdout);

      // Transform to final format and clear original data
      const images: ImageConversionResult[] = [];

      for (const img of imageResults) {
        images.push({
          pageNumber: img.page,
          imageData: img.data,
          format: img.format,
          width: img.width,
          height: img.height,
        });

        // Clear the original image data immediately after processing
        (img as { data?: string }).data = undefined;
      }

      // Clear the original array and result stdout to free memory
      imageResults.length = 0;
      (result as { stdout?: string; stdoutBuffer?: Buffer }).stdout = undefined;
      (result as { stdout?: string; stdoutBuffer?: Buffer }).stdoutBuffer =
        undefined;

      const convertedPages = images.length;
      const totalPages = pages ? pages.length : convertedPages;

      console.log(
        '[PDFFormOperations] Successfully converted',
        convertedPages,
        'pages using memory-optimized JPEG format'
      );

      return {
        operation: 'convert-to-images' as const,
        images,
        totalPages,
        convertedPages,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error(
        '[PDFFormOperations] Error converting PDF to images:',
        error
      );
      return {
        operation: 'convert-to-images' as const,
        images: [],
        totalPages: 0,
        convertedPages: 0,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to convert PDF to images',
      };
    } finally {
      // Cleanup temporary files
      try {
        if (tempPdfPath) {
          unlinkSync(tempPdfPath);
        }
        if (tempDir) {
          // Remove the temp directory (should be empty now)
          const { rmSync } = await import('fs');
          rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.warn(
          '[PDFFormOperations] Failed to cleanup temp files:',
          cleanupError
        );
      }
    }
  }

  /**
   * Convert PDF to markdown using AI analysis of visual content
   */
  private async convertToMarkdown(
    pdfBuffer: Buffer,
    pages?: number[],
    includeFormFields: boolean = true
  ): Promise<z.output<typeof ConvertToMarkdownResultSchema>> {
    console.log('[PDFFormOperations] Converting PDF to markdown...');

    let tempDir: string | null = null;
    let tempPdfPath: string | null = null;

    try {
      // Create temporary directory and save PDF file for better memory management
      tempDir = mkdtempSync(path.join(tmpdir(), 'pdf-markdown-'));
      tempPdfPath = path.join(tempDir, 'input.pdf');
      writeFileSync(tempPdfPath, pdfBuffer);

      console.log(
        '[PDFFormOperations] Saved PDF to temp file for markdown conversion:',
        tempPdfPath
      );

      // First, convert PDF pages to images for AI analysis
      const args = pages ? [JSON.stringify(pages)] : [];
      const imageResult = await this.executePythonFileScript(
        'pdf_to_markdown_images.py',
        args,
        tempPdfPath
      );

      const images: Array<{
        page: number;
        format: string;
        data: string;
        width: number;
        height: number;
      }> = JSON.parse(imageResult.stdout);

      console.log(
        '[PDFFormOperations] Generated',
        images.length,
        'images for AI analysis'
      );

      // Get form fields if requested
      let formFieldsData: PDFFormFieldData[] = [];
      if (includeFormFields) {
        try {
          const fieldsResult = await this.executePythonScript(
            'discover_pdf_fields.py',
            [],
            pdfBuffer
          );
          formFieldsData = JSON.parse(fieldsResult.stdout);
        } catch (error) {
          console.warn(
            '[PDFFormOperations] Could not extract form fields:',
            error
          );
        }
      }

      // Process each page with AI
      const pageResults = [];
      let combinedMarkdown = '';

      for (const image of images) {
        console.log(
          `[PDFFormOperations] Analyzing page ${image.page} with AI...`
        );

        // Get form fields for this page
        const pageFormFields = formFieldsData
          .filter((field) => field.page === image.page)
          .map((field) => ({
            id: field.id,
            name: field.name,
            type: field.field_type,
            value: field.current_value,
            x: field.x,
            y: field.y,
          }));

        // Prepare prompt for AI analysis
        let prompt = `Convert this PDF form page to markdown format, reading from left to right, top to bottom in natural reading order.

The form fields are numbered in this same natural reading order (top-left to bottom-right). For fillable form fields, use these EXACT formats:
- Text fields: **[FIELD-ID]** (where ID is the numeric identifier, surrounded by double asterisks and brackets)
- Checkboxes: [ ] **[FIELD-ID]** or [x] **[FIELD-ID]** (if checked)

Use markdown tables to preserve layout structure. Include all text, labels, and instructions exactly as they appear.

Example: **[25]** for field ID 25, or [x] **[42]** for a checked checkbox with ID 42.`;

        if (pageFormFields.length > 0) {
          prompt += `\n\nForm fields (in natural reading order):\n`;
          pageFormFields
            .sort((a, b) => a.id - b.id) // Sort by ID to ensure natural order
            .forEach((field) => {
              prompt += `- ID ${field.id}: ${field.type}\n`;
            });
          prompt +=
            '\nUse these numeric IDs in the markdown where you see the corresponding form fields.';
        }

        try {
          const aiAgent = new AIAgentBubble(
            {
              message: prompt,
              images: [
                {
                  type: 'base64',
                  data: image.data,
                  mimeType: 'image/png',
                  description: `PDF page ${image.page} (${image.width}x${image.height}px)`,
                },
              ],
              systemPrompt:
                'You are an expert at analyzing PDF documents and converting them to clean, well-structured markdown format.',
              model: {
                model: 'google/gemini-2.5-pro',
                temperature: 0.3,
                jsonMode: false,
              },
              credentials: this.params.credentials,
            },
            this.context
          );

          const aiResult = await aiAgent.action();

          if (!aiResult.success) {
            throw new Error(`AI analysis failed: ${aiResult.error}`);
          }

          const pageMarkdown = aiResult.data?.response || '';

          pageResults.push({
            pageNumber: image.page,
            markdown: pageMarkdown,
            formFields: pageFormFields.length > 0 ? pageFormFields : undefined,
          });

          // Add to combined markdown
          if (images.length > 1) {
            combinedMarkdown += `\n\n---\n# Page ${image.page}\n\n`;
          }
          combinedMarkdown += pageMarkdown;

          console.log(
            `[PDFFormOperations] Page ${image.page} analyzed successfully`
          );
        } catch (error) {
          console.error(
            `[PDFFormOperations] Error analyzing page ${image.page}:`,
            error
          );

          const fallbackMarkdown = `*(Error analyzing page ${image.page}: ${
            error instanceof Error ? error.message : 'Unknown error'
          })*`;

          pageResults.push({
            pageNumber: image.page,
            markdown: fallbackMarkdown,
            formFields: pageFormFields.length > 0 ? pageFormFields : undefined,
          });

          if (images.length > 1) {
            combinedMarkdown += `\n\n---\n# Page ${image.page}\n\n`;
          }
          combinedMarkdown += fallbackMarkdown;
        }
      }

      console.log(
        '[PDFFormOperations] Successfully converted',
        pageResults.length,
        'pages to markdown'
      );

      return {
        operation: 'convert-to-markdown' as const,
        markdown: combinedMarkdown.trim(),
        pages: pageResults,
        totalPages: images.length,
        convertedPages: pageResults.length,
        success: true,
        error: '',
      };
    } catch (error) {
      console.error(
        '[PDFFormOperations] Error converting PDF to markdown:',
        error
      );
      return {
        operation: 'convert-to-markdown' as const,
        markdown: '',
        pages: [],
        totalPages: 0,
        convertedPages: 0,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to convert PDF to markdown',
      };
    } finally {
      // Cleanup temporary files
      try {
        if (tempPdfPath) {
          unlinkSync(tempPdfPath);
        }
        if (tempDir) {
          // Remove the temp directory (should be empty now)
          const { rmSync } = await import('fs');
          rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.warn(
          '[PDFFormOperations] Failed to cleanup temp files:',
          cleanupError
        );
      }
    }
  }
}
