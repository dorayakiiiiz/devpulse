import { IAiProvider, AiErrorPayload, AiPostMortemResult } from './aiProvider.js';

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// Groq AI provider implementation utilizing high-throughput LLaMA models
export class GroqProvider implements IAiProvider {
  readonly name = 'Groq';
  private readonly apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
  private readonly timeoutMs = 15000;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  // Generate automated post-mortem diagnostic report using Groq completion API
  async generatePostMortem(payload: AiErrorPayload): Promise<AiPostMortemResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const systemPrompt =
        'You are an expert Site Reliability Engineer (SRE). Analyze the incident failure data and produce a concise technical post-mortem report in strictly valid JSON format with three fields: summary (string, 1-2 sentences), rootCause (string, technical diagnosis), and actionItems (array of 2-4 concrete remediation steps). Do not include markdown code fences or conversational text outside the JSON object.';

      const userContent = JSON.stringify({
        targetUrl: payload.targetUrl,
        statusCode: payload.statusCode,
        errorMessage: payload.errorMessage,
        responseBody: payload.responseBody ? payload.responseBody.substring(0, 1000) : '',
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Groq Provider] API responded with HTTP status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as GroqChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as {
        summary?: string;
        rootCause?: string;
        actionItems?: string[];
      };

      if (!parsed.summary || !parsed.rootCause || !Array.isArray(parsed.actionItems)) {
        console.warn('[Groq Provider] Output structure invalid. Omitting post-mortem.');
        return null;
      }

      return {
        summary: parsed.summary,
        rootCause: parsed.rootCause,
        actionItems: parsed.actionItems,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('[Groq Provider] Post-mortem generation failed or timed out:', error);
      return null;
    }
  }
}

