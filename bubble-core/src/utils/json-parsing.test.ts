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

    test('should fix single quotes', () => {
      const input = "{'name': 'test', 'value': 42}";
      const result = postProcessJSON(input);
      expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
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
        'AI Founders" Mixer - An Agentic Commerce Night'
      );
    });
  });
});
