import { describe, test, expect } from 'vitest';
import {
  extractAndCleanJSON,
  postProcessJSON,
  parseJsonWithFallbacks,
} from './json-parsing.js';

describe('JSON Parsing Utilities', () => {
  describe('postProcessJSON', () => {
    test('should fix trailing commas', () => {
      const input = '{"items": ["a", "b",], "count": 2,}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ items: ['a', 'b'], count: 2 });
    });

    test('should fix unquoted keys', () => {
      const input = '{name: "test", value: 42}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
    });

    test('should balance missing braces', () => {
      const input = '{"items": [{"name": "test"}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ items: [{ name: 'test' }] });
    });

    test('should remove excess closing braces', () => {
      const input = '{"data": "test"}}}';
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ data: 'test' });
    });

    test('FIXED: should handle unescaped quotes in string values', () => {
      // This was the failing case from the user's example - now fixed!
      const input = `{
  "isFrustrated": true,
  "outreachMessage": "Hey [Author"s Reddit Username],\\n\\nYour post about building that Voice AI system is a masterclass in perseverance..."
}`;

      const result = postProcessJSON(input);
      const parsed = JSON.parse(result);
      expect(parsed.isFrustrated).toBe(true);
      // The quote should be properly handled so the parsing succeeds
      expect(parsed.outreachMessage).toContain(
        'Hey [Author"s Reddit Username]'
      );
    });

    test('FIXED: should handle complex real-world AI response', () => {
      // This was the actual response that was failing - now fixed!
      const input = `{
  "isFrustrated": true,
  "outreachMessage": "Hey [Author"s Reddit Username],\\n\\nYour post about building that Voice AI system is a masterclass in perseverance – truly impressive to see the journey from a simple concept to a system booking calls daily! I particularly empathized with the part where your initial \\"Google Sheet + n8n hack\\" eventually \\"stopped working\\" as client needs grew. The description of that transition, taking \\"months\\" to rebuild into a full web app and dealing with all the \\"Dante"s story\\" edge cases, really highlights the pain of outgrowing an initial solution.\\n\\nIt sounds like you put an incredible amount of effort into building a robust, scalable backend to handle the complexity that n8n couldn"t, like proper follow-ups, compliance, and DNC handling. We"re building BubbleLab (bubblelab.ai) with exactly these kinds of scaling challenges in mind. Our goal is to provide a platform where you can build sophisticated AI agents and workflows that evolve with your needs, without having to completely scrap and rebuild your core infrastructure when complexity increases. We aim to help avoid those \\"months\\" of painful transitions you described.\\n\\nNo pressure at all, but if you"re ever exploring tools that offer more inherent flexibility and power to handle those intricate requirements and edge cases from the start, it might be worth a glance.\\n\\nEither way, thanks for sharing such an honest and detailed account of your journey – it"s incredibly insightful!"
}`;

      const result = postProcessJSON(input);
      const parsed = JSON.parse(result);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toBeDefined();
      // The quote should be properly handled so the parsing succeeds
      expect(parsed.outreachMessage).toContain(
        'Hey [Author"s Reddit Username]'
      );
    });
  });

  describe('extractAndCleanJSON', () => {
    test('should extract JSON from markdown code blocks', () => {
      const input = '```json\n{"result": "success"}\n```';
      const result = extractAndCleanJSON(input);
      expect(result).toBe('{"result": "success"}');
      expect(JSON.parse(result!)).toEqual({ result: 'success' });
    });

    test('should extract JSON from explanatory text', () => {
      const input =
        'I will help you with that. Here is the result: {"data": "test", "status": "ok"}';
      const result = extractAndCleanJSON(input);
      expect(result).toBe('{"data": "test", "status": "ok"}');
      expect(JSON.parse(result!)).toEqual({ data: 'test', status: 'ok' });
    });

    test('should return null for non-JSON content', () => {
      const input = 'This is just plain text with no JSON structure at all.';
      const result = extractAndCleanJSON(input);
      expect(result).toBeNull();
    });
  });

  describe('parseJsonWithFallbacks', () => {
    test('should handle valid JSON', () => {
      const input = '{"result": "success"}';
      const result = parseJsonWithFallbacks(input);

      expect(result.error).toBeUndefined();
      expect(JSON.parse(result.response)).toEqual({ result: 'success' });
    });

    test('should fix malformed JSON with trailing commas', () => {
      const input = '{"result": "success", "items": ["a", "b",]}';
      const result = parseJsonWithFallbacks(input);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.result).toBe('success');
      expect(parsed.items).toEqual(['a', 'b']);
    });

    test('should return error for completely invalid JSON', () => {
      const input = 'This is just plain text with no JSON at all.';
      const result = parseJsonWithFallbacks(input);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('failed to generate valid JSON');
    });

    test('FIXED: should handle real-world AI agent response with unescaped quotes', () => {
      // This was the exact response that was causing the issue - now fixed!
      const input = `{
  "isFrustrated": true,
  "outreachMessage": "Hey [Author"s Reddit Username],\\n\\nYour post about building that Voice AI system is a masterclass in perseverance – truly impressive to see the journey from a simple concept to a system booking calls daily! I particularly empathized with the part where your initial \\"Google Sheet + n8n hack\\" eventually \\"stopped working\\" as client needs grew. The description of that transition, taking \\"months\\" to rebuild into a full web app and dealing with all the \\"Dante"s story\\" edge cases, really highlights the pain of outgrowing an initial solution.\\n\\nIt sounds like you put an incredible amount of effort into building a robust, scalable backend to handle the complexity that n8n couldn"t, like proper follow-ups, compliance, and DNC handling. We"re building BubbleLab (bubblelab.ai) with exactly these kinds of scaling challenges in mind. Our goal is to provide a platform where you can build sophisticated AI agents and workflows that evolve with your needs, without having to completely scrap and rebuild your core infrastructure when complexity increases. We aim to help avoid those \\"months\\" of painful transitions you described.\\n\\nNo pressure at all, but if you"re ever exploring tools that offer more inherent flexibility and power to handle those intricate requirements and edge cases from the start, it might be worth a glance.\\n\\nEither way, thanks for sharing such an honest and detailed account of your journey – it"s incredibly insightful!"
}`;

      const result = parseJsonWithFallbacks(input);

      // This should now succeed without an error
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain(
        'Hey [Author"s Reddit Username]'
      );
    });
  });

  describe('Real-world AI Response Patterns', () => {
    test('should handle responses with explanations before JSON', () => {
      const input = `I will help you with that request. Here's the structured response:

      {
        "analysis": "complete",
        "findings": ["result1", "result2"]
      }`;

      const result = parseJsonWithFallbacks(input);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.analysis).toBe('complete');
      expect(parsed.findings).toEqual(['result1', 'result2']);
    });

    test('should handle complex nested structures with formatting issues', () => {
      const input = `Here's the analysis:

      {
        "research": {
          "sources": [
            {"url": "https://example.com", "title": "Test"},
            {"url": "https://test.com", "title": "Example",}
          ],
          "summary": "Research complete"
        },
        "confidence": 0.95,
      }`;

      const result = parseJsonWithFallbacks(input);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.research.sources).toHaveLength(2);
      expect(parsed.confidence).toBe(0.95);
    });
  });

  describe('Edge Cases from User Example', () => {
    test('DEMO: Fixed behavior with problematic response', () => {
      // This is the exact failing case from the execution log - now working!
      const problemResponse = `{
  "isFrustrated": true,
  "outreachMessage": "Hey [Author"s Reddit Username],\\n\\nYour post about building that Voice AI system is a masterclass in perseverance – truly impressive to see the journey from a simple concept to a system booking calls daily! I particularly empathized with the part where your initial \\"Google Sheet + n8n hack\\" eventually \\"stopped working\\" as client needs grew. The description of that transition, taking \\"months\\" to rebuild into a full web app and dealing with all the \\"Dante"s story\\" edge cases, really highlights the pain of outgrowing an initial solution.\\n\\nIt sounds like you put an incredible amount of effort into building a robust, scalable backend to handle the complexity that n8n couldn"t, like proper follow-ups, compliance, and DNC handling. We"re building BubbleLab (bubblelab.ai) with exactly these kinds of scaling challenges in mind. Our goal is to provide a platform where you can build sophisticated AI agents and workflows that evolve with your needs, without having to completely scrap and rebuild your core infrastructure when complexity increases. We aim to help avoid those \\"months\\" of painful transitions you described.\\n\\nNo pressure at all, but if you"re ever exploring tools that offer more inherent flexibility and power to handle those intricate requirements and edge cases from the start, it might be worth a glance.\\n\\nEither way, thanks for sharing such an honest and detailed account of your journey – it"s incredibly insightful!"
}`;

      const result = parseJsonWithFallbacks(problemResponse);

      // Log the successful fix
      console.log('✅ Fixed result:', result);
      expect(result.error).toBeUndefined();

      // Now we can parse the fixed response
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toBeDefined();
      expect(parsed.outreachMessage).toContain(
        'Hey [Author"s Reddit Username]'
      );
    });
  });

  describe('Real Failing Cases from Terminal Output', () => {
    test('should handle JSON with markdown code blocks and trailing backslashes', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase1 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hi there,\\n\\nI came across your post about seeking an n8n partner for Kapacity Digital, and your situation really resonated. It sounds like you've built a highly successful agency and are now looking to scale your AI workflow capabilities for high-value clients, but recognize the significant time and technical investment required to get those RAG-style workflows to a truly polished, enterprise-ready state using n8n.\\n\\nIt's a common challenge for agency owners like yourself – balancing client acquisition and service with the deep technical building needed for advanced AI solutions. You want to focus on selling and servicing, not getting bogged down in the intricacies of workflow chaining and vector DB integrations to perfect every detail.\\n\\nWe're building something at BubbleLab (https://bubblelab.ai) that might be a relevant alternative to consider. Our platform is designed specifically to simplify the creation of advanced AI agents and workflows, often with significantly less technical overhead than traditional tools. We aim to help agencies like yours build sophisticated AI solutions – including complex RAG systems – much faster and more reliably, without needing to hire a full-time n8n specialist or spend countless hours on custom development.\\n\\nNo pressure at all, but if you ever find yourself exploring ways to build those high-quality, scalable AI workflows for your VC-backed clients more efficiently, I'd be happy to share how BubbleLab approaches these challenges. It might free up more of your valuable time to focus on what you do best: growing Kapacity Digital.\\n\\nBest,\\n[Your Name/BubbleLab Team]"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase1);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('Hi there,');
    });

    test('should handle JSON with unescaped quotes in complex strings', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase2 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Your post about wishing you had those built-in functions when you started working with n8n really resonated. It sounds like you spent significant time 'tinkering with code nodes,' and creating that cheat sheet is such a brilliant way to help others avoid those same hours! It's clear you're passionate about making workflows smoother.\\n\\nI couldn't help but think of BubbleLab when reading your experience. It's built specifically for complex data transformations and logic, often eliminating the need for custom code nodes entirely, which could be a different approach to handling those 'tinkering' moments you described.\\n\\nJust a thought, as it seems to tackle a very similar pain point from a different angle. Regardless, thanks for sharing your valuable resource!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase2);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('tinkering with code nodes');
    });

    test('should handle JSON with complex nested quotes and escaped content', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase3 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hi [Author's Username, if available, otherwise omit], \\n\\nI just read your post \\"13 Practical Tips to Build Better Automations in n8n\\" and wanted to say it's incredibly insightful! Your opening line about most issues coming from \\"poor design choices\\" and the goal to \\"save you hours of frustration\\" really hits home. It's clear you've put a lot of thought into solving the common pain points that arise when striving for clarity, efficiency, and sustainability in n8n workflows.\\n\\nYour tips around managing AI models efficiently, ensuring debuggability, streamlining with Switch nodes, and centralizing configurations with Config nodes are particularly astute. They highlight just how much extra effort is often needed to make complex automations reliable and maintainable, even with a powerful tool like n8n.\\n\\nAt BubbleLab (https://bubblelab.ai), we're exploring a slightly different paradigm for AI automation that aims to inherently simplify some of these design challenges. Instead of a node-based canvas for the AI orchestration itself, we focus on a more structured, prompt-centric approach. Our goal is to reduce the need for many of the workarounds and complex flow designs you've expertly addressed, making it easier to achieve clarity, predictability, and efficiency from the start.\\n\\nGiven your deep understanding of these frustrations and your commitment to better automation practices, I thought you might find our approach interesting as an alternative perspective on tackling these very same problems. No pressure at all, but perhaps it could offer a new way to achieve that desired clarity and sustainability with less initial setup complexity.\\n\\nThanks for sharing your valuable knowledge!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase3);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('13 Practical Tips');
    });

    test('should handle JSON with hosting-related content and complex quotes', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase4 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hey there! I totally get where you're coming from with the 'Hosting Rabbit Hole' – it's incredibly common to get bogged down in infrastructure, domains, SSLs, and cloud decisions when all you really want to do is build workflows. It sounds like you've put in a ton of effort trying to set up a robust, long-term solution for n8n and your other services, only to find yourself deep in architectural choices before even starting on the actual work. That feeling of being 'just at the beginning' when you thought you'd be building workflows is a tough one.\\n\\nMany people face this exact challenge, especially when trying to balance professionalism, cost, and ease of use without spending a fortune. If you're looking for a way to cut through some of that infrastructure complexity and get straight to building your automations and AI applications without the heavy lifting of managing servers, databases, and deployments, you might find BubbleLab (https://bubblelab.ai) interesting.\\n\\nIt's designed to let you deploy tools like n8n and other services with a focus on simplicity and scalability, potentially freeing you up from the 'one ring to rule them all' quest for hosting solutions. No pressure at all, but if getting to your workflows faster and simplifying your hosting burden sounds appealing, it might be worth a quick look."
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase4);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('Hosting Rabbit Hole');
    });

    test('should handle JSON with business-related content and complex quotes', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase5 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hey there, I saw your post about building a real business with n8n and resonated with your questions. It sounds like you're really looking for practical, scalable solutions beyond just 'guru' courses, and you're wondering if n8n truly has the depth for complex, real-world business needs without becoming 'too limited.'\\n\\nIt's a common challenge to find platforms that bridge that gap between simple automation and robust business applications. If you're exploring alternatives that offer more flexibility and power for those 'real business use cases' you mentioned, you might find BubbleLab (bubblelab.ai) interesting. It's designed to help build custom, AI-powered automations and tools without hitting those 'too limited' walls.\\n\\nNo pressure at all, just thought it might be relevant given your specific search for a platform that truly enables real business growth. Wishing you the best in your search!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase5);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('real business with n8n');
    });

    test('should handle JSON with WhatsApp integration content', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase6 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hey there, I saw your post about the n8n WhatsApp trigger not firing, even after following all the tutorials and getting the test message. That sounds incredibly frustrating, especially when you've done everything by the book and ruled out hosting issues. It's tough when a core part of your automation just won't cooperate.\\n\\nI work on BubbleLab (bubblelab.ai), and sometimes people facing these kinds of integration challenges find our platform offers a more direct or simpler way to connect with APIs like WhatsApp. We aim to streamline the process for building robust automations.\\n\\nNo pressure at all, but if you ever find yourself exploring alternatives that might simplify these integrations, feel free to take a look. Either way, I hope you get that n8n trigger working soon!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase6);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('WhatsApp trigger not firing');
    });

    test('should handle JSON with Instagram scraper content', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase7 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hey there! Saw your post about building an Instagram scraper and tackling that 'messy raw data' – it sounds like you've got your hands full with the routing and discarding needed to make it reusable. That's a really common challenge, especially when you're trying to set up templates and subworkflows for broader use. It can definitely be a time sink getting all that data just right!\\n\\nIf you ever find yourself wishing for a simpler way to handle those complex data transformations and build out reusable workflows, you might find BubbleLab interesting. It's designed specifically to help streamline that kind of data prep and orchestration, so you can focus more on the scraping logic itself rather than wrestling with the data. No pressure at all, just wanted to share in case it sparks an idea for simplifying your process!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase7);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('Instagram scraper');
    });

    test('should handle JSON with pgvector database content', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase8 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hi there,\\n\\nI saw your post about the challenges you're facing updating \`pgvector\` embeddings from n8n, especially with the \`vector(1024)\` format and the n8n Postgres node's validation issues. It sounds like you've tried all the logical approaches, from direct array passing to custom Function Node workarounds, only to hit frustrating errors. That's a really common pain point when dealing with specific data types like vector arrays across different systems, and having n8n's validation reject even recommended workarounds must be incredibly frustrating.\\n\\nWe're building BubbleLab (https://bubblelab.ai), and our core focus is simplifying complex data integrations, particularly with LLMs and vector databases. We've put a lot of effort into making data type handling more flexible and intuitive, aiming to abstract away these kinds of formatting headaches you're encountering between your LLM output, n8n, and PostgreSQL. \\n\\nIt might offer a much smoother path for getting your \`[0.0016, -0.0115, ...]\` arrays into \`pgvector\` without needing intricate string conversions or battling node validations. No pressure at all, but if you're still searching for a more streamlined way to handle this, it could be worth a look.\\n\\nHope you find a solution soon, regardless!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase8);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('pgvector');
    });

    test('should handle JSON with SaaS development content', () => {
      // From terminal: [JSON Parser] Parsing attempt 1 failed: JSON Parse error: Unrecognized token '`'
      const failingCase9 = `\`\`\`json
{
  "isFrustrated": true,
  "outreachMessage": "Hey there,\\n\\nI totally get where you're coming from with the confusion around building SaaS, especially when trying to weigh options like n8n/Lovable against tools like Blink.dev. It's a complex landscape, and your question about how n8n workflows scale and integrate into enterprise for a full SaaS solution is a really insightful one – it's a common challenge many face when trying to move beyond freelance work to a full product.\\n\\nYou're right, piecing together different tools for a robust, scalable SaaS can feel like comparing apples and oranges, and often leads to more questions than answers about enterprise readiness and how to 'dumb it down' into a clear path.\\n\\nWe're building something at BubbleLab (bubblelab.ai) that might offer a different perspective on this. Our goal is to simplify the entire SaaS development process, particularly for those looking to go from idea to a scalable, enterprise-ready product without needing to stitch together multiple complex workflows or write extensive code. It's designed to handle a lot of the backend and integration challenges you're asking about, letting you focus on your core product.\\n\\nNo pressure at all, but if you're still exploring ways to build a SaaS that's truly scalable and enterprise-friendly without the integration headaches, it might be worth a quick look. Happy to chat more if you're curious, or just provide some more context on how we approach these challenges.\\n\\nEither way, hope you find the clarity you're looking for!"
}
\`\`\``;

      const result = parseJsonWithFallbacks(failingCase9);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.isFrustrated).toBe(true);
      expect(parsed.outreachMessage).toContain('building SaaS');
    });
  });

  describe('Terminal Selection Failing Case', () => {
    test('should handle JSON array with event data that failed parsing', () => {
      // This is the exact JSON array that failed parsing from the terminal selection
      const failingJsonArray = `[
  {
    "eventName": "Heavy Industries, Heavy Beats",
    "date": "October 8",
    "description": "Hosted by Nexxa.ai, a16z Speedrun, Augment Ventures, IBM. (Invite Only)"
  },
  {
    "eventName": "Mercury x a16z Speedrun Luncheon",
    "date": "October 8",
    "description": "Hosted by Mercury, a16z speedrun, IBM."
  },
  {
    "eventName": "The Collective Hoops: Founder Basketball",
    "date": "October 8",
    "description": "Hosted by The Collective, a16z speedrun, Silicon Valley Bank, Vega."
  },
  {
    "eventName": "Intro to Speedrun for Builders, Hackers and Designers",
    "date": "October 8",
    "description": "Hosted by a16z speedrun."
  },
  {
    "eventName": "Forks & Founders Dinner w/ Deel, a16z and Attivo",
    "date": "October 8",
    "description": "Hosted by Deel, Attivo, a16z, Bennie, Thatch.ai."
  },
  {
    "eventName": "People & Pancakes",
    "date": "October 8",
    "description": "Hosted by Deel, Bennie, Thatch.ai, Scrut, Greylock."
  },
  {
    "eventName": "AI in Financial Services with OpenAI's Head of Sales (former), a16z, and Elsa Capital",
    "date": "October 8",
    "description": "Hosted by Elsa Capital. (Invite Only)"
  },
  {
    "eventName": "Finance Next Gen Founders Panel with a16z",
    "date": "October 8",
    "description": "Hosted by a16z, Rillet."
  },
  {
    "eventName": "Forks & Founders Dinner w/ Deel, a16z and Attivo",
    "date": "October 8",
    "description": "Hosted by Deel, Attivo, a16z."
  },
  {
    "eventName": "Build on Open Models with AWS x Meta",
    "date": "October 8",
    "description": "Hosted by AWS, Meta."
  },
  {
    "eventName": "AI Founders' Mixer - An Agentic Commerce Night",
    "date": "October 8",
    "description": "Hosted by UpScaleX, Qlay."
  }
]`;

      const result = parseJsonWithFallbacks(failingJsonArray);

      // This test should pass - the JSON array should be parsed successfully
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(11);
      expect(parsed[0].eventName).toBe('Heavy Industries, Heavy Beats');
      expect(parsed[0].date).toBe('October 8');
      expect(parsed[10].eventName).toBe(
        "AI Founders' Mixer - An Agentic Commerce Night"
      );
    });

    test('should handle JSON array with malformed content that would fail direct JSON.parse', () => {
      // This represents a case that would fail with direct JSON.parse but should work with robust parser
      // Adding some common AI-generated JSON issues: trailing commas, unescaped quotes, missing closing brace
      const malformedJsonArray = `[
  {
    "eventName": "Heavy Industries, Heavy Beats",
    "date": "October 8",
    "description": "Hosted by Nexxa.ai, a16z Speedrun, Augment Ventures, IBM. (Invite Only)",
  },
  {
    "eventName": "Mercury x a16z Speedrun Luncheon",
    "date": "October 8",
    "description": "Hosted by Mercury, a16z speedrun, IBM."
  },
  {
    "eventName": "The Collective Hoops: Founder Basketball",
    "date": "October 8",
    "description": "Hosted by The Collective, a16z speedrun, Silicon Valley Bank, Vega."
  },
  {
    "eventName": "Intro to Speedrun for Builders, Hackers and Designers",
    "date": "October 8",
    "description": "Hosted by a16z speedrun."
  },
  {
    "eventName": "Forks & Founders Dinner w/ Deel, a16z and Attivo",
    "date": "October 8",
    "description": "Hosted by Deel, Attivo, a16z, Bennie, Thatch.ai."
  },
  {
    "eventName": "People & Pancakes",
    "date": "October 8",
    "description": "Hosted by Deel, Bennie, Thatch.ai, Scrut, Greylock."
  },
  {
    "eventName": "AI in Financial Services with OpenAI's Head of Sales (former), a16z, and Elsa Capital",
    "date": "October 8",
    "description": "Hosted by Elsa Capital. (Invite Only)"
  },
  {
    "eventName": "Finance Next Gen Founders Panel with a16z",
    "date": "October 8",
    "description": "Hosted by a16z, Rillet."
  },
  {
    "eventName": "Forks & Founders Dinner w/ Deel, a16z and Attivo",
    "date": "October 8",
    "description": "Hosted by Deel, Attivo, a16z."
  },
  {
    "eventName": "Build on Open Models with AWS x Meta",
    "date": "October 8",
    "description": "Hosted by AWS, Meta."
  },
  {
    "eventName": "AI Founders' Mixer - An Agentic Commerce Night",
    "date": "October 8",
    "description": "Hosted by UpScaleX, Qlay."
  }
]`;

      // First verify that direct JSON.parse would fail due to trailing comma
      expect(() => JSON.parse(malformedJsonArray)).toThrow();

      // But our robust parser should handle it
      const result = parseJsonWithFallbacks(malformedJsonArray);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(11);
      expect(parsed[0].eventName).toBe('Heavy Industries, Heavy Beats');
      expect(parsed[0].date).toBe('October 8');
      expect(parsed[10].eventName).toBe(
        "AI Founders' Mixer - An Agentic Commerce Night"
      );
    });
  });

  describe('AI Topics JSON', () => {
    test('should handle AI topics with nested single quotes in descriptions', () => {
      const aiTopicsJson = `\`\`\`json
{
  "topics": [
    {
      "topic": "AI-powered Document Automation",
      "description": "This trend, exemplified by 'Draft AI', focuses on leveraging AI to streamline the creation of various documents, from legal contracts to everyday reports. Content can explore how AI simplifies complex writing tasks, offers templates, and responds to prompts, saving time and improving accuracy for individuals and businesses alike.",
      "relevanceScore": "High - Directly aligns with 'AI Automation' by providing practical applications for a 'general audience' in everyday document creation and management."
    },
    {
      "topic": "AI in Customer Interaction and Communication",
      "description": "Inspired by 'Slang AI', this trend highlights the use of AI to personalize and enhance customer experiences, particularly in communication channels like phone calls or online support. Content can focus on how AI improves efficiency, provides more enjoyable interactions, and automates routine queries, benefiting both businesses and their customers.",
      "relevanceScore": "High - Directly relevant to 'AI Automation' for a 'general audience' by showcasing AI's ability to improve common interactions and automate communication processes."
    },
    {
      "topic": "AI for Content Marketing and SEO Optimization",
      "description": "Drawing from various blog articles such as 'semantic keywords', 'content audits', and 'AI in marketing', this trend emphasizes how AI tools can automate and enhance content strategy, keyword research, competitor analysis, and overall SEO performance. Content can demonstrate how AI helps create more effective marketing materials and improves online visibility.",
      "relevanceScore": "High - Crucial for an 'AI Automation' product like Bubble Lab, as it addresses how AI can automate and optimize marketing efforts, appealing to a 'general audience' interested in business growth and online presence."
    },
    {
      "topic": "Measuring AI Impact and Visibility",
      "description": "Based on topics like 'AI Visibility Guide' and 'How to Measure AI Visibility Across LLM Platforms', this trend focuses on understanding and quantifying the effectiveness and reach of AI solutions. Content can explore metrics, tools, and strategies for tracking AI performance, brand mentions, and overall impact in the digital landscape.",
      "relevanceScore": "Medium - While slightly more niche, it's highly relevant for an 'AI Automation' product to articulate its value. Content can educate a 'general audience' on how to assess the success and adoption of AI technologies."
    },
    {
      "topic": "The Future of AI Automation in Business and Everyday Life",
      "description": "Inspired by 'Marketing Trends (2025)' and 'How AI is Transforming Marketing in 2025', this broader trend examines the evolving role of AI automation across various industries and in daily tasks. Content can discuss emerging applications, ethical considerations, and the transformative potential of AI for a general audience looking to understand its future impact.",
      "relevanceScore": "High - Provides a forward-looking perspective on 'AI Automation' that resonates with a 'general audience' curious about technological advancements and how AI will shape their lives and work."
    }
  ]
}
\`\`\``;

      const result = parseJsonWithFallbacks(aiTopicsJson);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.topics).toHaveLength(5);
      expect(parsed.topics[0].topic).toBe('AI-powered Document Automation');
      expect(parsed.topics[0].description).toContain("'Draft AI'");
      expect(parsed.topics[2].description).toContain("'semantic keywords'");
    });
  });

  describe('Social Media Strategy JSON', () => {
    test('should handle complex social media strategy JSON with markdown wrapper', () => {
      // This is the EXACT format from the real error message
      const socialMediaJson = `\`\`\`json
{
  "executiveSummary": "The social media landscape for young audiences is heavily dominated by video-first, short-form, and highly interactive content. Key opportunities for gymii lie in authentically adapting these visual and engaging formats to showcase the app's ease of use, social features, and ability to simplify nutrition tracking through relatable scenarios, educational content, and community-driven challenges.",
  "ideas": [
    {
      "title": "My Diet Before vs. After gymii: A Silent Transformation",
      "format": "Silent Video",
      "description": "A short, engaging video showcasing relatable 'struggle' moments with nutrition (e.g., confused grocery shopping, unhealthy snacking) followed by 'success' moments using gymii (e.g., confidently logging meals, hitting goals). All conveyed through text overlays, emojis, and expressive body language, with a popular but muted background track.",
      "adaptationStrategy": "Instead of just adding captions, the entire narrative is built for silent viewing. The 'before' highlights common pain points young people face with nutrition, making the 'after' (with gymii) a clear, accessible solution. The focus is on visual storytelling and quick, impactful text.",
      "contentHooks": [
        "POV: You thought you were eating healthy...",
        "My nutrition journey: Before gymii vs. After gymii",
        "When your food choices finally make sense 💡"
      ],
      "estimatedEngagement": "High. Silent videos are highly shareable and accessible, especially with relatable humor and a clear problem/solution narrative. The visual transformation resonates well with young audiences."
    },
    {
      "title": "Realistic 'What I Eat In A Day' with gymii (Student Edition)",
      "format": "Short-Form Video",
      "description": "A fast-paced 'What I Eat In A Day' video featuring a student tracking their meals and snacks using gymii. The video would show quick cuts of food preparation, eating, and seamless logging in the app, highlighting its user-friendly interface. Emphasize realistic, affordable student meals.",
      "adaptationStrategy": "This popular trend is adapted by focusing on the 'realistic' aspect for young people (students) and integrating gymii as the essential tool that makes tracking easy and achievable, rather than just showcasing aspirational meals. It provides practical value.",
      "contentHooks": [
        "Student life, balanced bites: My WIEIAD with gymii 🍎",
        "How I hit my macros on a budget (feat. gymii)",
        "POV: You actually enjoy tracking your food now"
      ],
      "estimatedEngagement": "High. 'What I Eat In A Day' content is consistently popular, and adding the 'realistic' and 'student' angle makes it highly relatable. Seamless integration of gymii provides a clear product benefit within a trending format."
    },
    {
      "title": "Nutrition Myth Buster: Quick Polls & Facts with gymii",
      "format": "Stories Format",
      "description": "A series of Instagram or Snapchat stories featuring interactive polls ('True/False', 'Which one?') about common nutrition myths or food choices. The reveal slide would debunk the myth with a quick fact and show how gymii helps users understand their actual intake, providing clarity.",
      "adaptationStrategy": "Leveraging the interactive elements of stories (polls, quizzes) to educate the audience in an engaging, bite-sized way. gymii is positioned as the data-driven 'truth-teller' that helps users move beyond misinformation.",
      "contentHooks": [
        "Is this a nutrition myth? Vote now! 👇",
        "Think you know your snacks? Test your knowledge! 🤔",
        "Debunking diet myths with gymii data 📊"
      ],
      "estimatedEngagement": "High. Stories are designed for quick interaction, and quizzes/polls drive high engagement. Providing immediate value (myth debunking) and linking it to the app's utility makes it effective."
    },
    {
      "title": "POV: Your Friends Ask How You're So Consistent (TikTok Trend)",
      "format": "TikTok Video / Early Trend Adoption with a Unique Spin",
      "description": "Utilize a trending TikTok audio or 'POV' format to show a scenario where someone effortlessly makes healthy choices or hits their fitness goals, and when asked 'How?', they subtly reveal they're using gymii (e.g., a quick flash of the app, a confident smile while logging).",
      "adaptationStrategy": "Instead of directly promoting, this adapts a current viral trend to subtly position gymii as the 'secret weapon' behind relatable success. The authenticity comes from participating in the trend with a creative spin, rather than just overlaying a product ad.",
      "contentHooks": [
        "POV: You actually enjoy meal prepping now (thanks, gymii)",
        "When your friends ask how you track everything... 👀",
        "My secret to consistent nutrition? It's easy with gymii."
      ],
      "estimatedEngagement": "High. Directly leverages current TikTok trends, which are designed for virality. The 'POV' format and subtle product reveal make it feel organic and relatable to the target audience."
    },
    {
      "title": "Gymii Glow Up: Nutrition Journey in Reels",
      "format": "Instagram Reels (for reach)",
      "description": "A short, dynamic Reel showcasing a user's 'glow up' in their nutrition understanding and habits over time, facilitated by gymii. This could be a visual progression of healthier meal choices, increased energy, or improved macro balance, all visually represented with quick cuts, text overlays, and a popular trending audio.",
      "adaptationStrategy": "Focus on a 'transformation' that isn't just physical, but also about knowledge, energy, and feeling better. It uses the aspirational nature of 'glow up' content but grounds it in the practical, data-driven insights provided by gymii, making it achievable.",
      "contentHooks": [
        "My nutrition journey: Confused to confident with gymii ✨",
        "The best glow up is a healthy gut glow up (feat. gymii)",
        "I thought I ate healthy until I used gymii for a week..."
      ],
      "estimatedEngagement": "High. Reels are excellent for reach, and 'glow up' content is highly engaging. The focus on a holistic nutrition transformation (beyond just weight) resonates well with a conscious young audience."
    },
    {
      "title": "Quick Fixes: 3 Healthy Swaps Your Diet Needs (Gymii Carousel)",
      "format": "Instagram Carousels (for engagement)",
      "description": "An Instagram carousel post featuring 3 common unhealthy food items and their healthier, equally delicious swaps. Each slide would show the 'bad' item, the 'good' swap, and a screenshot of how gymii makes it easy to track the nutritional difference, encouraging informed choices.",
      "adaptationStrategy": "Utilizes the engagement potential of carousels for educational content. It provides actionable advice (healthy swaps) and positions gymii as the tool that empowers users to make these choices by visualizing the nutritional impact.",
      "contentHooks": [
        "Level up your snacks! Healthy swaps with gymii 🥕",
        "3 easy food swaps for a healthier you (track with gymii!)",
        "Unlock better nutrition: Swipe for smart choices ➡️"
      ],
      "estimatedEngagement": "Medium to High. Carousels drive strong engagement through actionable tips and visual comparisons. The direct integration of gymii's tracking capability adds a practical, product-focused element."
    },
    {
      "title": "The #GymiiChallenge: Track Your Week! (Short-Form Video)",
      "format": "Short-Form Video / Video-First Social Media",
      "description": "Launch a weekly or monthly challenge encouraging users to track their meals consistently for a set period using gymii. Create a short, energetic video announcing the challenge, showing quick cuts of users (or actors) logging meals, and highlighting potential rewards or community features. Encourage user-generated content with a unique hashtag.",
      "adaptationStrategy": "Adapts the popular challenge format by making gymii central to participation. It leverages the social aspect of the app and encourages direct product usage through gamification and community building, rather than just passive consumption.",
      "contentHooks": [
        "Ready for a #GymiiGlowUp? Join the 7-day tracking challenge!",
        "Level up your nutrition game with the #GymiiChallenge! 💪",
        "Track your week, transform your habits. Get started with gymii!"
      ],
      "estimatedEngagement": "High. Challenges drive user-generated content and community engagement, which is excellent for viral reach and sustained interest. The call to action is clear and directly involves the product."
    },
    {
      "title": "Quick Tip: Hydration Hacks with gymii",
      "format": "Threads Images with Text",
      "description": "A visually appealing image on Threads with a concise, actionable tip about hydration (e.g., 'Did you know tracking water intake boosts energy?'). The text would briefly mention how gymii helps track water alongside food, making it easy to stay on top of hydration goals.",
      "adaptationStrategy": "Leverages the engagement of images on Threads for quick, valuable tips. It positions gymii as a holistic tracking tool, not just for food, and encourages discussion around an often-overlooked aspect of nutrition.",
      "contentHooks": [
        "Hydration Hack: Don't forget your water! 💧 #GymiiTip",
        "Boost your energy with this simple habit (tracked by gymii!)",
        "Quick Tip: How much water do *you* drink daily? 🧐"
      ],
      "estimatedEngagement": "Medium. Threads engagement is still evolving, but images perform well. Providing a clear, actionable tip linked to the product's features can drive discussion and engagement."
    },
    {
      "title": "Relatable Food Oops! But Gymii Saves the Day (Silent Skit)",
      "format": "Silent Video / Short-Form Video",
      "description": "A humorous, short silent skit showing a common 'oops' moment with food (e.g., accidentally eating too many snacks, overestimating portion sizes). The 'save' comes from quickly opening gymii, logging the food, and seeing how to adjust the rest of the day's intake. Uses expressive acting and text overlays.",
      "adaptationStrategy": "Authentically adapts the silent video format for humor and relatability. It focuses on common struggles of young people and positions gymii not as a restrictive tool, but as a flexible helper that allows for occasional indulgences while maintaining awareness.",
      "contentHooks": [
        "When you accidentally eat the whole bag... but gymii understands 😅",
        "My diet's personal assistant: gymii to the rescue!",
        "Oops! Did I do that? (Good thing I have gymii)"
      ],
      "estimatedEngagement": "High. Humor and relatability are powerful drivers for viral content. The clear problem-solution narrative, delivered silently, makes it widely accessible and shareable."
    },
    {
      "title": "Behind the Scenes: Meal Prep Made Easy with Gymii (Stories)",
      "format": "Stories Format / Segmented Video Formats",
      "description": "A series of vertical video stories showing a quick, efficient meal prep session. Each segment would focus on a step (e.g., chopping veggies, cooking protein) and seamlessly integrate a quick shot of logging ingredients or a full meal into gymii, demonstrating how easy it is to track while prepping.",
      "adaptationStrategy": "Leverages the segmented nature of stories to tell a practical, actionable story. It authenticates the 'easy' aspect of gymii by showing its integration into a real-life, time-saving activity relevant to young people interested in healthy eating.",
      "contentHooks": [
        "Meal prep Sunday just got easier (with gymii!)",
        "My secret weapon for healthy eating: Meal prep + gymii",
        "Quick & easy meal prep, tracked in seconds ⏱️"
      ],
      "estimatedEngagement": "Medium. Provides practical value and behind-the-scenes authenticity. The short, digestible segments are well-suited for story consumption, and the product integration is natural."
    }
  ]
}
\`\`\``;

      const result = parseJsonWithFallbacks(socialMediaJson);

      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.executiveSummary).toContain('video-first');
      expect(parsed.ideas).toHaveLength(10);
      expect(parsed.ideas[0].title).toBe(
        'My Diet Before vs. After gymii: A Silent Transformation'
      );
      expect(parsed.ideas[0].contentHooks).toHaveLength(3);
      expect(parsed.ideas[2].contentHooks[0]).toContain('👇');
      expect(parsed.ideas[6].contentHooks[1]).toContain('💪');
    });
  });

  describe('Content Creation Trends JSON', () => {
    test('should parse large marketing landing content JSON', () => {
      const input = `{"content":"# Agentic Workflow Automationswith full observability and exportability\n\nEnd-to-end type safety, exportable as clean TypeScript code.\n\n1\\. Build Workflows Alongside Code2\\. Debug with Clear Logs3\\. Export Workflows as code or API\n\nBubbleFlow IDE - Code ↔ Flow Sync\n\n1\n\nimport { BubbleFlow, GoogleSheetsBubble, RedditScrapeTool, AIAgentBubble } from '@bubblelab/bubble-core';\n\n2\n\n3\n\nexportclass RedditFlow extends BubbleFlow {\n\n4\n\nasync handle(payload) {\n\n5\n\nconst { spreadsheetId } = payload;\n\n6\n\n7\n\nconst readSheet = newGoogleSheetsBubble({\n\n8\n\noperation: 'read\\_values',\n\n9\n\nspreadsheet\\_id: spreadsheetId,\n\n10\n\nrange: 'Sheet1!A:A',\n\n11\n\n});\n\n12\n\nconst existingContactsResult = await readSheet.action();\n\n13\n\n14\n\nconst redditScraper = newRedditScrapeTool({\n\n15\n\nsubreddit: 'n8n',\n\n16\n\nsort: 'new',\n\n17\n\nlimit: 50,\n\n18\n\n});\n\n19\n\nconst redditResult = await redditScraper.action();\n\n20\n\n21\n\nconst aiAgent = newAIAgentBubble({\n\n22\n\nmessage,\n\n23\n\nsystemPrompt,\n\n24\n\nmodel: {\n\n25\n\nmodel: 'google/gemini-2.5-pro',\n\n26\n\njsonMode: true,\n\n27\n\n},\n\n28\n\ntools: \\[\\],\n\n29\n\n});\n\n30\n\nconst aiResult = await aiAgent.action();\n\n![readSheet](https://bubblelab.ai/integrations-logos/google-sheets.png)\n\nreadSheet\n\nGoogleSheetsBubble\n\nLine 35:1 - 40:1\n\noperation\n\n'read\\_values'\n\nspreadsheet\\_id\n\nspreadsheetId\n\nrange\n\n'Sheet1!A:A'\n\n![redditScraper](https://bubblelab.ai/integrations-logos/reddit.svg)\n\nredditScraper\n\nRedditScrapeTool\n\nLine 51:1 - 56:1\n\nsubreddit\n\n'n8n'\n\nsort\n\n'new'\n\nlimit\n\n50\n\n![aiAgent](https://bubblelab.ai/integrations-logos/research-agent.png)\n\naiAgent\n\nAIAgentBubble\n\nLine 100:1 - 110:1\n\nmessage\n\nmessage\n\nsystemPrompt\n\nsystemPrompt\n\nmodel\n\n{ model: 'google/gemini-2.5-pro' }\n\n## Deploy workflowsin minutes\n\nPrompt -> Visualize -> Execute -> Export Code\n\n[See all demos](https://bubblelab.ai/demos)\n\n1.Build2.Code3.Execute4.Export\n\n## WhyBubble Lab?\n\nThere are dozens of workflow automation platforms. Here’s what makes Bubble Lab different:\n\n### Full Observability\n\nEvery workflow is compiled with **end-to-end type safety**, enforced at both compile and runtime. Combined with **built-in traceability** and **rich logs**, you can debug and ship with confidence.\n\nLogs\n\n\\|INFO ▶ Starting lead generation workflow\n\n\\|OK ▶ Fetched 487 from Salesforce CRM \\| Duration: 284ms\n\n\\|OK ▶ Enriched data for 483/487 records \\| Duration: 621ms\n\n\\|WARN ▶ OpenAI rate limit hit, retrying with backoff...\n\n\\|OK ▶ Drafted 483 personalized emails \\| Duration: 1.2s\n\n\\|INFO ▶ Workflow completed\n\n### Direct API Calls or Node.js Exports\n\nBubble Lab outputs **clean, production-ready TypeScript** you can own, extend, and run anywhere. Workflows can be exported as .ts files or invoked directly via **auto-generated APIs**.\n\nLong JSON Files\n\nClean TypeScript\n\n✓\n\nLong JSON Files\n\nClean TypeScript\n\n✓\n\n### AI-Native Bubbles\n\nOur architecture is AI-first and TypeScript-native, which makes it compatible with **natural language** commands. Describe your workflow, and our specialized agent will **orchestrate composable Bubbles** into production-ready workflows you can trust.\n\nChat\n\nLead gen workflow...\n\nCode\n\n## Live Products\n\nProduction products built with Bubble Lab. Live withPaying Enterprise Customers\n\nBuild one yourself\n\n![Nodex logo](https://bubblelab.ai/nodex-logo.png)\n\n![Slack](https://bubblelab.ai/integrations-logos/slack.svg)![Postgres](https://bubblelab.ai/integrations-logos/postgres.svg)\n\n### Slack Data Scientist agent\n\nAI Data Scientist in Slack that responds to natural language queries.\n\n“Nodex has made our team much more efficient, allowing anyone on our team to query our complex data in plain English, directly in Slack. It was incredibly easy to set up, and so simple to use.”\n\n![Jason Ma](https://bubblelab.ai/integrations-logos/jason-testimonial.jpg)\n\nJason Ma\n\nCofounder of Dyna Robotics\n\n[Try Nodex for free](https://nodex.bubblelab.ai/)\n\n![Docububble logo](https://bubblelab.ai/docububble-logo.png)\n\n![Cloudflare](https://bubblelab.ai/integrations-logos/cloudflare.svg)![PDF](https://bubblelab.ai/integrations-logos/pdf.png)\n\n### Smart document filing agent\n\nAI document reading and filing agent.\n\n“DocuBubble automatically sorts my property receipts, tenant applications, and lease documents into my spreadsheets and all I have to do is upload them. What used to be hours of manual filing every month is now completely automated.”\n\nVX\n\nVivian Xie\n\nIndependent Realtor\n\n[Try DocuBubble for free](https://doc.bubblelab.ai/)\n\n## Frequently AskedQuestions\n\nHow is Bubble Lab different from tools like n8n?\n\nUnlike traditional workflow platforms that rely on proprietary JSON nodes, Bubble Lab is AI-native and built with TypeScript. That means:\n\n- Full traceability and observability.\n- Real code you can debug, version, and export.\n- Seamless compatibility with AI agents and natural language.\n\nWho is Bubble Lab for?\n\nWe designed Bubble Lab to be developer-first. If you are a developer and have used workflow builders like Zapier, Make, or n8n, you will immediately notice the flexibility and power of owning your flows in code. That said, our chat-to-workflow interface makes it easy for anyone to start building right away.\n\nHow do I build workflows?\n\nUse one of our templates or describe what you want in natural language, and Bubble Lab will generate the workflow instantly. From there you can visualize, edit from the code editor, and export it as clean TypeScript code that you can run anywhere.\n\nWhat is the difference between self hosting and using the cloud version?\n\nThe cloud version lets you start instantly: hosting, OAuth, and setup are all managed for you, and it includes starter credits so you can begin running workflows right away. The self-hosted version gives you full control to run Bubble Lab on your own infrastructure, manage your own secrets, and scale without limits.\n\nWhat if there is a Bubble integration that is missing?\n\nTell us what you need! We are actively prioritizing new Bubbles based on community demand- your request could be next on the list.\n\nIs Bubble Lab open source?\n\nYES! We are open-sourced under the Apache License 2.0. We love contributions and welcome them!\n\n![Bubble Lab Logo](https://bubblelab.ai/logo.png)\n\n## Automate with Bubble Lab\n\nBuild Now"}`;

      const result = parseJsonWithFallbacks(input);
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.response);
      expect(parsed.content).toContain('Agentic Workflow Automations');
      expect(parsed.content).toContain('BubbleFlow IDE - Code');
      expect(parsed.content).toContain('WhyBubble Lab?');
    });
  });
});

describe('JSON Parsing for pearl responses', () => {
  test('should handle invalid JSON with nested content inside', () => {
    // This is markdown documentation with an incomplete code block (missing closing backticks)
    // The JSON parser should NOT extract this as valid JSON since it's embedded in markdown
    const input = `To run this flow, you have two main options:

1.  **Run Manually in the Editor (for testing):**
    *   On the right side of the screen, you'll see the **Input Schema** panel for the trigger.
    *   There's an input field labeled \`query\`. You can type any question you want the AI to answer.
    *   If you leave it blank, it will use the default question: "What is the top news headline?".
    *   Click the **"Run"** button at the top right. The flow will execute, and you'll see the AI's response in the **Console** tab.

2.  **Trigger via Webhook:**
    *   You can also run this flow by sending an HTTP POST request to its unique webhook URL.
    *   You can find the webhook URL on the flow visualizer page.
    *   Send a POST request to that URL with a JSON body like this:
        \`\`\`json
        {
          "query": "What are the latest developments in AI?"
        }`;

    const result = parseJsonWithFallbacks(input);

    // This should fail because the content is markdown documentation, not JSON
    // The code block is incomplete (missing closing backticks), so it should not be parsed as valid JSON
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('incomplete code block');
  });

  test('should reject markdown documentation with complete code block', () => {
    // This is markdown documentation with a complete code block
    // The JSON parser should NOT extract this as valid JSON since it's embedded in markdown documentation
    const input = `This workflow is triggered by an HTTP request. You have two main ways to run it:

1.  **From the Bubble Studio Editor (Easiest):**
    *   On the right side of the screen, you'll see a visualization of your flow. The first node is the "Input Schema".
    *   You can enter a question into the \`query\` input field. If you leave it blank, it will use the default: "What is the top news headline?".
    *   Click the "Run" button at the top right of the editor.
    *   The execution logs and the final response from the AI agent will appear in the "Console" tab.

2.  **Via a Webhook URL:**
    *   You can also trigger this flow by sending an HTTP POST request from another application.
    *   First, enable the webhook trigger using the toggle switch in the flow editor.
    *   Copy the unique webhook URL provided.
    *   Send a POST request to that URL with a JSON body like this:
        \`\`\`json
        {
          "query": "Your question here"
        }
        \`\`\``;

    const result = parseJsonWithFallbacks(input);

    // This should fail because the content is markdown documentation, not JSON
    // Even though the code block is complete, it's still embedded in documentation text
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should parse valid JSON response from AI assistant with markdown formatting inside', () => {
    // This is a valid JSON response that should be parsed successfully
    const input = `{
  "type": "answer",
  "message": "Your Reddit flow is set up as a webhook HTTP trigger, so you can run it in two ways:\\n\\n## Method 1: Manual Run in the UI\\n1. In the Flow editor, you'll see an Input Schema node on the left side\\n2. You need to provide values for these required fields:\\n   - \`spreadsheetId\`: The ID of your Google Sheet (e.g., '1ABC123_xyz')\\n   - \`subreddit\`: The subreddit name (e.g., 'startups')\\n   - \`searchCriteria\`: Your criteria for finding leads (e.g., 'looking for marketing tools')\\n3. Click the \\"Run\\" button to execute the flow\\n4. Monitor the Console tab for real-time logs and the History tab for past executions\\n\\n## Method 2: Webhook HTTP Trigger\\n1. In the flow visualizer, toggle the webhook option to enable it\\n2. Copy the webhook URL that appears\\n3. Send a POST request to that URL with this JSON payload:\\n\`\`\`json\\n{\\n  \\"spreadsheetId\\": \\"your-sheet-id\\",\\n  \\"subreddit\\": \\"target-subreddit\\", \\n  \\"searchCriteria\\": \\"your criteria\\"\\n}\\n\`\`\`\\n4. The flow will automatically execute when the webhook receives the request\\n\\n## Important Notes:\\n- Make sure you have the necessary credentials set up:\\n  - Google Sheets API access (for spreadsheet operations)\\n  - Optional system credentials will be used if not provided\\n- The flow reads existing contacts from Column A to avoid duplicates\\n- Results will include the name, link, personalized message, date, and status for each new contact\\n\\nYour current input shows \`{}\` (empty), so you'll need to provide the three required fields to run the flow successfully."
}`;

    const result = parseJsonWithFallbacks(input);
    expect(result.success).toBe(true);
  });

  test('should successfully parse complex AI-generated JSON response', () => {
    // This is a real AI-generated JSON response that should parse successfully
    const input = `{
  "summary": "**Calendar Summary Flow**\\n\\nAutomatically fetches your upcoming Google Calendar events, summarizes them using AI, and sends a concise email summary to a specified recipient.\\n\\n**Setup Before Testing:**\\n1. Ensure your Google account is connected to Bubble Lab with the necessary permissions to access your primary calendar.\\n2. Ensure Resend credentials are set up in Bubble Lab, or use the default system credentials if available.\\n\\n**To Test This Flow:**\\nProvide these inputs in the form:\\n- **email**: Enter the email address where you want to receive your weekly calendar summary (e.g., \\"your.name@example.com\\").\\n\\n**What Happens When You Run:**\\n1. The flow first determines the current date and time, then calculates the date exactly seven days from now.\\n2. It then connects to your Google Calendar and retrieves all events scheduled within that 7-day period from your primary calendar, sorted by their start time.\\n3. If no upcoming events are found for the next seven days, the flow will conclude with a message indicating no events were found.\\n4. If events are found, these events are then sent to an AI agent, powered by the Google Gemini 2.5 Flash model. The AI is instructed to act as an expert in summarizing calendar events into a concise, human-readable email format.\\n5. The AI processes the event details and generates a friendly, comprehensive email summary.\\n6. Finally, the flow uses Resend to send an email to the \`email\` address you provided. This email will have the subject \\"Your Weekly Calendar Summary\\" and contain the AI-generated summary in its HTML body.\\n\\n**Output You'll See:**\\n\`\`\`json\\n{\\n  \\"message\\": \\"Calendar summary sent to [provided email address]\\"\\n}\\n\`\`\`\\n\\nCheck your inbox for the weekly calendar summary email!",
  "inputsSchema": "{\\"type\\":\\"object\\",\\"properties\\":{\\"email\\":{\\"type\\":\\"string\\",\\"description\\":\\"The email address to send the calendar summary to.\\"}},\\"required\\":[\\"email\\"]}",
  "bubbleDescriptions": {
    "420": "This **Google Calendar** bubble is configured to fetch upcoming events from your primary Google Calendar. Specifically, it uses the \`list_events\` operation. It dynamically sets \`time_min\` and \`time_max\` to cover a 7-day period starting from the moment the flow runs, ensuring you get a summary of your immediate future. The \`single_events: true\` parameter ensures that any recurring events are expanded and listed individually, and \`order_by: 'startTime'\` arranges them chronologically for a clear overview. This bubble's role is to gather all the raw event data that will be processed in the subsequent steps.",
    "423": "The **AI Agent** bubble is responsible for summarizing the fetched calendar events. It utilizes the \`google/gemini-2.5-flash\` model, known for its efficiency in text generation. A \`systemPrompt\` is provided, instructing the AI to act as an 'expert at summarizing calendar events into a concise, human-readable email format.' The \`message\` parameter passes the \`JSON.stringify\`'d list of events from the Google Calendar bubble to the AI, ensuring all details are included for summarization. This bubble transforms the raw event data into a friendly, digestible summary suitable for an email.",
    "426": "The **Resend** bubble is the final step in the workflow, responsible for sending the AI-generated calendar summary via email. It performs the \`send_email\` operation. The \`to\` parameter is dynamically set to the \`email\` address provided as an input to the flow, ensuring the summary reaches the correct recipient. The \`subject\` is set to 'Your Weekly Calendar Summary,' making the email's purpose clear. The \`html\` parameter constructs the email body, embedding the AI-generated \`summary\` within a \`pre\` tag for clean formatting. This bubble ensures the summarized information is delivered effectively to the user."
  }
}`;

    const result = parseJsonWithFallbacks(input);
    console.log('[JSON Parsing] Result:', result);

    // This should succeed - it's valid JSON with complex nested content
    expect(result.success).toBe(true);
  });

  test('should parse valid JSON response with webhook flow instructions', () => {
    const input = `\n\n{
  "type": "answer",
  "message": "You can run this webhook-based flow in several ways:\\n\\n**Option 1: Using the Run Button in Flow Editor**\\n1. In the Flow editor, you'll see an \\"Input Schema\\" node for your webhook\\n2. Enter a test value for the \`query\` field (e.g., \\"What's the weather like today?\\")\\n3. Click the \\"Run\\" button to test the flow locally\\n4. View the results in the Console panel\\n\\n**Option 2: Using the Webhook URL**\\n1. In the flow visualizer, look for the webhook toggle/URL section\\n2. Copy the webhook URL provided\\n3. Send a POST request to that URL with your data:\\n   \`\`\`json\\n   {\\n     \\"query\\": \\"Your question here\\"\\n   }\\n   \`\`\`\\n4. The flow will respond with the AI agent's answer\\n\\n**Option 3: Testing with cURL**\\n\`\`\`bash\\ncurl -X POST YOUR_WEBHOOK_URL \\\\\\n  -H \\"Content-Type: application/json\\" \\\\\\n  -d '{\\\"query\\\": \\\"What are the latest tech headlines?\\\"}'\\n\`\`\`\\n\\nThe flow will use the AI Agent with web search to respond to your query. If you don't provide a \`query\` parameter, it will default to \\"What is the top news headline?\\""
}`;

    const result = parseJsonWithFallbacks(input);
    expect(result.success).toBe(true);
  });
});
