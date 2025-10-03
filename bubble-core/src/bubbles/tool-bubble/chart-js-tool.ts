import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import * as fs from 'fs/promises';
import * as path from 'path';

// Define supported chart types
const ChartType = z.enum([
  'line',
  'bar',
  'pie',
  'doughnut',
  'radar',
  'scatter',
  'bubble',
  'polarArea',
]);

// Define color schemes
const ColorScheme = z.enum([
  'default',
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'blues',
  'greens',
  'reds',
  'oranges',
  'categorical',
]);

// Define chart options for common customizations
const ChartOptionsSchema = z.object({
  title: z.string().optional().describe('Chart title'),
  xAxisLabel: z.string().optional().describe('X-axis label'),
  yAxisLabel: z.string().optional().describe('Y-axis label'),
  colorScheme: ColorScheme.default('default').describe(
    'Color scheme for the chart'
  ),
  responsive: z.boolean().default(true).describe('Make chart responsive'),
  maintainAspectRatio: z
    .boolean()
    .default(true)
    .describe('Maintain aspect ratio'),
  showLegend: z.boolean().default(true).describe('Show chart legend'),
  showTooltips: z.boolean().default(true).describe('Show tooltips on hover'),
});

// Define the parameters schema
const ChartJSToolParamsSchema = z.object({
  data: z
    .array(z.record(z.unknown()))
    .min(1, 'Data array cannot be empty')
    .describe('Array of data objects (typically from SQL query results)'),

  chartType: ChartType.describe('Type of chart to generate'),

  xColumn: z
    .string()
    .optional()
    .describe('Column name to use for X-axis (auto-detected if not provided)'),

  yColumn: z
    .string()
    .optional()
    .describe('Column name to use for Y-axis (auto-detected if not provided)'),

  groupByColumn: z
    .string()
    .optional()
    .describe('Column to group data by for multiple series'),

  options: ChartOptionsSchema.optional().describe(
    'Chart customization options'
  ),

  advancedConfig: z
    .record(z.unknown())
    .optional()
    .describe(
      'Advanced Chart.js configuration object (overrides simple options)'
    ),

  reasoning: z
    .string()
    .describe('Explain why this chart type and configuration was chosen'),

  generateFile: z
    .boolean()
    .default(false)
    .describe('Generate an actual chart image file (PNG format)'),

  filePath: z
    .string()
    .optional()
    .describe(
      'Custom file path for generated chart (defaults to temp directory)'
    ),

  fileName: z
    .string()
    .optional()
    .describe(
      'Custom file name for generated chart (defaults to auto-generated name)'
    ),

  width: z
    .number()
    .optional()
    .default(800)
    .describe('Chart width in pixels (default: 800)'),

  height: z
    .number()
    .optional()
    .default(600)
    .describe('Chart height in pixels (default: 600)'),

  // Hidden from AI agents - injected at runtime
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Credentials (HIDDEN from AI - injected at runtime)'),

  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Configuration for the tool bubble (HIDDEN from AI - injected at runtime)'
    ),
});

// Type definitions
type ChartJSToolParamsInput = z.input<typeof ChartJSToolParamsSchema>;
type ChartJSToolParams = z.output<typeof ChartJSToolParamsSchema>;
type ChartJSToolResult = z.output<typeof ChartJSToolResultSchema>;

// Result schema
const ChartJSToolResultSchema = z.object({
  chartConfig: z
    .record(z.unknown())
    .describe('Complete Chart.js configuration object'),
  chartType: z.string().describe('Chart type that was generated'),
  datasetCount: z.number().describe('Number of datasets in the chart'),
  dataPointCount: z.number().describe('Total number of data points'),
  suggestedSize: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .describe('Suggested canvas size for the chart'),
  metadata: z
    .object({
      xColumn: z.string().optional(),
      yColumn: z.string().optional(),
      groupByColumn: z.string().optional(),
      colorScheme: z.string(),
      generatedAt: z.string(),
    })
    .describe('Metadata about chart generation'),
  filePath: z
    .string()
    .optional()
    .describe('Path to generated chart file (if generateFile was true)'),
  fileExists: z
    .boolean()
    .optional()
    .describe('Whether the generated file exists on disk'),
  fileSize: z.number().optional().describe('Size of generated file in bytes'),

  // Standard result fields
  success: z.boolean(),
  error: z.string(),
});

/**
 * ChartJSTool - Generate Chart.js configurations from data
 *
 * This tool bubble converts data (typically from SQL queries) into Chart.js
 * configuration objects that can be used to render interactive charts.
 */
export class ChartJSTool extends ToolBubble<
  ChartJSToolParams,
  ChartJSToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'chart-js-tool';
  static readonly schema = ChartJSToolParamsSchema;
  static readonly resultSchema = ChartJSToolResultSchema;
  static readonly shortDescription =
    'Generate Chart.js configurations from data for interactive visualizations';
  static readonly longDescription = `
    A tool bubble that converts data into Chart.js configuration objects for creating
    interactive charts and visualizations.
    
    Features:
    - Support for multiple chart types (line, bar, pie, scatter, etc.)
    - Automatic data column detection and mapping
    - Smart color scheme selection
    - Responsive chart configurations
    - Support for grouped data and multiple series
    - Advanced customization through Chart.js config
    
    Chart Types:
    - Line charts: Time series, trends, continuous data
    - Bar charts: Categorical comparisons, counts
    - Pie/Doughnut: Parts of a whole, percentages
    - Scatter: Correlation analysis, x-y relationships
    - Radar: Multi-dimensional comparisons
    - Bubble: Three-dimensional data visualization
    
    Use cases:
    - Converting SQL query results into visual charts
    - Creating dashboards and reports
    - Data analysis and presentation
    - Interactive data exploration
  `;
  static readonly alias = 'chart';

  constructor(params: ChartJSToolParamsInput, context?: BubbleContext) {
    super(params, context);
  }

  async performAction(context?: BubbleContext): Promise<ChartJSToolResult> {
    void context;

    try {
      console.debug(
        `\n📊 [ChartJSTool] Generating ${this.params.chartType} chart...`
      );
      console.debug(`💭 [ChartJSTool] Reasoning: ${this.params.reasoning}`);
      console.debug(
        `📝 [ChartJSTool] Data points: ${this.params.data?.length}`
      );

      const {
        data,
        chartType,
        xColumn,
        yColumn,
        groupByColumn,
        options,
        advancedConfig,
      } = this.params;

      // Auto-detect columns if not provided
      const detectedColumns = this.detectColumns(data, xColumn, yColumn);
      const finalXColumn = xColumn || detectedColumns.xColumn;
      const finalYColumn = yColumn || detectedColumns.yColumn;

      if (!finalYColumn) {
        throw new Error(
          'Could not detect Y-axis column. Please specify yColumn parameter.'
        );
      }

      // Generate chart configuration
      const chartConfig = await this.generateChartConfig(
        data,
        chartType,
        finalXColumn,
        finalYColumn,
        groupByColumn,
        options,
        advancedConfig
      );

      // Calculate metadata
      const configData = chartConfig.data as
        | { datasets?: unknown[] }
        | undefined;
      const datasetCount = Array.isArray(configData?.datasets)
        ? configData.datasets.length
        : 1;

      const dataPointCount = this.calculateDataPointCount(chartConfig);
      const suggestedSize = this.getSuggestedSize(chartType, dataPointCount);

      // Generate file if requested
      let filePath: string | undefined;
      let fileExists: boolean | undefined;
      let fileSize: number | undefined;

      if (this.params.generateFile) {
        const parsedParams = ChartJSToolParamsSchema.parse(this.params);
        const dimensions = {
          width: parsedParams.width,
          height: parsedParams.height,
        };
        const fileResult = await this.generateChartFile(
          chartConfig,
          dimensions
        );
        filePath = fileResult.filePath;
        fileExists = fileResult.fileExists;
        fileSize = fileResult.fileSize;
      }

      console.log(`✅ [ChartJSTool] Chart generated successfully:`);
      console.log(`📈 [ChartJSTool] Type: ${chartType}`);
      console.log(`📊 [ChartJSTool] Datasets: ${datasetCount}`);
      console.log(`📍 [ChartJSTool] Data points: ${dataPointCount}`);
      if (filePath) {
        console.log(
          `💾 [ChartJSTool] File: ${filePath} (${fileSize} bytes, exists: ${fileExists})`
        );
      }

      return {
        chartConfig,
        chartType,
        datasetCount,
        dataPointCount,
        suggestedSize,
        metadata: {
          xColumn: finalXColumn,
          yColumn: finalYColumn,
          groupByColumn,
          colorScheme: options?.colorScheme || 'default',
          generatedAt: new Date().toISOString(),
        },
        filePath,
        fileExists,
        fileSize,
        success: true,
        error: '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.log(`❌ [ChartJSTool] Chart generation failed: ${errorMessage}`);

      return {
        chartConfig: {},
        chartType: this.params.chartType,
        datasetCount: 0,
        dataPointCount: 0,
        suggestedSize: { width: 400, height: 300 },
        metadata: {
          colorScheme: 'default',
          generatedAt: new Date().toISOString(),
        },
        filePath: undefined,
        fileExists: false,
        fileSize: undefined,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Auto-detect appropriate columns for X and Y axes
   */
  private detectColumns(
    data: Record<string, unknown>[],
    xColumn?: string,
    yColumn?: string
  ): { xColumn?: string; yColumn?: string } {
    if (!data.length) return {};

    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    // If both are provided, return them
    if (xColumn && yColumn) {
      return { xColumn, yColumn };
    }

    // Detect numeric columns for Y-axis
    const numericColumns = columns.filter((col) => {
      const values = data.slice(0, 10).map((row) => row[col]);
      return values.every(
        (val) =>
          val !== null &&
          val !== undefined &&
          (typeof val === 'number' || !isNaN(Number(val)))
      );
    });

    // Detect categorical/date columns for X-axis
    const categoricalColumns = columns.filter(
      (col) => !numericColumns.includes(col)
    );

    return {
      xColumn: xColumn || categoricalColumns[0],
      yColumn: yColumn || numericColumns[0],
    };
  }

  /**
   * Generate complete Chart.js configuration
   */
  private async generateChartConfig(
    data: Record<string, unknown>[],
    chartType: string,
    xColumn?: string,
    yColumn?: string,
    groupByColumn?: string,
    options?: z.infer<typeof ChartOptionsSchema>,
    advancedConfig?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // If advanced config is provided, use it as base
    if (advancedConfig) {
      return {
        type: chartType,
        ...advancedConfig,
      };
    }

    // Generate basic configuration
    const chartData = this.prepareChartData(
      data,
      chartType,
      xColumn,
      yColumn,
      groupByColumn,
      options
    );
    const chartOptions = this.generateChartOptions(options);

    const config = {
      type: chartType,
      data: chartData,
      options: chartOptions,
    };

    return config;
  }

  /**
   * Prepare data in Chart.js format
   */
  private prepareChartData(
    data: Record<string, unknown>[],
    chartType: string,
    xColumn: string | undefined,
    yColumn: string | undefined,
    groupByColumn: string | undefined,
    options?: z.infer<typeof ChartOptionsSchema>
  ): Record<string, unknown> {
    const colors = this.getColorPalette(options?.colorScheme || 'default');

    if (groupByColumn) {
      return this.prepareGroupedData(
        data,
        chartType,
        xColumn,
        yColumn,
        groupByColumn,
        colors
      );
    } else {
      return this.prepareSingleSeriesData(
        data,
        chartType,
        xColumn,
        yColumn,
        colors
      );
    }
  }

  /**
   * Prepare single series data
   */
  private prepareSingleSeriesData(
    data: Record<string, unknown>[],
    chartType: string,
    xColumn: string | undefined,
    yColumn: string | undefined,
    colors: string[]
  ): Record<string, unknown> {
    const labels = xColumn ? data.map((row) => String(row[xColumn])) : [];
    const values = yColumn ? data.map((row) => Number(row[yColumn])) : [];

    // For pie/doughnut charts, use categories as labels
    if (chartType === 'pie' || chartType === 'doughnut') {
      return {
        labels: labels.length ? labels : values.map((_, i) => `Item ${i + 1}`),
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: colors.map((c) => c.replace('0.8', '1')),
            borderWidth: 1,
          },
        ],
      };
    }

    // For scatter/bubble charts
    if (chartType === 'scatter' || chartType === 'bubble') {
      const scatterData = data.map((row, i) => ({
        x: xColumn ? Number(row[xColumn]) : i,
        y: yColumn ? Number(row[yColumn]) : 0,
        ...(chartType === 'bubble' && { r: 5 }), // Default bubble radius
      }));

      return {
        datasets: [
          {
            label: yColumn || 'Data',
            data: scatterData,
            backgroundColor: colors[0],
            borderColor: colors[0].replace('0.8', '1'),
          },
        ],
      };
    }

    // For line/bar charts
    return {
      labels: labels.length ? labels : data.map((_, i) => `Point ${i + 1}`),
      datasets: [
        {
          label: yColumn || 'Data',
          data: values,
          backgroundColor: colors[0],
          borderColor: colors[0].replace('0.8', '1'),
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line' ? false : true,
        },
      ],
    };
  }

  /**
   * Prepare grouped data (multiple series)
   */
  private prepareGroupedData(
    data: Record<string, unknown>[],
    chartType: string,
    xColumn: string | undefined,
    yColumn: string | undefined,
    groupByColumn: string,
    colors: string[]
  ): Record<string, unknown> {
    // Group data by groupByColumn
    const groups = new Map<string, Record<string, unknown>[]>();

    data.forEach((row) => {
      const groupKey = String(row[groupByColumn]);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(row);
    });

    const labels = xColumn
      ? [...new Set(data.map((row) => String(row[xColumn])))]
      : [];
    const datasets = Array.from(groups.entries()).map(
      ([groupName, groupData], index) => {
        const values = yColumn
          ? groupData.map((row) => Number(row[yColumn]))
          : [];
        const color = colors[index % colors.length];

        return {
          label: groupName,
          data: values,
          backgroundColor: color,
          borderColor: color.replace('0.8', '1'),
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line' ? false : true,
        };
      }
    );

    return {
      labels: labels.length ? labels : [],
      datasets,
    };
  }

  /**
   * Generate Chart.js options
   */
  private generateChartOptions(
    options?: z.infer<typeof ChartOptionsSchema>
  ): Record<string, unknown> {
    const chartOptions: Record<string, unknown> = {
      responsive: options?.responsive ?? true,
      maintainAspectRatio: options?.maintainAspectRatio ?? true,
    };

    if (options?.title) {
      chartOptions.plugins = {
        title: {
          display: true,
          text: options.title,
        },
        legend: {
          display: options.showLegend ?? true,
        },
        tooltip: {
          enabled: options.showTooltips ?? true,
        },
      };
    }

    if (options?.xAxisLabel || options?.yAxisLabel) {
      chartOptions.scales = {
        x: {
          display: true,
          title: {
            display: !!options?.xAxisLabel,
            text: options?.xAxisLabel || '',
          },
        },
        y: {
          display: true,
          title: {
            display: !!options?.yAxisLabel,
            text: options?.yAxisLabel || '',
          },
        },
      };
    }

    return chartOptions;
  }

  /**
   * Get color palette based on scheme
   */
  private getColorPalette(scheme: string): string[] {
    const palettes = {
      default: [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(255, 205, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
      ],
      viridis: [
        'rgba(68, 1, 84, 0.8)',
        'rgba(59, 82, 139, 0.8)',
        'rgba(33, 145, 140, 0.8)',
        'rgba(94, 201, 98, 0.8)',
        'rgba(253, 231, 37, 0.8)',
      ],
      blues: [
        'rgba(8, 48, 107, 0.8)',
        'rgba(8, 81, 156, 0.8)',
        'rgba(33, 113, 181, 0.8)',
        'rgba(66, 146, 198, 0.8)',
        'rgba(107, 174, 214, 0.8)',
        'rgba(158, 202, 225, 0.8)',
      ],
      categorical: [
        'rgba(31, 119, 180, 0.8)',
        'rgba(255, 127, 14, 0.8)',
        'rgba(44, 160, 44, 0.8)',
        'rgba(214, 39, 40, 0.8)',
        'rgba(148, 103, 189, 0.8)',
        'rgba(140, 86, 75, 0.8)',
        'rgba(227, 119, 194, 0.8)',
        'rgba(127, 127, 127, 0.8)',
        'rgba(188, 189, 34, 0.8)',
        'rgba(23, 190, 207, 0.8)',
      ],
    };

    return palettes[scheme as keyof typeof palettes] || palettes.default;
  }

  /**
   * Calculate total data point count
   */
  private calculateDataPointCount(
    chartConfig: Record<string, unknown>
  ): number {
    const data = chartConfig.data as { datasets?: Array<{ data?: unknown[] }> };
    if (!data?.datasets) return 0;

    return data.datasets.reduce((total: number, dataset) => {
      return total + (Array.isArray(dataset.data) ? dataset.data.length : 0);
    }, 0);
  }

  /**
   * Get suggested canvas size based on chart type and data
   */
  private getSuggestedSize(
    chartType: string,
    dataPointCount: number
  ): { width: number; height: number } {
    const baseSize = { width: 400, height: 300 };

    // Adjust for chart type
    if (
      chartType === 'pie' ||
      chartType === 'doughnut' ||
      chartType === 'polarArea'
    ) {
      return { width: 400, height: 400 }; // Square for circular charts
    }

    if (chartType === 'radar') {
      return { width: 450, height: 450 }; // Square for radar charts
    }

    // Adjust for data density
    if (dataPointCount > 50) {
      return { width: 600, height: 400 };
    }

    return baseSize;
  }

  /**
   * Generate actual chart file using chartjs-node-canvas
   */
  private async generateChartFile(
    chartConfig: Record<string, unknown>,
    dimensions: { width: number; height: number }
  ): Promise<{ filePath: string; fileExists: boolean; fileSize: number }> {
    const { width, height } = dimensions;

    // Create chartjs-node-canvas instance
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'white',
    });

    try {
      // Generate the chart buffer
      console.log(
        `🎨 [ChartJSTool] Rendering chart to buffer (${width}x${height})...`
      );
      const buffer = await chartJSNodeCanvas.renderToBuffer(chartConfig as any);

      // Determine file path
      const outputDir = this.params.filePath || '/tmp/charts';
      const fileName =
        this.params.fileName ||
        `chart-${this.params.chartType}-${Date.now()}.png`;
      const fullPath = path.join(outputDir, fileName);

      // Ensure directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, buffer);

      // Verify file exists and get size
      const stats = await fs.stat(fullPath);

      console.log(`💾 [ChartJSTool] Chart file generated: ${fullPath}`);

      return {
        filePath: fullPath,
        fileExists: true,
        fileSize: stats.size,
      };
    } catch (error) {
      console.error(`❌ [ChartJSTool] File generation failed:`, error);
      throw new Error(
        `Chart file generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
