import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { command } from '../../src/server/services';
import { mutation } from '../../src/server/transaction';
import { enqueue, processJob, reviewDraft } from '../../src/server/jobs';
import { ask } from '../../src/server/assistant';
import { snapshot } from '../../src/server/read-model';
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
    await reviewDraft(s, {
      id: job.id,
      version: workspace.version,
      status: 'Approved',
      body: 'Reviewed inventory request',
    });
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
