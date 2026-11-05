export interface AiPostMortemResult {
  summary: string;
  rootCause: string;
  actionItems: string[];
}

export interface AiErrorPayload {
  targetUrl: string;
  statusCode: number;
  errorMessage: string;
  responseBody?: string;
}

// Contract interface for pluggable Generative AI incident analysis providers
export interface IAiProvider {
  readonly name: string;
  generatePostMortem(payload: AiErrorPayload): Promise<AiPostMortemResult | null>;
}

