import async from 'async';
import { env } from '../config/env.js';
import { IAiProvider, AiErrorPayload, AiPostMortemResult } from './ai/aiProvider.js';
import { GroqProvider } from './ai/groqProvider.js';
import { GeminiProvider } from './ai/geminiProvider.js';
import { incidentRepository } from '../repositories/incidentRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { emailService } from './emailService.js';
import { eventBus } from '../utils/eventBus.js';

export interface AiTask {
  incidentId: string;
  monitorId: string;
  userId: string;
  monitorName: string;
  monitorUrl: string;
  startedAt: string;
  statusCode: number;
  errorMessage: string;
  responseBody?: string;
}

// Generative AI service managing pluggable provider lifecycle and in-memory background task queue
export class AiService {
  private provider: IAiProvider | null = null;
  private readonly queue: async.QueueObject<AiTask>;

  constructor() {
    this.initProvider();

    // Initialize async.queue processing AI diagnostic tasks with concurrency limit = 2
    this.queue = async.queue<AiTask>(async (task) => {
      await this.processTask(task);
    }, 2);

    this.queue.error((err, task) => {
      console.error(`[AI Queue] Unhandled task error for incident ${task.incidentId}:`, err);
    });
  }

  // Initialize selected AI provider based on environment configuration
  private initProvider(): void {
    const providerType = env.AI_PROVIDER;

    if (providerType === 'gemini') {
      if (env.GEMINI_API_KEY) {
        this.provider = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
        console.log(`[AI Service] Active provider: ${this.provider.name} (${env.GEMINI_MODEL})`);
        return;
      }
    }

    if (env.GROQ_API_KEY) {
      this.provider = new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL);
      console.log(`[AI Service] Active provider: ${this.provider.name} (${env.GROQ_MODEL})`);
      return;
    }

    console.log('[AI Service] No LLM API key configured. Automated AI diagnostics will be skipped.');
  }

  // Push incident AI diagnostic task into in-memory queue
  queueIncidentAnalysis(task: AiTask): void {
    this.queue.push(task);
  }

  // Generate automated post-mortem diagnostic report directly (for manual reanalyze)
  async generatePostMortem(payload: AiErrorPayload): Promise<AiPostMortemResult | null> {
    if (!this.provider) {
      return null;
    }
    return this.provider.generatePostMortem(payload);
  }

  // Process queued task: run AI diagnosis, update incident in DB, broadcast SSE and send alert email
  private async processTask(task: AiTask): Promise<void> {
    try {
      const postMortem = await this.generatePostMortem({
        targetUrl: task.monitorUrl,
        statusCode: task.statusCode,
        errorMessage: task.errorMessage,
        responseBody: task.responseBody,
      });

      if (postMortem) {
        const generatedAt = new Date();
        await incidentRepository.updateAiPostMortem(task.incidentId, {
          summary: postMortem.summary,
          rootCause: postMortem.rootCause,
          actionItems: postMortem.actionItems,
          generatedAt,
        });

        // Broadcast event with AI post-mortem report to replace client loading state
        eventBus.emitIncidentAlert({
          incidentId: task.incidentId,
          monitorId: task.monitorId,
          userId: task.userId,
          status: 'ongoing',
          startedAt: task.startedAt,
          errorMessage: task.errorMessage,
          aiPostMortem: {
            summary: postMortem.summary,
            rootCause: postMortem.rootCause,
            actionItems: postMortem.actionItems,
            generatedAt: generatedAt.toISOString(),
          },
        });
      }

      // Dispatch downtime alert email to user
      const user = await userRepository.findById(task.userId);
      if (user) {
        emailService.sendIncidentAlertEmail(
          user.email,
          task.monitorName,
          task.monitorUrl,
          task.startedAt,
          {
            statusCode: task.statusCode,
            errorMessage: task.errorMessage,
          },
          postMortem?.summary
        );
      }
    } catch (error) {
      console.error(`[AI Service] Error processing incident analysis for ${task.incidentId}:`, error);
    }
  }

  // Return name of active provider or 'None'
  getProviderName(): string {
    return this.provider ? this.provider.name : 'None';
  }
}

export const aiService = new AiService();
