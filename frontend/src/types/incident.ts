export type IncidentStatus = 'ongoing' | 'resolved';

export interface IncidentErrorDetails {
  statusCode: number;
  errorMessage: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
}

export interface AiPostMortemDto {
  summary: string;
  rootCause: string;
  actionItems: string[];
  generatedAt: string;
}

export interface IncidentResponseDto {
  id: string;
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  errorDetails: IncidentErrorDetails;
  aiPostMortem?: AiPostMortemDto;
  createdAt: string;
  updatedAt: string;
}
