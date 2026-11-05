import { IAiProvider, AiErrorPayload, AiPostMortemResult } from './aiProvider.js';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// Google Gemini AI provider implementation utilizing Gemini 1.5 models
export class GeminiProvider implements IAiProvider {
  readonly name = 'Gemini';
  private readonly timeoutMs = 15000;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  // Generate automated post-mortem diagnostic report using Gemini generateContent API
  async generatePostMortem(payload: AiErrorPayload): Promise<AiPostMortemResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const promptInstruction =
        'You are an expert Site Reliability Engineer (SRE). Analyze the following incident failure data and produce a concise technical post-mortem report in strictly valid JSON format with three fields: summary (string, 1-2 sentences), rootCause (string, technical diagnosis), and actionItems (array of 2-4 concrete remediation steps). Do not include markdown code fences or conversational text outside the JSON object.\n\nIncident Failure Data:\n';

      const userContent = JSON.stringify({
        targetUrl: payload.targetUrl,
        statusCode: payload.statusCode,
        errorMessage: payload.errorMessage,
        responseBody: payload.responseBody ? payload.responseBody.substring(0, 1000) : '',
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${promptInstruction}${userContent}` }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 600,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Gemini Provider] API responded with HTTP status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content) as {
        summary?: string;
        rootCause?: string;
        actionItems?: string[];
      };

      if (!parsed.summary || !parsed.rootCause || !Array.isArray(parsed.actionItems)) {
        console.warn('[Gemini Provider] Output structure invalid. Omitting post-mortem.');
        return null;
      }

      return {
        summary: parsed.summary,
        rootCause: parsed.rootCause,
        actionItems: parsed.actionItems,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.warn('[Gemini Provider] Post-mortem generation failed or timed out:', error);
      return null;
    }
  }
}

