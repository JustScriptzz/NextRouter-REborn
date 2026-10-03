// NextRouter — outer shell config.
// Edit this one file when providers are decided. Everything else reads from here.

export const DISCORD_URL = 'https://discord.gg/YOUR_INVITE';

// Daily allowance, in tokens. 50M / day across all models, resets 00:00 UTC.
export const DAILY_TOKEN_LIMIT = 50_000_000;

export type IoKind = 'text' | 'image' | 'audio' | 'video';

export type ShellModel = {
  id: string;
  label: string;
  type: 'chat' | 'image' | 'audio' | 'video' | 'embed';
  context: string;      // context window, '—' if the provider doesn't report it
  maxOutput: string;    // max output tokens, '—' if unknown
  inputs: IoKind[];     // what the model accepts
  outputs: IoKind[];    // what the model produces
  thinking: boolean;    // extended reasoning
  tools: boolean;       // function / tool calling
  webSearch: boolean;   // server-side web search
  streaming?: boolean;  // SSE streaming; defaults on (gateway passes it through)
  note: string;
};

// Display catalog. Public build: example entries only — replace with the
// model IDs you pin in PRIMARY_MODELS / SECONDARY_MODELS / FALLBACK_MODELS.
// Every id must match the gateway exactly.
export const MODELS: ShellModel[] = [
  { id: 'example-chat', label: 'Example Chat', type: 'chat', context: '—', maxOutput: '—', inputs: ['text'], outputs: ['text'], thinking: false, tools: true, webSearch: false, note: 'Replace with your pinned model IDs.' },
  { id: 'example-reasoning', label: 'Example Reasoning', type: 'chat', context: '—', maxOutput: '—', inputs: ['text'], outputs: ['text'], thinking: true, tools: true, webSearch: false, note: 'Replace with your pinned model IDs.' },
  { id: 'example-image', label: 'Example Image', type: 'image', context: '—', maxOutput: '—', inputs: ['text'], outputs: ['image'], thinking: false, tools: false, webSearch: false, note: 'Replace with your pinned image model ID.' },
];
