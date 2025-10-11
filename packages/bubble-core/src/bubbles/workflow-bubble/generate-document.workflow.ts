/**
 * GENERATE DOCUMENT WORKFLOW
 *
 * A comprehensive workflow that converts markdown documents into structured formats
 * like HTML tables, CSV, or Excel files. Uses AI analysis to extract and organize
 * data from unstructured markdown text into tabular formats.
 *
 * This workflow combines:
 * 1. AI agent analysis for data extraction from markdown documents
 * 2. JSON schema generation for structured data representation
 * 3. Format conversion to HTML, CSV, or Excel
 *
 * Returns structured data and downloadable files in the requested format.
 */

import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';
import { AvailableModels } from '../../types/ai-models.js';

/**
 * System prompt for document analysis and data extraction
 */
const DOCUMENT_ANALYSIS_PROMPT = `You are an expert document analysis and data extraction specialist. Your task is to analyze markdown documents and extract structured data based on user requirements.

IMPORTANT CONTEXT:
- Current date: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD format)
- Current year: ${new Date().getFullYear()}
- When interpreting dates, assume they are from recent years (2020s) unless explicitly stated otherwise
- Use proper 4-digit years (e.g., 2024, 2025) not abbreviated years (e.g., 24, 25)

Your process:
1. Read and understand the provided markdown documents
2. Identify data points that match the user's output requirements
3. Extract relevant information and organize it into rows and columns
4. For each extracted row, ALWAYS include which source document it came from
5. Generate a consistent JSON structure with the extracted data

Guidelines:
- Each row should represent one logical entity (e.g., expense, invoice, person, etc.)
- Column names should be descriptive and consistent
- ALWAYS include a "source_document_index" column indicating which page/document section each row was extracted from (use page numbers from the document headers)
- Handle variations in data format gracefully
- If data is missing, use empty strings rather than omitting fields
- Maintain data relationships and context where possible
- Be precise with data types (numbers, dates, text)
- For dates, always use YYYY-MM-DD format and assume recent years (2020s) unless context suggests otherwise

Return format: JSON object with:
- columns: Array of column definitions with name, type, and description
- rows: Array of data rows matching the column structure
- metadata: Summary information about the extraction

CRITICAL TYPE REQUIREMENTS:
- Column "type" field MUST be one of: "string", "number", "integer", "float", "date", "boolean"
- Row values MUST be primitives: string, number, boolean, or null (never objects or arrays)
- Date values should be strings in YYYY-MM-DD format
- Boolean values should be true/false, not "true"/"false" strings
- Numeric values should be actual numbers, not quoted strings

Example output format:
{
  "columns": [
    {"name": "vendor", "type": "string", "description": "Company or person paid"},
    {"name": "amount", "type": "number", "description": "Payment amount in dollars"},
    {"name": "date", "type": "date", "description": "Transaction date"},
    {"name": "is_recurring", "type": "boolean", "description": "Whether this is a recurring expense"},
    {"name": "source_document_index", "type": "number", "description": "Source document index"}
  ],
  "rows": [
    {"vendor": "Office Supplies Inc", "amount": 156.78, "date": "2024-01-15", "is_recurring": false, "source_document_index": 0},
    {"vendor": "Monthly Software", "amount": 99.99, "date": "2024-01-01", "is_recurring": true, "source_document_index": 1}
  ],
  "metadata": {
    "extractedCount": 2,
    "confidence": 0.95
  }
}

Focus on accuracy and consistency in data extraction while following the user's specific requirements for the output structure.`;

/**
 * Column definition interface
 */
interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'integer' | 'float' | 'date' | 'boolean';
  description: string;
}

/**
 * Extracted data row interface
 */
interface DataRow {
  [key: string]: string | number | boolean | null;
}

/**
 * Extraction metadata interface
 */
interface ExtractionMetadata {
  totalDocuments: number;
  totalRows: number;
  totalColumns: number;
  processingTime: number;
  extractedFrom: string[];
}

/**
 * Parameters schema for Generate Document workflow
 */
const GenerateDocumentWorkflowParamsSchema = z.object({
  documents: z
    .array(
      z.object({
        content: z.string().min(1, 'Document content cannot be empty'),
        index: z.number().min(0, 'Document index must be non-negative'),
        metadata: z
          .object({
            originalFilename: z.string().optional(),
            pageCount: z.number().optional(),
            uploadedImages: z
              .array(
                z.object({
                  pageNumber: z.number(),
                  fileName: z.string(),
                  fileUrl: z.string().optional(),
                })
              )
              .optional(),
          })
          .optional(),
      })
    )
    .min(1, 'At least one document is required')
    .describe('Array of document objects with content, index, and metadata'),
  outputDescription: z
    .string()
    .min(10, 'Output description must be at least 10 characters')
    .describe(
      'Description of what the user wants to extract (e.g., "expense tracking with vendor, amount, date, category")'
    ),
  outputFormat: z
    .enum(['html', 'csv', 'json'])
    .default('html')
    .describe('Output format for the structured data'),
  aiOptions: z
    .object({
      model: AvailableModels.default('google/gemini-2.5-flash').describe(
        'AI model to use for document analysis'
      ),
      temperature: z
        .number()
        .min(0)
        .max(2)
        .default(0.1)
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
      temperature: 0.1,
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
});

/**
 * Result schema for Generate Document workflow
 */
const GenerateDocumentWorkflowResultSchema = z.object({
  columns: z
    .array(
      z.object({
        name: z.string().describe('Column name'),
        type: z
          .enum(['string', 'number', 'integer', 'float', 'date', 'boolean'])
          .describe('Data type of the column'),
        description: z
          .string()
          .describe('Description of what this column contains'),
      })
    )
    .describe('Column definitions for the structured data'),
  rows: z
    .array(
      z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()])
      )
    )
    .describe('Array of data rows extracted from documents'),
  metadata: z
    .object({
      totalDocuments: z.number().describe('Number of documents processed'),
      totalRows: z.number().describe('Number of data rows extracted'),
      totalColumns: z.number().describe('Number of columns in the result'),
      processingTime: z.number().describe('Processing time in milliseconds'),
      extractedFrom: z
        .array(z.string())
        .describe('Summary of document sources'),
    })
    .describe('Metadata about the extraction process'),
  generatedFiles: z
    .object({
      html: z.string().optional().describe('Generated HTML table'),
      csv: z.string().optional().describe('Generated CSV data'),
      json: z.string().optional().describe('Generated JSON data'),
    })
    .describe('Generated files in requested formats'),
  aiAnalysis: z
    .object({
      model: z.string().describe('AI model used'),
      iterations: z.number().describe('Number of AI iterations'),
      processingTime: z.number().optional().describe('AI processing time'),
    })
    .describe('AI analysis metadata'),
  success: z.boolean().describe('Whether the workflow completed successfully'),
  error: z.string().describe('Error message if workflow failed'),
});

type GenerateDocumentWorkflowParams = z.input<
  typeof GenerateDocumentWorkflowParamsSchema
>;
type GenerateDocumentWorkflowResult = z.output<
  typeof GenerateDocumentWorkflowResultSchema
>;

/**
 * Generate Document Workflow
 * Converts markdown documents into structured formats using AI analysis
 */
export class GenerateDocumentWorkflow extends WorkflowBubble<
  GenerateDocumentWorkflowParams,
  GenerateDocumentWorkflowResult
> {
  static readonly type = 'workflow' as const;
  static readonly bubbleName: BubbleName = 'generate-document-workflow';
  static readonly schema = GenerateDocumentWorkflowParamsSchema;
  static readonly resultSchema = GenerateDocumentWorkflowResultSchema;
  static readonly shortDescription =
    'Generate Document workflow: convert markdown to structured formats using AI';
  static readonly longDescription = `
    Comprehensive document generation workflow that transforms unstructured markdown content into structured data formats:
    
    **Process:**
    1. Analyze markdown documents using AI to understand content and structure
    2. Extract data points based on user requirements and output description
    3. Generate consistent column definitions and data rows
    4. Convert to requested format (HTML table, CSV, JSON)
    
    **Features:**
    - Multi-document processing with content consolidation
    - AI-powered data extraction and structuring
    - Flexible output format support (HTML, CSV, JSON)
    - Configurable AI model selection and parameters
    - Comprehensive metadata and analysis tracking
    - Error handling and validation
    
    **Common Use Cases:**
    - **Expense Management**: Extract vendor, amount, date, category from receipts
    - **Invoice Processing**: Structure billing information into tables
    - **Contact Lists**: Organize people and contact information
    - **Inventory Management**: Extract product details and quantities
    - **Research Data**: Structure findings and references
    
    **Input**: Array of markdown documents + output requirements description
    **Output**: Structured data in requested format with metadata and analysis
  `;
  static readonly alias = 'generate-doc';

  constructor(params: GenerateDocumentWorkflowParams, context?: BubbleContext) {
    super(params, context);
  }

  protected async performAction(): Promise<GenerateDocumentWorkflowResult> {
    const startTime = Date.now();

    console.log(
      '[GenerateDocumentWorkflow] Starting document analysis and generation'
    );
    console.log(
      '[GenerateDocumentWorkflow] Processing',
      this.params.documents.length,
      'documents'
    );
    console.log(
      '[GenerateDocumentWorkflow] Output format:',
      this.params.outputFormat
    );
    console.log(
      '[GenerateDocumentWorkflow] Full params:',
      JSON.stringify(this.params, null, 2)
    );

    try {
      // Step 1: Prepare documents for AI analysis
      console.log(
        '[GenerateDocumentWorkflow] Step 1: Preparing documents for analysis...'
      );

      // Renumber pages sequentially across all documents
      let globalPageNumber = 1;
      const documentsContext = this.params.documents
        .map((doc) => {
          // Replace page headers with sequential numbering
          let processedContent = doc.content;

          // Debug: log original content
          console.log(
            `[DEBUG] Document ${doc.index} original pages:`,
            processedContent.match(/--- Page \d+ ---/g)
          );

          // Better approach: replace with placeholders first, then replace placeholders with sequential numbers
          const pageHeaders = processedContent.match(/--- Page \d+ ---/g) || [];

          // Step 1: Replace all page headers with unique placeholders
          for (let i = 0; i < pageHeaders.length; i++) {
            processedContent = processedContent.replace(
              /--- Page \d+ ---/,
              `###PLACEHOLDER_${i}###`
            );
          }

          // Step 2: Replace placeholders with sequential page numbers
          for (let i = 0; i < pageHeaders.length; i++) {
            processedContent = processedContent.replace(
              `###PLACEHOLDER_${i}###`,
              `--- Page ${globalPageNumber} ---`
            );
            console.log(
              `[DEBUG] Set placeholder ${i} to Page ${globalPageNumber}`
            );
            globalPageNumber++;
          }

          // Debug: log final content
          console.log(
            `[DEBUG] Document ${doc.index} final pages:`,
            processedContent.match(/--- Page \d+ ---/g)
          );

          // If no page headers found, treat entire document as one page
          if (pageHeaders.length === 0) {
            processedContent = `--- Page ${globalPageNumber} ---\n\n${processedContent}`;
            globalPageNumber++;
          }

          return `\n\n--- Document ${doc.index} ---\n${processedContent}`;
        })
        .join('\n');

      console.log(
        `[GenerateDocumentWorkflow] Renumbered pages sequentially: 1 to ${globalPageNumber - 1}`
      );

      console.log('[FINAL DOCUMENTS CONTEXT]:');
      console.log(documentsContext);

      const enhancedPrompt =
        DOCUMENT_ANALYSIS_PROMPT +
        `

Documents to analyze:
${documentsContext}

User requirements:
${this.params.outputDescription}

CRITICAL: For the source_document_index column, you MUST use ONLY THE NUMERIC PAGE NUMBER from the "--- Page X ---" headers in the documents above. 
- Look for "--- Page 1 ---", "--- Page 2 ---", etc. headers  
- Extract ONLY the number (1, 2, 3, etc.) as the source_document_index value
- DO NOT include the word "Page" - use only the numeric value

Please extract structured data that matches the user's requirements. Return a JSON object with:
- columns: Array of {name, type, description} for each data field (MUST include source_document_index column)
- rows: Array of objects with data extracted from the documents (each row MUST include the correct page number as source_document_index)
- metadata: Summary information about the extraction

EXAMPLE: If data is extracted from "--- Page 2 ---", then source_document_index should be 2 (number), not "Page 2" (string) or 0.

Be thorough but precise in your extraction.`;

      // Step 2: AI analysis
      console.log(
        '[GenerateDocumentWorkflow] Step 2: Performing AI analysis...'
      );
      const aiAgent = new AIAgentBubble(
        {
          message: `Please analyze the provided markdown documents and extract structured data according to the user's requirements.

Focus on:
1. Identifying data points that match the output description
2. Creating consistent column definitions with VALID types ("string", "number", "integer", "float", "date", "boolean")
3. Extracting all relevant data rows with PRIMITIVE values only (no objects or arrays)
4. Providing accurate metadata

CRITICAL: 
- Column types must be exact strings: "string", "number", "integer", "float", "date", "boolean"
- Row values must be primitives: actual numbers (not "123"), booleans (not "true"), dates as strings ("2024-01-15"), or null
- Never use objects, arrays, or complex types in row data

Return only the JSON object as specified in the system prompt, no additional text.`,
          systemPrompt: enhancedPrompt,
          model: {
            model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
            temperature: this.params.aiOptions?.temperature || 0.1,
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

      console.log('[GenerateDocumentWorkflow] AI analysis completed');

      // Step 3: Parse AI response and structure results
      console.log(
        '[GenerateDocumentWorkflow] Step 3: Processing AI results...'
      );

      let extractedData: {
        columns: ColumnDefinition[];
        rows: DataRow[];
        metadata: Partial<ExtractionMetadata>;
      };

      try {
        const aiResponse = aiResult.data?.response || '{}';
        const parsedData = JSON.parse(aiResponse);

        extractedData = {
          columns: parsedData.columns || [],
          rows: parsedData.rows || [],
          metadata: parsedData.metadata || {},
        };

        // Post-process to ensure source_document_index values are numeric
        if (extractedData.rows && Array.isArray(extractedData.rows)) {
          console.log(
            '[GenerateDocumentWorkflow] Raw source_document_index values before processing:',
            extractedData.rows.map((row) => row.source_document_index)
          );

          extractedData.rows = extractedData.rows.map((row) => {
            if (row.source_document_index !== undefined) {
              const originalValue = row.source_document_index;
              // Extract numeric value from strings like "Page 1", "1", etc.
              let numericIndex = row.source_document_index;
              if (typeof numericIndex === 'string') {
                const match = numericIndex.match(/\d+/);
                numericIndex = match ? parseInt(match[0], 10) : numericIndex;
              }
              row.source_document_index = numericIndex;

              if (originalValue !== numericIndex) {
                console.log(
                  `[GenerateDocumentWorkflow] Converted source_document_index from '${originalValue}' to ${numericIndex}`
                );
              }
            }
            return row;
          });

          console.log(
            '[GenerateDocumentWorkflow] Final source_document_index values:',
            extractedData.rows.map((row) => row.source_document_index)
          );
        }

        // Validate and normalize the extracted data
        if (
          !Array.isArray(extractedData.columns) ||
          extractedData.columns.length === 0
        ) {
          throw new Error('No valid columns extracted from documents');
        }

        if (!Array.isArray(extractedData.rows)) {
          extractedData.rows = [];
        }

        // Normalize column types to ensure they match the schema
        extractedData.columns = extractedData.columns.map((col) => ({
          name: col.name || 'unknown',
          type: this.normalizeColumnType(col.type),
          description: col.description || '',
        }));

        // Normalize row data to ensure all values are primitives
        extractedData.rows = extractedData.rows.map((row) => {
          const normalizedRow: DataRow = {};
          for (const [key, value] of Object.entries(row)) {
            normalizedRow[key] = this.normalizeRowValue(value);
          }
          return normalizedRow;
        });

        console.log(
          `[GenerateDocumentWorkflow] Extracted ${extractedData.columns.length} columns and ${extractedData.rows.length} rows`
        );
      } catch (parseError) {
        console.error(
          '[GenerateDocumentWorkflow] Failed to parse AI response:',
          parseError
        );
        throw new Error('Failed to parse AI analysis results');
      }

      // Step 4: Generate output files
      console.log(
        '[GenerateDocumentWorkflow] Step 4: Generating output files...'
      );

      const generatedFiles: { html?: string; csv?: string; json?: string } = {};

      // Generate JSON (always available)
      generatedFiles.json = JSON.stringify(
        {
          columns: extractedData.columns,
          rows: extractedData.rows,
        },
        null,
        2
      );

      // Generate CSV if requested
      if (
        this.params.outputFormat === 'csv' ||
        this.params.outputFormat === 'html'
      ) {
        const csvContent = this.generateCSV(
          extractedData.columns,
          extractedData.rows
        );
        generatedFiles.csv = csvContent;
      }

      // Generate HTML if requested
      console.log('🔍 HTML Generation Check:', {
        outputFormat: this.params.outputFormat,
        isHtml: this.params.outputFormat === 'html',
        typeof: typeof this.params.outputFormat,
        stringified: JSON.stringify(this.params.outputFormat),
      });

      if (this.params.outputFormat === 'html') {
        const htmlContent = this.generateHTML(
          extractedData.columns,
          extractedData.rows
        );
        generatedFiles.html = htmlContent;
        console.log('✅ HTML generated, length:', htmlContent.length);
      } else {
        console.log('❌ HTML not generated - outputFormat mismatch');
      }

      const processingTime = Date.now() - startTime;

      // Step 5: Compile final results
      const finalMetadata: ExtractionMetadata = {
        totalDocuments: this.params.documents.length,
        totalRows: extractedData.rows.length,
        totalColumns: extractedData.columns.length,
        processingTime,
        extractedFrom: this.params.documents.map(
          (doc) => `Document ${doc.index}`
        ),
        ...extractedData.metadata,
      };

      console.log(
        `[GenerateDocumentWorkflow] Workflow completed successfully in ${processingTime}ms`
      );

      return {
        columns: extractedData.columns,
        rows: extractedData.rows,
        metadata: finalMetadata,
        generatedFiles,
        aiAnalysis: {
          model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
          iterations: aiResult.data?.iterations || 0,
          processingTime,
        },
        success: true,
        error: '',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('[GenerateDocumentWorkflow] Workflow failed:', error);

      return {
        columns: [],
        rows: [],
        metadata: {
          totalDocuments: this.params.documents.length,
          totalRows: 0,
          totalColumns: 0,
          processingTime,
          extractedFrom: [],
        },
        generatedFiles: {},
        aiAnalysis: {
          model: this.params.aiOptions?.model || 'google/gemini-2.5-flash',
          iterations: 0,
          processingTime,
        },
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during document generation workflow',
      };
    }
  }

  /**
   * Generate CSV content from columns and rows
   */
  private generateCSV(columns: ColumnDefinition[], rows: DataRow[]): string {
    const headers = columns.map((col) => col.name).join(',');
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col.name];
          // Escape commas and quotes in CSV
          if (
            typeof value === 'string' &&
            (value.includes(',') || value.includes('"'))
          ) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value?.toString() || '';
        })
        .join(',')
    );

    return [headers, ...csvRows].join('\n');
  }

  /**
   * Normalize column type to match schema expectations
   */
  private normalizeColumnType(
    type: unknown
  ): 'string' | 'number' | 'integer' | 'float' | 'date' | 'boolean' {
    if (typeof type === 'string') {
      const normalizedType = type.toLowerCase();
      if (['string', 'text', 'varchar'].includes(normalizedType))
        return 'string';
      if (['number', 'numeric', 'decimal'].includes(normalizedType))
        return 'number';
      if (['integer', 'int'].includes(normalizedType)) return 'integer';
      if (['float', 'double', 'real'].includes(normalizedType)) return 'float';
      if (['date', 'datetime', 'timestamp'].includes(normalizedType))
        return 'date';
      if (['boolean', 'bool'].includes(normalizedType)) return 'boolean';
    }

    // Default to string if type is unknown or invalid
    return 'string';
  }

  /**
   * Normalize row value to ensure it's a primitive type
   */
  private normalizeRowValue(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      // Convert objects to JSON string
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    // Convert anything else to string
    return String(value);
  }

  /**
   * Generate HTML table from columns and rows
   */
  private generateHTML(columns: ColumnDefinition[], rows: DataRow[]): string {
    const headers = columns
      .map((col) => `<th title="${col.description}">${col.name}</th>`)
      .join('');

    const tableRows = rows
      .map((row) => {
        const cells = columns
          .map((col) => {
            const value = row[col.name];
            const cellClass = col.type === 'number' ? 'text-right' : '';
            return `<td class="${cellClass}">${value?.toString() || ''}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Document Data</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #555;
            cursor: help;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .text-right {
            text-align: right;
        }
        .metadata {
            margin-top: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 6px;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Generated Document Data</h1>
        <table>
            <thead>
                <tr>${headers}</tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        <div class="metadata">
            <strong>Generated by Generate Document Workflow</strong> • 
            ${rows.length} rows • ${columns.length} columns • 
            ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`.trim();
  }
}
