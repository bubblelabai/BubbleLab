import { BubbleClassWithMetadata, BubbleFactory } from './bubble-factory.js';
import { AIAgentBubble } from './bubbles/service-bubble/ai-agent.js';
import { ListBubblesTool } from './bubbles/tool-bubble/list-bubbles-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

let defaultFactory: BubbleFactory;
beforeAll(async () => {
  // Create a factory instance for testing
  defaultFactory = new BubbleFactory();
  await defaultFactory.registerDefaults();
});

describe('Factory Pattern Integration', () => {
  test('slack-data-assistant should have slack-formatter-agent as a dependency', () => {
    const metadata = defaultFactory.getMetadata('slack-data-assistant');
    // Expect ai agent and slack to be dependencies
    expect(metadata?.bubbleDependencies).toContain('ai-agent');
    expect(metadata?.bubbleDependencies).toContain('slack');
    expect(metadata?.bubbleDependencies).toContain('database-analyzer');
    expect(metadata?.bubbleDependencies).toContain('slack-formatter-agent');
  });

  test('AI agent should be able to use tool bubbles', async () => {
    // Create AI agent with factory
    const aiAgent = new AIAgentBubble({
      message: 'Test',
      tools: [{ name: 'list-bubbles-tool' }],
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: 'test-key',
      },
    });

    // Initialize tools
    const initMethod = (aiAgent as any).initializeTools.bind(aiAgent);
    const tools = await initMethod(aiAgent.currentParams.tools);

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('list-bubbles-tool');
  });

  test('Factory should create bubble instances correctly', () => {
    // Create bubbles using factory
    const listTool = defaultFactory.createBubble('list-bubbles-tool', {});
    expect(listTool).toBeInstanceOf(ListBubblesTool);

    const aiAgent = defaultFactory.createBubble('ai-agent', {
      message: 'Hello',
    });
    expect(aiAgent).toBeInstanceOf(AIAgentBubble);
  });

  test('Custom factory should work for testing', () => {
    // Create custom factory
    const customFactory = new BubbleFactory();

    // Should start empty
    expect(customFactory.list()).toHaveLength(0);

    // Register a bubble
    customFactory.register(
      'ai-agent',
      AIAgentBubble as BubbleClassWithMetadata
    );

    // Should now have one bubble
    expect(customFactory.list()).toHaveLength(1);
    expect(customFactory.get('ai-agent')).toBe(AIAgentBubble);
  });

  test('Factory should get all detailed dependcies for every bubble', () => {
    const bubbles = defaultFactory.list();
    for (const bubble of bubbles) {
      const dependencies = defaultFactory.getDetailedDependencies(bubble);
      expect(dependencies).toBeDefined();
    }
  });

  test('proper detailed dependencies test', () => {
    // Create bubbles using factory
    const dependencies = defaultFactory.getDetailedDependencies('ai-agent');
    expect(dependencies).toBeDefined();
    expect(dependencies).toHaveLength(0);

    const slackDataAssistantDependencies =
      defaultFactory.getDetailedDependencies('slack-data-assistant');

    // At least 3 instances of slack exists
    const slack = slackDataAssistantDependencies.find(
      (d) => d.name === 'slack'
    );
    expect(slack).toBeDefined();
    expect(slack?.instances).toHaveLength(4);

    const researchAgentDependencies = defaultFactory.getDetailedDependencies(
      'research-agent-tool'
    );

    // At least 3 instances of slack exists
    const researchAgent = researchAgentDependencies.find(
      (d) => d.name === 'ai-agent'
    );
    expect(researchAgent).toBeDefined();
    console.log(JSON.stringify(researchAgent, null, 2));
    expect(researchAgent?.tools?.length).toBeGreaterThan(3);
  });
});
