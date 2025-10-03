// Invalid example that should fail validation
// Missing BubbleFlow class - doesn't extend BubbleFlow

export class InvalidFlow {
  async handle(payload: any) {
    return { error: "Should fail - doesn't extend BubbleFlow" };
  }
}
