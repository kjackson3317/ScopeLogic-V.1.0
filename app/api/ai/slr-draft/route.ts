import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SystemInput = { key: string; label: string };
type ExistingInput = {
  title?: string;
  concern?: string;
  rfiQuestion?: string;
  reference?: string;
  recommendations?: Record<string, string>;
  checklistItems?: Record<string, string>;
};
type DraftRequest = {
  prompt?: string;
  systems?: SystemInput[];
  existing?: ExistingInput;
};

type RateEntry = { count: number; resetAt: number };
const globalForRateLimit = globalThis as typeof globalThis & { scopeLogicAiRateLimit?: Map<string, RateEntry> };
const rateLimit = globalForRateLimit.scopeLogicAiRateLimit ?? new Map<string, RateEntry>();
globalForRateLimit.scopeLogicAiRateLimit = rateLimit;

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_PROMPT_LENGTH = 4000;
const MAX_EXISTING_FIELD_LENGTH = 8000;

function clean(value: unknown, max = MAX_EXISTING_FIELD_LENGTH) {
  return String(value ?? '').trim().slice(0, max);
}

function isEnabled() {
  return String(process.env.SCOPELOGIC_AI_ENABLED || '').trim().toLowerCase() === 'true';
}

function outputText(payload: any) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('');
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const allowed = new Set([request.nextUrl.origin, String(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')].filter(Boolean));
  return allowed.has(origin.replace(/\/$/, ''));
}

export async function POST(request: NextRequest) {
  if (!isEnabled()) return NextResponse.json({ error: 'The AI Draft Assistant is currently disabled.' }, { status: 503 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'The AI service is not configured.' }, { status: 503 });
  if (!validOrigin(request)) return NextResponse.json({ error: 'Request origin was not accepted.' }, { status: 403 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Your ScopeLogic session expired. Sign in again.' }, { status: 401 });

  const now = Date.now();
  const current = rateLimit.get(user.id);
  if (!current || current.resetAt <= now) rateLimit.set(user.id, { count: 1, resetAt: now + WINDOW_MS });
  else if (current.count >= MAX_REQUESTS) return NextResponse.json({ error: 'AI drafting limit reached. Wait a few minutes and retry.' }, { status: 429 });
  else current.count += 1;

  let body: DraftRequest;
  try {
    body = await request.json() as DraftRequest;
  } catch {
    return NextResponse.json({ error: 'The AI drafting request was not valid JSON.' }, { status: 400 });
  }

  const prompt = clean(body.prompt, MAX_PROMPT_LENGTH);
  const systems = (Array.isArray(body.systems) ? body.systems : [])
    .map((system) => ({ key: clean(system?.key, 80), label: clean(system?.label, 120) }))
    .filter((system) => system.key && system.label)
    .slice(0, 10);
  if (prompt.length < 10) return NextResponse.json({ error: 'Describe the scope issue in at least 10 characters.' }, { status: 400 });
  if (!systems.length) return NextResponse.json({ error: 'Select at least one affected system before generating a draft.' }, { status: 400 });

  const properties = Object.fromEntries(systems.map((system) => [system.key, { type: 'string' }]));
  const requiredSystems = systems.map((system) => system.key);
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      concern: { type: 'string' },
      rfiQuestion: { type: 'string' },
      recommendations: { type: 'object', additionalProperties: false, properties, required: requiredSystems },
      checklistItems: { type: 'object', additionalProperties: false, properties, required: requiredSystems },
      suggestedAdditionalSystems: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    },
    required: ['title', 'concern', 'rfiQuestion', 'recommendations', 'checklistItems', 'suggestedAdditionalSystems'],
  };

  const existing = body.existing || {};
  const context = {
    userPrompt: prompt,
    selectedSystems: systems,
    documentReference: clean(existing.reference, 1200),
    currentDraft: {
      title: clean(existing.title),
      concern: clean(existing.concern),
      rfiQuestion: clean(existing.rfiQuestion),
      recommendations: Object.fromEntries(systems.map((system) => [system.key, clean(existing.recommendations?.[system.key])])),
      checklistItems: Object.fromEntries(systems.map((system) => [system.key, clean(existing.checklistItems?.[system.key])])),
    },
  };

  const instructions = `You are ScopeLogic's Division 27 and Division 28 scope-review drafting assistant. Draft concise, professional SLR language for a low-voltage consultant reviewing construction contract documents.\n\nRules:\n- Use only facts supplied in the user prompt, selected systems, document reference, and current draft.\n- Never invent drawing numbers, specification sections, addenda, quantities, manufacturers, devices, or contractual facts.\n- Do not create or alter the document reference.\n- Use one shared scope item, one shared scope concern, and one formal RFI question.\n- Create a separate Recommended Bid Basis and Contractor Checklist Scope Item for every selected system.\n- Recommended Bid Basis language should state a reasonable interim scope assumption for apples-to-apples bidding, not claim to be an official design answer.\n- Checklist language should be direct and confirmable by a bidder.\n- Keep each field focused and avoid disclaimers inside the drafted fields.\n- Suggest an additional system only when the supplied facts clearly indicate one; never add it automatically.\n- Preserve useful existing text when it is consistent with the prompt, but improve clarity and completeness.\n- Return only the required structured result.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: false,
        max_output_tokens: 2400,
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: instructions }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'scopelogic_slr_draft',
            description: 'Structured draft fields for one ScopeLogic SLR.',
            strict: true,
            schema,
          },
          verbosity: 'low',
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = clean(payload?.error?.message, 500) || `OpenAI request failed with status ${response.status}.`;
      return NextResponse.json({ error: detail }, { status: response.status >= 500 ? 502 : 400 });
    }
    const text = outputText(payload);
    if (!text) return NextResponse.json({ error: 'The AI service returned no draft content.' }, { status: 502 });

    let draft: any;
    try { draft = JSON.parse(text); } catch { return NextResponse.json({ error: 'The AI service returned an unreadable draft.' }, { status: 502 }); }
    return NextResponse.json({
      draft,
      model: clean(payload?.model || process.env.OPENAI_MODEL || 'gpt-5-mini', 120),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'The AI drafting request timed out. Retry with a shorter prompt.'
      : 'The AI drafting service could not complete the request.';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
