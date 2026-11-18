# OpenAI assistant setup

The live workspace now supports the OpenAI Responses API with streamed text. The demo remains local and deterministic. No credential from chat was copied into the repository or used.

1. Revoke the key shared in chat using the OpenAI dashboard's API keys page. Create a replacement with access to the Responses API.
2. Put the replacement only in `backend/.env`:

   ```env
   OPENAI_API_KEY=YOUR_NEW_KEY
   OPENAI_MODEL=gpt-4.1-mini
   ```

3. Ensure the OpenAI project has API billing/credits and access to the selected model. ChatGPT subscriptions do not configure your app's API account.
4. Restart `npm run dev`. Open `http://127.0.0.1:3000`, sign in, and open AI Assistant in your live company (not `/demo`).
5. Ask “How is my business doing?” followed by “Explain that more simply.” Watch the response appear progressively. Refresh and reopen the saved conversation.
6. Compare an overdue-invoice or inventory answer with the corresponding ledger. An empty company should produce an empty-data explanation, not invented records.
7. On Render, add these two variables to **nexus-backend → Environment**, then redeploy the backend. Do not add the API key to frontend settings or any NEXT_PUBLIC variable.

## Behavior and limits

- No key: existing ledger-rule answers remain available, labeled “AI not configured” in the answer source.
- With a key: the backend sends company identity, backend-calculated metrics, counts, up to 20 low-stock products, overdue invoices and top customers, and the last 12 chat turns. Contact emails, credentials and the raw full ledger are not included. Questions requiring omitted records should report that limitation.
- The assistant now loads topic-specific aggregates and capped record lists instead of the full ledger snapshot. See PERFORMANCE_CHANGES.md for the remaining initial-workspace loading boundary.
- Company membership and conversation ownership are checked by the backend. The model has no database credentials or write tools.
- Answers stream but are saved only on successful completion. Interrupted responses show an error; retry uses the same request ID. Concurrent duplicate requests can still incur multiple provider calls before one saved response wins.
- `store: false` is sent to OpenAI; this is not a promise of zero provider retention. Follow your organization's data-sharing requirements.
- Provider calls have a bounded timeout, no automatic retries and a 1,200-token output cap. Existing API rate limits remain. Model output needs review and is not guaranteed factually correct.
- No live OpenAI call was made with the exposed key. Automated tests mock the provider; a real login-and-chat check is required after setting a replacement key.

Official references: [Quickstart](https://developers.openai.com/api/docs/quickstart), [streaming](https://developers.openai.com/api/docs/guides/streaming-responses), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

## Using Groq instead

The backend also supports Groq through its [OpenAI-compatible endpoint](https://console.groq.com/docs/openai). Set these variables only in `backend/.env` (and the backend service Environment settings for production):

```env
AI_PROVIDER=groq
GROQ_API_KEY=YOUR_GROQ_KEY
GROQ_MODEL=openai/gpt-oss-20b
```

Restart the backend after changing providers. The model ID contains `openai/` but requests go to Groq, using Groq's key and limits. OpenAI billing is not used for this configuration. Set `AI_PROVIDER=openai` to return to the existing OpenAI integration. Provider switching is explicit; failed Groq requests do not silently fall back to OpenAI. Both providers preserve the same scoped context, read-only behavior, saved conversations, streaming, and error handling. Groq uses Chat Completions; the OpenAI-specific `store: false` setting above applies only to OpenAI Responses requests.
