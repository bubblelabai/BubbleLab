/**
 * Shared system prompts and critical instructions for BubbleFlow code generation
 * Used by both Pearl AI agent and BubbleFlow Generator Workflow
 */

/**
 * Critical instructions for AI agents generating BubbleFlow code
 * These instructions ensure consistent, correct code generation
 */
export const CRITICAL_INSTRUCTIONS = `CRITICAL INSTRUCTIONS:
1. Start with the exact boilerplate template above (it has all the correct imports and class structure), come up with a name for the flow based on the user's request, export class [name] extends BubbleFlow
2. Properly type the payload import and output interface based on the user's request, create typescript interfaces for them
3. BEFORE writing any code, identify which bubbles you plan to use from the available list
4. For EACH bubble you plan to use, ALWAYS call get-bubble-details-tool first to understand:
   - The correct input parameters and their types
   - The expected output structure in result.data
   - How to properly handle success/error cases
5. Replace the handle method with logic that fulfills the user's request
6. Use the exact parameter structures shown in the bubble details
7. If deterministic tool calls and branch logic are possible, there is no need to use AI agent.
8. Access bubble outputs safely using result.data with null checking (e.g., result.data?.someProperty or check if result.data exists first)
9. Return meaningful data from the handle method
10. DO NOT include credentials in bubble parameters - credentials are handled automatically
11. CRITICAL: Always use the pattern: const result = await new SomeBubble({params}).action() - NEVER use runBubble, this.runBubble, or any other method
12. When using AI Agent, ensure your prompt includes comprehensive context and explicitly pass in all relevant information needed for the task. Be thorough in providing complete data rather than expecting the AI to infer or assume missing details (unless the information must be retrieved from an online source)
13. When generating and dealing with images, process them one at a time to ensure proper handling and avoid overwhelming the system
14. When dealing with other async operations in for loops, batch the requests 5 at a time at most and use Promise.all to handle them efficiently. Always declare bubble instances separately outside of callbacks, loops, or maps before calling .action() - avoid instantiating bubbles directly within map(), forEach(), or other callback functions.
15. If the location of the output is unknown or not specified by the user, use this.logger?.info(message:string) to print the output to the console.
16. DO NOT repeat the user's request in your response or thinking process. Do not include "The user says: <user's request>" in your response.

CRITICAL: You MUST use get-bubble-details-tool for every bubble before using it in your code!`;

/**
 * Validation process instructions for ensuring generated code is valid
 */
export const VALIDATION_PROCESS = `CRITICAL VALIDATION PROCESS:
1. After generating the initial code, ALWAYS use the bubbleflow-validation to validate it
2. If validation fails, you MUST analyze ALL errors carefully and fix EVERY single one
3. Use the bubbleflow-validation again to validate the fixed code
4. If there are still errors, fix them ALL and validate again
5. Repeat this validation-fix cycle until the code passes validation with NO ERRORS (valid: true)
6. Do NOT stop until you get a successful validation result with valid: true and no errors
7. NEVER provide code that has validation errors - keep fixing until it's completely error-free
8. IMPORTANT: Use .action() on the to call the bubble, (this is the only way to run a bubble) - NEVER use runBubble() or any other method

Only return the final TypeScript code that passes validation. No explanations or markdown formatting.`;

/**
 * Additional instructions for input schema handling
 */
export const INPUT_SCHEMA_INSTRUCTIONS = `For input schema, ie. the interface passed to the handle method. Decide based on how
the workflow should typically be ran (if it should be variable or fixed). If all
inputs are fixed take out the interface and just use handle() without the payload.

If no particular trigger is specified, use the webhook/http trigger.`;

export const BUBBLE_SPECIFIC_INSTRUCTIONS = `BUBBLE SPECIFIC INSTRUCTIONS:
1. When using the storage bubble, always use the bubblelab-bucket bucket name, unless the user has their own s3/cloudflare bucket setup.
2. When using the resend bubble, do not set the from parameter, it will be set automatically and use bubble lab's default email, unless the user has their own resend setup and account domain verified.
`;
