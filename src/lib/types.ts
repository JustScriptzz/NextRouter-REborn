export type ModelKind = 'text' | 'image' | 'tts' | 'stt' | 'video' | 'embedding';

export const MODEL_KIND_LABELS: Record<ModelKind, string> = {
  text: 'Text',
  image: 'Image',
  tts: 'Text-to-speech',
  stt: 'Speech-to-text',
  video: 'Video',
  embedding: 'Embedding',
};

export interface SessionUser {
  id: string;
  email: string;
  username: string;
}

export interface CustomModelDTO {
  id: string;
  modelId: string;
  title: string;
  description: string | null;
  acceptedInputs: ModelKind[];
  visibility: 'private' | 'public';
  rpm: number | null;
  endpointUrl: string;
  providerModelId: string;
  fallbackModelId: string;
  createdAt: string;
}

export interface PublicModelDTO {
  id: string;
  type: ModelKind;
  title: string;
  isFallback: boolean;
}

export interface UsagePoint {
  tokens: number;
  calls: number;
}

export interface UsageSummary {
  today: UsagePoint;
  total: UsagePoint;
  limit: number;
  remaining: number;
  last7: Array<{ date: string; tokens: number; calls: number }>;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
}