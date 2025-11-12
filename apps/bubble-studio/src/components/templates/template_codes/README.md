# Template Files

This directory contains individual template files for the BubbleFlow IDE. Each template is separated into its own file for better organization and maintainability.

## Structure

- `redditLeadGeneration.ts` - Reddit lead generation template (fully implemented)
- `websiteLeadGeneration.ts` - Website lead generation template (placeholder)
- `projectManagementAssistant.ts` - Project management assistant template (placeholder)
- `personalAssistant.ts` - Personal assistant template (placeholder)
- `financialAdvisor.ts` - Financial advisor template (placeholder)
- `recruitingAssistant.ts` - Recruiting assistant template (placeholder)
- `chatWithYourDatabase.ts` - Chat with your database template (placeholder)
- `nanobananaImagePipeline.ts` - Nanobanana image pipeline template (placeholder)

The main `templateLoader.ts` file imports all templates and maintains the registry.

## Adding New Templates

1. Create a new file in this directory following the naming convention: `templateName.ts`
2. Export both `templateCode` (string) and `metadata` (TemplateMetadata object)
3. Add an import statement in `templateLoader.ts` for your new template
4. Add the template to the `TEMPLATE_REGISTRY` in `templateLoader.ts`

## Template Structure

Each template file should export:

```typescript
export const templateCode = `// Template code as string`;

export const metadata = {
  inputsSchema: JSON.stringify({...}),
  requiredCredentials: {...},
  // Optional: include pre-validated bubbles for instant navigation (skip server validation)
  // Shape should match what the visualizer expects (see FlowVisualizer.toParsedBubble)
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'myBubble',
      bubbleName: 'SomeBubbleClass',
      className: 'SomeBubbleClass',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'param1', value: 'value', type: 'string' }
      ]
    }
  }
};
```

If `preValidatedBubbles` is provided, preset selection will navigate to the IDE instantly with the flow graph rendered, without waiting for backend validation.
