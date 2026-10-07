import type { AIProvider, AnalysisInput } from "./provider";
import { MockProvider } from "./mock";
import { NebiusNemotronProvider } from "./nebius-nemotron";

class ResilientAIProvider implements AIProvider {
  private readonly real = new NebiusNemotronProvider();
  private readonly mock = new MockProvider();
  label = this.real.label;
  notice?: string;
  async analyzeSituation(input: AnalysisInput) {
    try {
      const result = await this.real.analyzeSituation(input);
      this.label = this.real.label;
      this.notice = undefined;
      return result;
    } catch {
      this.label = this.mock.label;
      this.notice = "AI assessment temporarily unavailable. Using local safety assessment.";
      return this.mock.analyzeSituation(input);
    }
  }
}

export function getAIProvider(): AIProvider {
  return process.env.AI_PROVIDER === "local" || process.env.AI_PROVIDER === "mock"
    ? new MockProvider()
    : new ResilientAIProvider();
}
