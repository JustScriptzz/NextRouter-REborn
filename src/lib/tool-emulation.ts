export interface ToolDef {
  type: string;
  function: { name: string; description?: string; parameters?: unknown };
}

function stringifyTool(t: ToolDef): string {
  const p = t.function.parameters ? JSON.stringify(t.function.parameters) : '{"type":"object","properties":{}}';
  return `- ${t.function.name}: ${t.function.description ?? 'No description'}\n  Parameters: ${p}`;
}

export function buildToolSystemPrompt(tools: ToolDef[], toolChoice?: unknown): string {
  const example = tools[0]?.function?.name ?? 'get_weather';
  const exampleArgs = tools[0]?.function?.parameters
    ? JSON.stringify(((tools[0].function.parameters as Record<string, unknown>).properties as Record<string, unknown> | undefined) ? Object.fromEntries(Object.keys(((tools[0].function.parameters as Record<string, unknown>).properties as Record<string, Record<string, unknown>>)).map((k) => [k, 'example'])) : {}, null, 0)
    : '{}';
  const lines = [
    'You have access to the following tools. Use them when needed.',
    '',
    ...tools.map((t) => stringifyTool(t)),
    '',
    'Example:',
    `User: What's the weather in London?`,
    `Assistant: {"tool_calls": [{"name": "${example}", "arguments": {"location": "London"}}]}`,
    '',
    'User: Tell me a joke.',
    'Assistant: Why did the chicken cross the road?',
    '',
    'Rules:',
    '- When you need to call a tool, respond with ONLY a JSON object on a single line, no markdown, no extra text, no reasoning prefix.',
    '- NEVER narrate ("I will call get_weather now", "Let me check..."). No preamble, no explanation, no confirmation sentence.',
    '- Your entire response must be exactly one line: {"tool_calls": [{"name": "tool_name", "arguments": { ... }}]}',
    '- Format: {"tool_calls": [{"name": "tool_name", "arguments": { ... }}]}',
    '- Arguments must be valid JSON matching the tool parameters.',
    '- You may call multiple tools at once by including multiple entries.',
    '- When you do NOT need tools, respond normally in plain text.',
  ];
  if (toolChoice && typeof toolChoice === 'object' && toolChoice !== null && 'function' in (toolChoice as Record<string, unknown>)) {
    const fn = (toolChoice as { function: { name: string } }).function.name;
    lines.push(`- You MUST call the tool "${fn}" in this turn.`);
  } else if (toolChoice === 'required') {
    lines.push('- You MUST call at least one tool in this turn.');
  } else if (toolChoice === 'none') {
    lines.push('- Do NOT call any tool in this turn; answer directly.');
  }
  return lines.join('\n');
}

export function hasTools(body: Record<string, unknown>): boolean {
  return Array.isArray(body.tools) && body.tools.length > 0;
}

export function injectToolsIntoMessages(body: Record<string, unknown>): Record<string, unknown> {
  const tools = body.tools as ToolDef[];
  const toolChoice = body.tool_choice;
  const systemPrompt = buildToolSystemPrompt(tools, toolChoice);
  const messages = (body.messages as Array<Record<string, unknown>>) ?? [];
  const outMessages: Array<Record<string, unknown>> = [];

  // Convert tool result messages (role: tool) to user messages with context, so non-native models understand them
  for (const m of messages) {
    if (m.role === 'tool') {
      outMessages.push({
        role: 'user',
        content: `Tool result for "${(m as { name?: string }).name ?? (m as { tool_call_id?: string }).tool_call_id ?? 'tool'}": ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`,
      });
    } else {
      outMessages.push({ ...m });
    }
  }

  // Prepend or merge into system message
  const sysIdx = outMessages.findIndex((m) => m.role === 'system');
  if (sysIdx >= 0) {
    const existing = typeof outMessages[sysIdx].content === 'string' ? (outMessages[sysIdx].content as string) : JSON.stringify(outMessages[sysIdx].content);
    outMessages[sysIdx] = { ...outMessages[sysIdx], content: `${existing}\n\n${systemPrompt}` };
  } else {
    outMessages.unshift({ role: 'system', content: systemPrompt });
  }

  const out: Record<string, unknown> = { ...body, messages: outMessages };
  delete out.tools;
  delete out.tool_choice;
  // some upstreams reject unknown fields like parallel_tool_calls when using emulation
  delete out.parallel_tool_calls;
  return out;
}

function extractJsonObject(text: string): unknown | null {
  // Try direct parse
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  // Try to find JSON block
  const jsonBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlock) {
    try {
      return JSON.parse(jsonBlock[1]);
    } catch {}
  }
  // Try to find first { ... } that contains tool_calls
  const idx = text.indexOf('{"tool_calls"');
  if (idx !== -1) {
    let depth = 0;
    let start = idx;
    for (let i = idx; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}

export function tryParseToolCalls(content: string, tools: ToolDef[]): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | null {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed.includes('tool_calls') && !trimmed.startsWith('{')) return null;
  const parsed = extractJsonObject(trimmed);
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  let rawCalls: unknown = obj.tool_calls ?? obj.toolCalls ?? obj.function_call;
  if (!rawCalls && obj.name && obj.arguments) {
    rawCalls = [{ name: obj.name, arguments: obj.arguments }];
  }
  if (!Array.isArray(rawCalls) || rawCalls.length === 0) return null;
  const out: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
  for (const c of rawCalls) {
    const cc = c as Record<string, unknown>;
    const name = (cc.name as string) ?? (cc.function as Record<string, unknown> | undefined)?.name as string | undefined;
    if (!name) continue;
    // validate tool exists
    if (!tools.some((t) => t.function.name === name)) continue;
    let args = cc.arguments ?? (cc.function as Record<string, unknown> | undefined)?.arguments;
    if (typeof args === 'object' && args !== null) args = JSON.stringify(args);
    if (typeof args !== 'string') args = args != null ? String(args) : '{}';
    // ensure valid JSON
    try {
      JSON.parse(args as string);
    } catch {
      // if not valid JSON, wrap as raw string value — keep as is to avoid breaking
    }
    out.push({
      id: `call_${Math.random().toString(36).slice(2, 10)}`,
      type: 'function',
      function: { name, arguments: args as string },
    });
  }
  return out.length > 0 ? out : null;
}

export function isToolNotSupportedError(status: number, message: string): boolean {
  if (status !== 400 && status !== 422 && status !== 404) return false;
  const m = message.toLowerCase();
  return (
    m.includes('tool') ||
    m.includes('function') ||
    m.includes('unknown parameter') ||
    m.includes('unexpected field') ||
    m.includes('invalid parameter')
  );
}

export function convertEmulatedResponse(
  data: Record<string, unknown>,
  toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>,
  publicModelId: string,
): Record<string, unknown> {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) return data;
  const msg = (choices[0].message as Record<string, unknown> | undefined) ?? {};
  const newMsg: Record<string, unknown> = {
    role: 'assistant',
    content: null,
    tool_calls: toolCalls,
  };
  // preserve reasoning if present
  if (typeof msg.reasoning === 'string') (newMsg as Record<string, unknown>).reasoning = msg.reasoning;
  choices[0] = {
    ...choices[0],
    message: newMsg,
    finish_reason: 'tool_calls',
  };
  if (typeof data.model === 'string') (data as Record<string, unknown>).model = publicModelId;
  return data;
}
