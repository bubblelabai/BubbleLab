import { ChartJSTool } from './chart-js-tool.js';

describe('ChartJSTool', () => {
  const sampleData = [
    { month: 'Jan', sales: 100, region: 'North' },
    { month: 'Feb', sales: 150, region: 'North' },
    { month: 'Mar', sales: 120, region: 'North' },
    { month: 'Jan', sales: 80, region: 'South' },
    { month: 'Feb', sales: 110, region: 'South' },
    { month: 'Mar', sales: 90, region: 'South' },
  ];

  it('should create a basic line chart', async () => {
    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'line',
      reasoning: 'Testing basic line chart functionality',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.error).toBe('');
    expect(result.data?.chartType).toBe('line');
    expect(result.data?.chartConfig).toBeDefined();
    expect(result.data?.dataPointCount).toBe(6);
  });

  it('should create a bar chart with specified columns', async () => {
    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'bar',
      xColumn: 'month',
      yColumn: 'sales',
      reasoning: 'Testing bar chart with specified columns',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.data?.chartConfig).toBeDefined();
    expect(result.data?.metadata?.xColumn).toBe('month');
    expect(result.data?.metadata?.yColumn).toBe('sales');
  });

  it('should create a grouped chart', async () => {
    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'bar',
      xColumn: 'month',
      yColumn: 'sales',
      groupByColumn: 'region',
      reasoning: 'Testing grouped bar chart',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.data?.datasetCount).toBe(2); // North and South regions
    expect(result.data?.metadata?.groupByColumn).toBe('region');
  });

  it('should create a pie chart', async () => {
    const pieData = [
      { category: 'A', value: 30 },
      { category: 'B', value: 20 },
      { category: 'C', value: 50 },
    ];

    const tool = new ChartJSTool({
      data: pieData,
      chartType: 'pie',
      xColumn: 'category',
      yColumn: 'value',
      reasoning: 'Testing pie chart functionality',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.data?.chartType).toBe('pie');
    expect(result.data?.suggestedSize?.width).toBe(400);
    expect(result.data?.suggestedSize?.height).toBe(400); // Square for pie charts
  });

  it('should handle custom options', async () => {
    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'line',
      options: {
        title: 'Sales Over Time',
        xAxisLabel: 'Month',
        yAxisLabel: 'Sales ($)',
        colorScheme: 'viridis',
        showLegend: false,
      },
      reasoning: 'Testing custom chart options',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.data?.metadata?.colorScheme).toBe('viridis');

    const config = result.data?.chartConfig as any;
    expect(config.options?.plugins?.title?.text).toBe('Sales Over Time');
    expect(config.options?.plugins?.legend?.display).toBe(false);
  });

  it('should auto-detect columns', async () => {
    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'bar',
      reasoning: 'Testing automatic column detection',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);
    expect(result.data?.metadata?.xColumn).toBeDefined();
    expect(result.data?.metadata?.yColumn).toBe('sales'); // Should detect numeric column
  });

  it('should handle scatter plot data', async () => {
    const scatterData = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
    ];

    const tool = new ChartJSTool({
      data: scatterData,
      chartType: 'scatter',
      xColumn: 'x',
      yColumn: 'y',
      reasoning: 'Testing scatter plot functionality',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);

    const config = result.data?.chartConfig as any;
    expect(config.data?.datasets?.[0]?.data).toBeDefined();
    expect(Array.isArray(config.data.datasets[0].data)).toBe(true);
    expect(config.data.datasets[0].data[0]).toHaveProperty('x');
    expect(config.data.datasets[0].data[0]).toHaveProperty('y');
  });

  it('should handle advanced configuration', async () => {
    const advancedConfig = {
      data: {
        labels: ['Custom', 'Labels'],
        datasets: [
          {
            label: 'Custom Dataset',
            data: [10, 20],
            backgroundColor: 'red',
          },
        ],
      },
      options: {
        responsive: false,
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    };

    const tool = new ChartJSTool({
      data: sampleData,
      chartType: 'bar',
      advancedConfig,
      reasoning: 'Testing advanced configuration override',
    });

    const result = await tool.action();

    expect(result.success).toBe(true);

    const config = result.data?.chartConfig as any;
    expect(config.type).toBe('bar');
    expect(config.data?.labels).toEqual(['Custom', 'Labels']);
    expect(config.options?.responsive).toBe(false);
  });

  it('should suggest appropriate sizes for different chart types', async () => {
    // Test line chart size
    const lineTool = new ChartJSTool({
      data: sampleData,
      chartType: 'line',
      reasoning: 'Testing size suggestion for line chart',
    });
    const lineResult = await lineTool.action();
    expect(lineResult.data?.suggestedSize?.width).toBe(400);
    expect(lineResult.data?.suggestedSize?.height).toBe(300);

    // Test pie chart size (should be square)
    const pieTool = new ChartJSTool({
      data: sampleData.slice(0, 3),
      chartType: 'pie',
      reasoning: 'Testing size suggestion for pie chart',
    });
    const pieResult = await pieTool.action();
    expect(pieResult.data?.suggestedSize?.width).toBe(400);
    expect(pieResult.data?.suggestedSize?.height).toBe(400);

    // Test radar chart size (should be square)
    const radarTool = new ChartJSTool({
      data: sampleData.slice(0, 3),
      chartType: 'radar',
      reasoning: 'Testing size suggestion for radar chart',
    });
    const radarResult = await radarTool.action();
    expect(radarResult.data?.suggestedSize?.width).toBe(450);
    expect(radarResult.data?.suggestedSize?.height).toBe(450);
  });
});
