import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { command } from '../../src/server/services';
import { mutation } from '../../src/server/transaction';
import { archiveDraft, listArchivedDrafts } from '../../src/server/draft-archive';
import { enqueueRecurringWorkflows } from '../../src/server/recurring-workflows';
import { enqueue, processJob, reviewDraft, toggleWorkflow } from '../../src/server/jobs';
import { ask } from '../../src/server/assistant';
import { snapshot } from '../../src/server/read-model';
import { listRecords, mutationPatch, dailySales } from '../../src/server/ledger-query';
import { companyTools } from '../../src/server/assistant-tools';
import { assistantContext } from '../../src/server/assistant-context';
import type { Scope } from '../../src/server/auth';
import { verifyLedger } from '../../scripts/integrity.mjs';
async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: directory,
    port: 55439,
    user: 'postgres',
    password: 'local-test-only',
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  let client: PrismaClient | undefined;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('nexus_test');
    process.env.DATABASE_URL = 'postgresql://postgres:local-test-only@127.0.0.1:55439/nexus_test';
    const sql = pg.getPgClient('nexus_test');
    await sql.connect();
    await sql.query(await readFile('prisma/migrations/202611160001_initial/migration.sql', 'utf8'));
    await sql.end();
    client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const userId = crypto.randomUUID();
    await client.user.create({ data: { id: userId, email: 'test@example.invalid' } });
    const company = await client.company.create({ data: { name: 'Test company' } });
    const other = await client.company.create({ data: { name: 'Other company' } });
    const s: Scope = { companyId: company.id, userId, role: 'owner', timeZone: 'UTC' };
    await client.membership.create({ data: { userId, companyId: company.id, role: 'owner' } });
    const run = (action: string, payload: unknown, key = crypto.randomUUID()) =>
      mutation(s, key, action, payload, (tx) => command(tx, s, action, payload)) as Promise<any>;
    const customer = await run('customer.save', {
      name: 'Acme',
      contact: 'Test',
      email: 'acme@example.invalid',
      location: 'Test city',
      status: 'Active',
    });
    const product = await run('product.save', {
      name: 'Widget',
      category: 'Parts',
      sku: 'W1',
      price: '10.25',
      reorder: 2,
      supplier: 'Supplier',
      stock: 5,
      reason: 'Opening stock',
    });
    const orderKey = crypto.randomUUID(),
      orderPayload = { customerId: customer.id, lines: [{ productId: product.id, quantity: 2 }] };
    const order = await run('order.create', orderPayload, orderKey);
    assert.equal(order.total, '20.5');
    assert.equal((await run('order.create', orderPayload, orderKey)).id, order.id);
    assert.equal((await client.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    await assert.rejects(
      run('order.create', {
        customerId: customer.id,
        lines: [{ productId: product.id, quantity: 20 }],
      }),
    );
    assert.equal(await client.order.count(), 1);
    const foreign = await client.customer.create({
      data: {
        companyId: other.id,
        name: 'Other',
        contact: 'Other',
        email: 'other@example.invalid',
        location: 'Other',
      },
    });
    await assert.rejects(
      run('order.create', {
        customerId: foreign.id,
        lines: [{ productId: product.id, quantity: 1 }],
      }),
    );
    await assert.rejects(
      client.order.create({
        data: { companyId: company.id, customerId: foreign.id, number: 'BAD', total: 1 },
      }),
    );
    await assert.rejects(
      mutation({ ...s, role: 'staff' }, crypto.randomUUID(), 'order.create', orderPayload, (tx) =>
        command(tx, { ...s, role: 'staff' }, 'order.create', orderPayload),
      ),
    );
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 10);
    const invoice = await run('invoice.create', {
      orderId: order.id,
      due: due.toISOString().slice(0, 10),
    });
    await assert.rejects(
      run('invoice.create', { orderId: order.id, due: due.toISOString().slice(0, 10) }),
    );
    await run('payment.create', {
      id: invoice.id,
      version: 1,
      amount: '5.25',
      reference: 'BANK-1',
    });
    await assert.rejects(
      run('payment.create', { id: invoice.id, version: 2, amount: '99', reference: 'BANK-2' }),
    );
    await run('payment.create', {
      id: invoice.id,
      version: 2,
      amount: '15.25',
      reference: 'BANK-3',
    });
    const snap = await snapshot(s);
    assert.equal(snap.data.invoices[0].status, 'Paid');
    assert.equal(snap.data.invoices[0].outstanding, 0);
    const payment = await client.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await run('payment.reverse', {
      id: invoice.id,
      version: 3,
      paymentId: payment.id,
      reason: 'Incorrect reference',
    });
    assert.equal((await snapshot(s)).data.invoices[0].status, 'Pending');
    await assert.rejects(run('invoice.void', { id: invoice.id, version: 4 }));
    const lookup = companyTools(s, 7);
    const sale = await lookup('getSalesSummary', '{}');
    assert.ok(sale && 'bookedSales' in sale && sale.bookedSales === '20.50');
    const balance = await lookup(
      'findInvoices',
      JSON.stringify({ query: invoice.id, status: 'pending' }),
    );
    assert.ok(
      balance && 'outstanding' in balance && Number(balance.outstanding) === Number(payment.amount),
    );
    const missing = await lookup('findProducts', JSON.stringify({ query: 'missing sku' }));
    assert.ok(missing && 'records' in missing && missing.records?.length === 0);
    const productResult = await lookup('findProducts', JSON.stringify({ query: product.id }));
    assert.ok(productResult && 'records' in productResult && productResult.records?.length === 1);
    assert.deepEqual(await lookup('findInvoices', '{"companyId":"foreign"}'), {
      error: 'Invalid tool arguments. Use only the documented fields and values.',
    });
    for (const name of ['findInvoices', 'getSalesSummary', 'findProducts', 'getTopCustomers']) {
      await assert.rejects(
        companyTools({ ...s, companyId: other.id }, 7)(name, '{}'),
        /do not have access/,
      );
    }
    const attempts = await Promise.allSettled([
      run('order.create', {
        customerId: customer.id,
        lines: [{ productId: product.id, quantity: 2 }],
      }),
      run('order.create', {
        customerId: customer.id,
        lines: [{ productId: product.id, quantity: 2 }],
      }),
    ]);
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await client.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 1);
    const cancellable = (
      attempts.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>
    ).value;
    await run('order.status', { id: cancellable.id, version: 1, status: 'Cancelled' });
    assert.equal((await client.product.findUniqueOrThrow({ where: { id: product.id } })).stock, 3);
    await assert.rejects(
      run('order.status', { id: cancellable.id, version: 2, status: 'Cancelled' }),
    );
    await assert.rejects(
      run('product.save', {
        id: product.id,
        version: 1,
        name: 'Stale',
        category: 'Parts',
        sku: 'W1',
        price: '10.25',
        reorder: 2,
        supplier: 'Supplier',
      }),
    );
    assert.equal((await snapshot({ ...s, companyId: other.id })).data.orders.length, 0);
    const repeatKey = crypto.randomUUID();
    const concurrent = await Promise.all([
      run(
        'customer.save',
        {
          name: 'Repeated',
          contact: 'A',
          email: 'r@example.invalid',
          location: 'City',
          status: 'Active',
        },
        repeatKey,
      ),
      run(
        'customer.save',
        {
          name: 'Repeated',
          contact: 'A',
          email: 'r@example.invalid',
          location: 'City',
          status: 'Active',
        },
        repeatKey,
      ),
    ]);
    assert.equal(concurrent[0].id, concurrent[1].id);
    const job = await enqueue(s, { key: crypto.randomUUID(), kind: 'Inventory' });
    await processJob(job.id);
    await processJob(job.id);
    let workspace = await client.workspaceState.findUniqueOrThrow({
      where: { companyId: company.id },
    });
    assert.equal((workspace.data as any).drafts.length, 1);
    const reviewKey = crypto.randomUUID();
    const review = {
      id: job.id,
      version: workspace.version,
      status: 'Approved',
      body: 'Reviewed inventory request',
    };
    const reviewed = await reviewDraft(s, review, reviewKey);
    assert.deepEqual(await reviewDraft(s, review, reviewKey), reviewed);
    assert.equal((reviewed as { version: number }).version, workspace.version + 1);
    workspace = await client.workspaceState.findUniqueOrThrow({ where: { companyId: company.id } });
    await assert.rejects(
      reviewDraft(s, {
        id: job.id,
        version: workspace.version,
        status: 'Rejected',
        body: 'Changed',
        reason: 'Changed mind',
      }),
    );
    const archiveKey = crypto.randomUUID();
    const archiveInput = { id: job.id, version: workspace.version };
    await assert.rejects(archiveDraft({ ...s, role: 'staff' }, archiveInput, archiveKey));
    const archived = await archiveDraft(s, archiveInput, archiveKey);
    assert.deepEqual(await archiveDraft(s, archiveInput, archiveKey), archived);
    const archivePage = await listArchivedDrafts(s, null);
    assert.equal(archivePage.drafts.length, 1);
    assert.match(JSON.stringify(archivePage.drafts[0]), /Reviewed inventory request/);
    assert.match(JSON.stringify(archivePage.drafts[0]), /Approved/);
    assert.deepEqual((await listArchivedDrafts({ ...s, companyId: other.id }, null)).drafts, []);
    workspace = await client.workspaceState.findUniqueOrThrow({ where: { companyId: company.id } });
    assert.deepEqual((workspace.data as any).drafts, []);
    await client.company.update({ where: { id: company.id }, data: { timeZone: 'Asia/Kolkata' } });
    assert.equal(await enqueueRecurringWorkflows(new Date('2025-01-06T04:00:00Z')), 0);
    assert.equal(await enqueueRecurringWorkflows(new Date('2025-01-06T03:00:00Z')), 0);
    const configured = await toggleWorkflow(s, {
      kind: 'Inventory',
      enabled: true,
      schedule: 'weekly',
      version: workspace.version,
    });
    assert.equal(await enqueueRecurringWorkflows(new Date('2025-01-06T03:20:00Z')), 0);
    assert.equal(await enqueueRecurringWorkflows(new Date('2025-01-07T04:00:00Z')), 0);
    const monday = new Date('2025-01-06T03:30:00Z');
    const ticks = await Promise.all([
      enqueueRecurringWorkflows(monday),
      enqueueRecurringWorkflows(monday),
    ]);
    assert.equal(
      ticks.reduce((sum, count) => sum + count, 0),
      1,
    );
    const occurrence = await client.job.findUniqueOrThrow({
      where: { companyId_key: { companyId: company.id, key: 'recurring:Inventory:2025-01-06' } },
    });
    await toggleWorkflow(s, {
      kind: 'Inventory',
      enabled: false,
      version: (configured as { version: number }).version,
    });
    await processJob(occurrence.id);
    assert.equal(
      (await client.job.findUniqueOrThrow({ where: { id: occurrence.id } })).status,
      'skipped',
    );
    const paused = await client.workspaceState.findUniqueOrThrow({
      where: { companyId: company.id },
    });
    assert.deepEqual((paused.data as any).drafts, []);
    await client.company.update({ where: { id: company.id }, data: { timeZone: 'UTC' } });
    const low = await run('product.save', {
      name: 'Recurring test product',
      category: 'Parts',
      sku: 'REC-1',
      price: '2.00',
      reorder: 2,
      supplier: 'Test supplier',
      stock: 0,
    });
    await toggleWorkflow(s, {
      kind: 'Inventory',
      enabled: true,
      schedule: 'daily',
      version: paused.version,
    });
    assert.equal(await enqueueRecurringWorkflows(new Date('2025-01-07T09:00:00Z')), 1);
    const daily = await client.job.findUniqueOrThrow({
      where: { companyId_key: { companyId: company.id, key: 'recurring:Inventory:2025-01-07' } },
    });
    const generated = await processJob(daily.id);
    assert.equal(generated?.status, 'completed');
    assert.match(JSON.stringify(generated.result), /Needs review/);
    assert.equal((await client.product.findUniqueOrThrow({ where: { id: low.id } })).stock, 0);
    // Paginated projections and deltas must agree with the complete ledger.
    const full = await snapshot(s);
    for (const type of ['customers', 'products', 'orders', 'invoices'] as const) {
      const page = await listRecords(s, new URL(`http://test/records?type=${type}&size=1`));
      assert.equal(page.total, full.data[type].length);
      assert.ok(page.rows.length <= 1);
      if (page.rows.length) {
        const projected = page.rows[0] as any;
        const original = full.data[type].find((r) => r.id === projected.id) as any;
        for (const field of [
          'name',
          'stock',
          'amount',
          'outstanding',
          'paid',
          'revenue',
          'orders',
          'sold',
          'date',
          'due',
          'issued',
          'items',
        ]) {
          if (field in original)
            assert.deepEqual(projected[field], original[field], `${type}.${field}`);
        }
      }
      const isolated = await listRecords(
        { ...s, companyId: other.id },
        new URL(`http://test/records?type=${type}`),
      );
      assert.ok(isolated.rows.every((row) => !full.data[type].some((own) => own.id === row.id)));
    }
    await assert.rejects(
      listRecords(s, new URL('http://test/records?type=products&sort=stock;DROP TABLE')),
    );
    await assert.rejects(
      listRecords(s, new URL('http://test/records?type=products&page=Infinity')),
    );
    const noMatch = await listRecords(
      s,
      new URL('http://test/records?type=products&q=does-not-exist'),
    );
    assert.equal(noMatch.total, 0);
    assert.deepEqual(noMatch.rows, []);
    const oldCustomer = await client.customer.findUniqueOrThrow({ where: { id: customer.id } });
    const renamed = await run('customer.save', {
      id: customer.id,
      version: oldCustomer.version,
      name: 'Renamed account',
      contact: oldCustomer.contact,
      email: oldCustomer.email,
      location: oldCustomer.location,
      status: oldCustomer.status,
    });
    const patch = await mutationPatch(s, 'customer.save', renamed);
    assert.equal(patch.data.customers[0].name, 'Renamed account');
    assert.ok(patch.data.orders.every((o) => o.customer === 'Renamed account'));
    assert.ok(patch.data.invoices.every((i) => i.customer === 'Renamed account'));
    assert.equal(patch.data.products.length, 0);
    const series = await dailySales(s);
    assert.deepEqual(
      series.map(({ date, revenue, orders }) => ({ date, revenue, orders })),
      full.data.dailySales.map(({ date, revenue, orders }) => ({ date, revenue, orders })),
    );
    const inventoryContext = await assistantContext(s, 'Which products need restocking?', 7, []);
    assert.ok('inventory' in inventoryContext.context);
    assert.ok(!('finance' in inventoryContext.context));
    assert.ok(!('customers' in inventoryContext.context));
    const followup = await assistantContext(s, 'Explain those', 7, [
      { role: 'user', text: 'Which invoices are overdue?' },
    ]);
    assert.ok('finance' in followup.context);
    assert.ok(!('inventory' in followup.context));
    const pageCompany = await client.company.create({ data: { name: 'Pagination test' } });
    await client.customer.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({
        companyId: pageCompany.id,
        name: `Account ${String(i).padStart(3, '0')}`,
        contact: 'Test',
        email: 'test@example.invalid',
        location: 'Test',
        status: i % 2 ? 'Inactive' : 'Active',
      })),
    });
    const pagingScope = { ...s, companyId: pageCompany.id };
    const first = await listRecords(
      pagingScope,
      new URL('http://test/records?type=customers&size=10&sort=name'),
    );
    const second = await listRecords(
      pagingScope,
      new URL('http://test/records?type=customers&size=10&sort=name&page=2'),
    );
    assert.equal(first.total, 105);
    assert.equal(first.rows.length, 10);
    assert.ok(second.rows.every((row) => !first.rows.some((r) => r.id === row.id)));
    const filtered = await listRecords(
      pagingScope,
      new URL(
        'http://test/records?type=customers&status=Active&q=Account&sort=name&direction=desc',
      ),
    );
    assert.equal(filtered.total, 53);
    assert.equal((filtered.rows[0] as any).name, 'Account 104');
    const timezoneScope = { ...s, timeZone: 'Asia/Kolkata' };
    const timezoneSnapshot = await snapshot(timezoneScope),
      timezoneSeries = await dailySales(timezoneScope);
    assert.deepEqual(
      timezoneSeries.map(({ date, revenue, orders }) => ({ date, revenue, orders })),
      timezoneSnapshot.data.dailySales.map(({ date, revenue, orders }) => ({
        date,
        revenue,
        orders,
      })),
    );
    const assistantRequest = {
      prompt: 'What is our revenue?',
      days: 7,
      requestId: crypto.randomUUID(),
    };
    const conversation = await ask(s, assistantRequest);
    assert.ok(conversation);
    assert.equal((await ask(s, assistantRequest))!.id, conversation!.id);
    await assert.rejects(
      ask(
        { ...s, userId: crypto.randomUUID() },
        { ...assistantRequest, requestId: crypto.randomUUID(), conversationId: conversation!.id },
      ),
    );
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.OPENAI_API_KEY;
    let modelCalls = 0;
    try {
      process.env.OPENAI_API_KEY = 'test-placeholder';
      globalThis.fetch = async (_url, init) => {
        modelCalls++;
        const request = JSON.parse(String(init?.body));
        assert.ok(!JSON.stringify(request).includes('test@example.invalid'));
        return new Response(
          [
            { type: 'response.output_text.delta', delta: 'Grounded test answer' },
            { type: 'response.completed', response: { status: 'completed' } },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(''),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        );
      };
      const request = { prompt: 'Explain my company', days: 7, requestId: crypto.randomUUID() };
      const chunks: string[] = [];
      const result = await ask(s, request, (delta) => chunks.push(delta));
      assert.equal(chunks.join(''), 'Grounded test answer');
      assert.equal((result!.messages as any[]).at(-1).text, 'Grounded test answer');
      await ask(s, request);
      assert.equal(modelCalls, 1, 'A completed retry must not call the model again');
      await assert.rejects(
        ask(
          { ...s, companyId: other.id },
          { ...request, requestId: crypto.randomUUID(), conversationId: result!.id },
        ),
      );
      assert.equal(modelCalls, 1, 'Unauthorized conversation must fail before the provider call');
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalKey;
    }
    const integrityClient = pg.getPgClient('nexus_test');
    try {
      await integrityClient.connect();
      const checked = await verifyLedger(integrityClient);
      assert.equal(checked.tables, 17);
      assert.equal(checked.integrityChecks, 6);
      // Prove the restore checks detect an inconsistent ledger, not just empty schemas.
      await integrityClient.query('BEGIN');
      await integrityClient.query(`UPDATE erp."Order" SET total = total + 1 WHERE id = $1`, [
        order.id,
      ]);
      await assert.rejects(verifyLedger(integrityClient), /integrity checks failed/);
      await integrityClient.query('ROLLBACK');
    } finally {
      await integrityClient.end();
    }
    console.log(
      'PostgreSQL integration checks passed: migration, constraints, order/payment lifecycle, rollback, idempotency, concurrent stock, cancellation, stale versions, tenant scope and staff permissions.',
    );
  } finally {
    await client?.$disconnect();
    const { db } = await import('../../src/server/db');
    try {
      await db().$disconnect();
    } catch {}
    await pg.stop();
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
