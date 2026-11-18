import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateAnswer } from '../src/server/openai';
const originalFetch = globalThis.fetch;
const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});
function events(items: object[]) {
  return new Response(items.map((item) => `data: ${JSON.stringify(item)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
test('OpenAI streams bounded history and disables provider storage', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false);
    assert.equal(body.stream, true);
    assert.equal(body.max_output_tokens, 1200);
    assert.equal(body.input.length, 14);
    assert.ok(!JSON.stringify(body).includes('test-placeholder'));
    assert.match(body.instructions, /read-only/);
    return events([
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.delta', delta: 'company' },
      { type: 'response.completed', response: { status: 'completed' } },
    ]);
  };
  const chunks: string[] = [];
  const text = await generateAnswer(
    'Help',
    { revenue: 10 },
    Array.from({ length: 20 }, () => ({ role: 'user', text: 'prior' })),
    (s) => chunks.push(s),
  );
  assert.equal(text, 'Hello company');
  assert.deepEqual(chunks, ['Hello ', 'company']);
});
test('OpenAI errors are sanitized and not retried', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json(
      { error: { message: 'PRIVATE upstream content', type: 'invalid_request_error' } },
      { status: 401 },
    );
  };
  await assert.rejects(generateAnswer('Help', {}, []), /AI credentials are invalid/);
  assert.equal(calls, 1);
});
test('OpenAI rejects incomplete streams rather than saving a partial answer', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  globalThis.fetch = async () => events([{ type: 'response.output_text.delta', delta: 'Partial' }]);
  await assert.rejects(generateAnswer('Help', {}, []), /no complete answer/);
});
test('missing OpenAI configuration fails without making an external request', async () => {
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = async () => {
    throw new Error('Should not run');
  };
  await assert.rejects(generateAnswer('Help', {}, []), /AI is not configured/);
});

test('Groq uses its own endpoint/key and streams chat completions', async () => {
  const provider = process.env.AI_PROVIDER,
    key = process.env.GROQ_API_KEY;
  try {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'groq-test-placeholder';
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer groq-test-placeholder');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'openai/gpt-oss-20b');
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.store, undefined);
      return events([
        { choices: [{ delta: { content: 'Groq answer' }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
      ]);
    };
    assert.equal(await generateAnswer('Help', {}, []), 'Groq answer');
    globalThis.fetch = async () =>
      events([{ choices: [{ delta: { content: 'Partial' }, finish_reason: 'length' }] }]);
    await assert.rejects(generateAnswer('Help', {}, []), /could not be completed/);
  } finally {
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
  }
});
test('OpenAI uses follow-up history and checks an assumed balance against fresh results', async () => {
  process.env.OPENAI_API_KEY = 'test-placeholder';
  let round = 0;
  const chunks: string[] = [];
  const call = {
    type: 'function_call',
    call_id: 'call_1',
    name: 'findInvoices',
    arguments: '{"query":"INV-17"}',
  };
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (++round === 1) {
      assert.equal(body.input.at(-2).content, 'Tell me about invoice INV-17.');
      assert.match(body.instructions, /Correct assumptions/);
      assert.ok(body.tools.some((tool: { name: string }) => tool.name === 'findInvoices'));
      return events([
        { type: 'response.output_text.delta', delta: 'Unverified: it is overdue.' },
        { type: 'response.completed', response: { output: [call] } },
      ]);
    }
    assert.equal(body.input.at(-1).call_id, 'call_1');
    assert.deepEqual(JSON.parse(body.input.at(-1).output), {
      count: 1,
      outstanding: '0.00',
      records: [{ status: 'paid' }],
    });
    return events([
      {
        type: 'response.output_text.delta',
        delta: 'INV-17 is paid and has no outstanding balance.',
      },
      { type: 'response.completed', response: { output: [] } },
    ]);
  };
  const answer = await generateAnswer(
    'How much is still overdue on it?',
    {},
    [{ role: 'user', text: 'Tell me about invoice INV-17.' }],
    (text) => chunks.push(text),
    undefined,
    async (name, args) => {
      assert.equal(name, 'findInvoices');
      assert.deepEqual(JSON.parse(args), { query: 'INV-17' });
      return { count: 1, outstanding: '0.00', records: [{ status: 'paid' }] };
    },
  );
  assert.equal(round, 2);
  assert.deepEqual(chunks, [answer]);
  assert.match(answer, /is paid/);
});

test('Groq assembles tool arguments and reports a provider failure after an empty lookup', async () => {
  const provider = process.env.AI_PROVIDER,
    key = process.env.GROQ_API_KEY;
  try {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'test-placeholder';
    let round = 0;
    globalThis.fetch = async (_url, init) => {
      if (++round === 1)
        return events([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_2',
                      function: { name: 'findProducts', arguments: '{"query":' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: { tool_calls: [{ index: 0, function: { arguments: '"missing"}' } }] },
                finish_reason: null,
              },
            ],
          },
          { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        ]);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages.at(-1).tool_call_id, 'call_2');
      assert.deepEqual(JSON.parse(body.messages.at(-1).content), { count: 0, records: [] });
      return Response.json({ error: { message: 'Private provider message' } }, { status: 503 });
    };
    const chunks: string[] = [];
    await assert.rejects(
      generateAnswer(
        'Find missing',
        {},
        [],
        (text) => chunks.push(text),
        undefined,
        async (name, args) => {
          assert.equal(name, 'findProducts');
          assert.deepEqual(JSON.parse(args), { query: 'missing' });
          return { count: 0, records: [] };
        },
      ),
      /AI connection failed or timed out/,
    );
    assert.equal(round, 2);
    assert.deepEqual(chunks, []);
  } finally {
    if (provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = provider;
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
  }
});
