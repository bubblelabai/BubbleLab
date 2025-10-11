import { BubbleFactory } from '@bubblelab/bubble-core';
import { BubbleParser } from './BubbleParser';
import { getFixture } from '../../tests/fixtures';
import { analyze } from '@bubblelab/ts-scope-manager';
import { parse } from '@typescript-eslint/typescript-estree';

describe('BubbleParser.parseBubblesFromAST()', () => {
  let bubbleFactory: BubbleFactory;

  beforeEach(async () => {
    bubbleFactory = new BubbleFactory();
    await bubbleFactory.registerDefaults();
  });

  it('should parse bubbles from data assistant workflow correctly', async () => {
    const bubbleScript = getFixture('data-assistant');
    // Parse the script into AST
    const ast = parse(bubbleScript, {
      range: true, // Required for scope-manager
      loc: true, // Location info for line numbers
      sourceType: 'module', // Treat as ES module
      ecmaVersion: 2022, // Modern JS/TS features
    });

    // Analyze scope to build variable dependency graph
    const scopeManager = analyze(ast, {
      sourceType: 'module',
    });

    // Parse bubble dependencies from AST using the provided factory and scope manager
    const bubbleParser = new BubbleParser(bubbleScript);
    const parseResult = bubbleParser.parseBubblesFromAST(
      bubbleFactory,
      ast,
      scopeManager
    );

    //Find the depndecies detail of slack-data-assistant in the bubble factory
    const slackDataAssistantDependencies =
      bubbleFactory.getDetailedDependencies('slack-data-assistant');

    // Find slack data assistant by id
    const slackDataAssistant = Object.values(parseResult.bubbles).find(
      (bubble) => bubble.bubbleName === 'slack-data-assistant'
    );
    const dependencyGraph = slackDataAssistant?.dependencyGraph;

    // Determine expected slack instance count from factory detailed deps
    const slackSpec = slackDataAssistantDependencies?.find(
      (d) => (d as any).name === 'slack'
    ) as any;
    const expectedSlackInstances = Array.isArray(slackSpec?.instances)
      ? slackSpec.instances.length
      : 1;

    expect(dependencyGraph?.name).toBe('slack-data-assistant');
    const deps = dependencyGraph?.dependencies || [];
    // Slack should appear once per instance
    expect(deps.filter((d) => d.name === 'slack').length).toBe(
      expectedSlackInstances
    );
    // Database analyzer with postgres child
    const dbAnalyzer = deps.find((d) => d.name === 'database-analyzer');
    expect(dbAnalyzer).toBeDefined();
    expect(dbAnalyzer?.dependencies?.some((c) => c.name === 'postgresql')).toBe(
      true
    );
    // ai-agent and slack-formatter-agent should be present
    expect(deps.some((d) => d.name === 'ai-agent')).toBe(true);
    expect(deps.some((d) => d.name === 'slack-formatter-agent')).toBe(true);
  });

  it('should parse bubbles from research agent workflow correctly', async () => {
    // bubbleFactory = new BubbleFactory();
    // await bubbleFactory.registerDefaults();
    const bubbleScript = getFixture('research-agent');
    //Find the research-agent-tool in the bubble factory
    const researchAgentTool = bubbleFactory.getMetadata('research-agent-tool');
    console.log(
      'Research agent tool in bubble factory:',
      researchAgentTool?.bubbleDependenciesDetailed
    );

    // Parse the script into AST
    const ast = parse(bubbleScript, {
      range: true, // Required for scope-manager
      loc: true, // Location info for line numbers
      sourceType: 'module', // Treat as ES module
      ecmaVersion: 2022, // Modern JS/TS features
    });

    // Analyze scope to build variable dependency graph
    const scopeManager = analyze(ast, {
      sourceType: 'module',
    });

    // Parse bubble dependencies from AST using the provided factory and scope manager
    const bubbleParser = new BubbleParser(bubbleScript);
    const parseResult = bubbleParser.parseBubblesFromAST(
      bubbleFactory,
      ast,
      scopeManager
    );

    // print out detail about research-agent-tool in bubble factory
    const researchAgentMetadata = bubbleFactory.getMetadata(
      'research-agent-tool'
    );
    console.log(
      'Research agent in bubble factory:',
      researchAgentMetadata?.bubbleDependenciesDetailed
    );
    // Find research agent by id
    const researchAgent = Object.values(parseResult.bubbles).find(
      (bubble) => bubble.variableName === 'aiwithresearchagentAsTool'
    );
    const dependencyGraph = researchAgent?.dependencyGraph;

    // Check that the dependency graph has the correct uniqueId structure
    expect(dependencyGraph?.uniqueId).toBeDefined();
    const uniqueId = parseInt(dependencyGraph?.uniqueId || '0');
    expect(dependencyGraph?.variableId).toBe(uniqueId);
    expect(dependencyGraph?.name).toBe('ai-agent');

    // Check the research-agent-tool dependency
    const researchAgentToolDep = dependencyGraph?.dependencies?.[0];
    expect(researchAgentToolDep?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1`
    );
    expect(researchAgentToolDep?.variableId).toBeDefined();
    expect(researchAgentToolDep?.name).toBe('research-agent-tool');

    // Check the nested ai-agent dependency
    const nestedAiAgentDep = researchAgentToolDep?.dependencies?.[0];
    expect(nestedAiAgentDep?.name).toBe('ai-agent');

    // ai agent has uniqueId and variableId
    expect(nestedAiAgentDep?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1`
    );
    expect(nestedAiAgentDep?.variableId).toBeDefined();

    // Check the tool dependencies have correct uniqueIds
    const tools = nestedAiAgentDep?.dependencies;
    expect(tools?.find((t) => t.name === 'web-search-tool')?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.web-search-tool#1`
    );
    expect(tools?.find((t) => t.name === 'web-scrape-tool')?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.web-scrape-tool#1`
    );
    expect(tools?.find((t) => t.name === 'web-crawl-tool')?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.web-crawl-tool#1`
    );
    expect(tools?.find((t) => t.name === 'web-extract-tool')?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.web-extract-tool#1`
    );
    expect(tools?.find((t) => t.name === 'reddit-scrape-tool')?.uniqueId).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.reddit-scrape-tool#1`
    );

    // web crawl has ai-agent as a dependency
    const webCrawlDep = tools?.find((t) => t.name === 'web-crawl-tool');

    expect(
      webCrawlDep?.dependencies?.find((d) => d.name === 'ai-agent')?.uniqueId
    ).toBe(
      `${uniqueId}.research-agent-tool#1.ai-agent#1.web-crawl-tool#1.ai-agent#1`
    );
  });
});
