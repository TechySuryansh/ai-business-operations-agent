import './setup';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Records } from '../src/components/modules/records';
import { Workspace } from '../src/components/workspace';
import { Automations, type Draft } from '../src/components/modules/operations';
import { Assistant } from '../src/components/modules/assistant';
import { automations } from '../src/data/mock-data';
import type { Automation } from '../src/types/business';
afterEach(() => {
  cleanup();
  localStorage.clear();
  window.location.hash = '';
});
test('inventory search and low-stock filter combine and show an empty state', () => {
  render(<Records kind="Inventory" onSelect={() => {}} notify={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Low stock' }));
  const table = screen.getByRole('table');
  assert.equal(within(table).getAllByRole('row').length, 4);
  assert.equal(within(table).queryByText('Apple MacBook Air M3'), null);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory...' }), {
    target: { value: 'Keychron' },
  });
  assert.equal(within(table).getAllByRole('row').length, 2);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory...' }), {
    target: { value: 'no-such-product' },
  });
  assert.ok(screen.getByText('No results found'));
});
test('automation prepares a draft and approval updates only the local queue', async () => {
  function Harness() {
    const [items, setItems] = React.useState<Automation[]>(automations);
    const [drafts, setDrafts] = React.useState<Draft[]>([]);
    return (
      <Automations
        items={items}
        setItems={setItems}
        drafts={drafts}
        setDrafts={setDrafts}
        notify={() => {}}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Run demo workflow' })[0]);
  const dialog = screen.getByRole('dialog');
  assert.ok(within(dialog).getByText(/Suggested minimum quantity/));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Approve demo draft' }));
  assert.ok(
    within(dialog).getByRole('button', { name: 'Approved in demo' }).hasAttribute('disabled'),
  );
});
test('navigation and reviewed alert state persist in browser storage', async () => {
  window.location.hash = '#alerts';
  render(<Workspace />);
  assert.ok(screen.getByRole('heading', { name: 'Alerts' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark reviewed' })[0]);
  assert.equal(screen.getAllByRole('button', { name: 'Mark reviewed' }).length, 2);
  await waitFor(() => assert.match(localStorage.getItem('nexus-workspace-v1') ?? '', /ALT-001/));
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', {
      name: 'Inventory',
    }),
  );
  assert.ok(screen.getByRole('heading', { name: 'Inventory' }));
  assert.equal(window.location.hash, '#inventory');
});
test('global search opens the matching product details', () => {
  render(<Workspace />);
  fireEvent.click(screen.getByRole('button', { name: /Search anything/ }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Keychron' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /Keychron K8/ }));
  assert.ok(screen.getByRole('heading', { name: 'Product details' }));
  assert.ok(within(screen.getByRole('dialog')).getByText('KEY-KC-K8'));
});
test('assistant sends a supported question and saves the computed response', async () => {
  render(
    <Assistant initialPrompt="" clearPrompt={() => {}} navigate={() => {}} notify={() => {}} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show overdue invoices' }));
  await waitFor(() => assert.ok(screen.getByText(/3 overdue invoices totaling \$17,850/)), {
    timeout: 2000,
  });
  assert.match(localStorage.getItem('nexus-chat') ?? '', /17,850/);
});

test('table sorts stock numerically and paginates the filtered records', () => {
  render(<Records kind="Inventory" onSelect={() => {}} notify={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
  const table = screen.getByRole('table');
  assert.match(within(table).getAllByRole('row')[1].textContent ?? '', /Keychron/);
  fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), {
    target: { value: '5' },
  });
  assert.equal(within(table).getAllByRole('row').length, 6);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  assert.match(within(table).getAllByRole('row')[1].textContent ?? '', /TP-Link/);
  assert.ok(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'));
});

test('deep-linked invoice payment updates totals and persists after remount', async () => {
  window.location.hash = '#finance?id=INV-1082';
  const first = render(<Workspace />);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Record payment' }),
  );
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm payment' }),
  );
  assert.ok(within(screen.getByRole('dialog')).getAllByText('Paid').length >= 1);
  await waitFor(() =>
    assert.match(localStorage.getItem('nexus-records-v1') ?? '', /Recorded full payment/),
  );
  assert.match(
    localStorage.getItem('nexus-records-v1') ?? '',
    /"id":"INV-1082"[^}]*"status":"Paid"/,
  );
  first.unmount();
  render(<Workspace />);
  assert.ok(within(screen.getByRole('dialog')).getAllByText('Paid').length >= 1);
  assert.ok(screen.getByText('$20,920'));
});

test('customer rename updates related order and invoice references', async () => {
  window.location.hash = '#customers?id=CUS-001';
  render(<Workspace />);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit customer' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Vertex Renamed' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  await waitFor(() => {
    const saved = JSON.parse(localStorage.getItem('nexus-records-v1') ?? '{}');
    assert.equal(
      saved.data.customers.find((c: { id: string }) => c.id === 'CUS-001').name,
      'Vertex Renamed',
    );
    assert.equal(
      saved.data.orders.find((o: { id: string }) => o.id === 'ORD-2048').customer,
      'Vertex Renamed',
    );
    assert.equal(
      saved.data.invoices.find((i: { id: string }) => i.id === 'INV-1082').customer,
      'Vertex Renamed',
    );
  });
});

test('new customer validation rejects whitespace and valid creation persists', async () => {
  window.location.hash = '#customers';
  render(<Workspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Add customer' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: '  ' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Contact name' }), {
    target: { value: 'Mira Shah' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), {
    target: { value: 'mira@example.com' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Location' }), {
    target: { value: 'Mumbai' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  assert.match(screen.getByRole('alert').textContent ?? '', /required field/);
  fireEvent.change(screen.getByRole('textbox', { name: 'Company name' }), {
    target: { value: 'Mira Electronics' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Mira Electronics' })));
  assert.match(localStorage.getItem('nexus-records-v1') ?? '', /Mira Electronics/);
});

test('alert history supports restoration and snoozing', async () => {
  window.location.hash = '#alerts';
  render(<Workspace />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark reviewed' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Reviewed & snoozed' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore alert' }));
  fireEvent.click(screen.getByRole('button', { name: 'Active (3)' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Snooze 1 hour' })[0]);
  assert.equal(screen.getAllByRole('button', { name: 'Mark reviewed' }).length, 2);
  await waitFor(() =>
    assert.match(localStorage.getItem('nexus-workspace-v1') ?? '', /"snoozed":\{"ALT-001":/),
  );
});

test('alert action opens the affected inventory filter', async () => {
  window.location.hash = '#alerts';
  render(<Workspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Review inventory' }));
  await waitFor(() =>
    assert.equal(
      screen.getByRole('button', { name: 'Low stock' }).getAttribute('aria-pressed'),
      'true',
    ),
  );
  assert.equal(within(screen.getByRole('table')).getAllByRole('row').length, 4);
  assert.match(window.location.hash, /status=Low%20stock/);
});

test('saved table views restore search and filter after reload', async () => {
  window.location.hash = '#inventory';
  const first = render(<Workspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Low stock' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory...' }), {
    target: { value: 'Keychron' },
  });
  fireEvent.click(screen.getByText('View options', { selector: 'summary' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Saved view name' }), {
    target: { value: 'Keyboards to reorder' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save view' }));
  first.unmount();
  window.location.hash = '#inventory';
  render(<Workspace />);
  fireEvent.click(screen.getByText('View options', { selector: 'summary' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Load saved view' }), {
    target: { value: 'Keyboards to reorder' },
  });
  assert.equal(
    screen.getByRole('button', { name: 'Low stock' }).getAttribute('aria-pressed'),
    'true',
  );
  assert.equal(
    (screen.getByRole('textbox', { name: 'Search inventory...' }) as HTMLInputElement).value,
    'Keychron',
  );
});

test('workflow drafts support editing and rejection with a required reason', () => {
  function Harness() {
    const [items, setItems] = React.useState<Automation[]>(automations);
    const [drafts, setDrafts] = React.useState<Draft[]>([]);
    return (
      <Automations
        items={items}
        setItems={setItems}
        drafts={drafts}
        setDrafts={setDrafts}
        notify={() => {}}
      />
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Run demo workflow' })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Draft content' }), {
    target: { value: 'Updated purchase draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  assert.ok(screen.getByText('Updated purchase draft'));
  assert.ok(screen.getByRole('button', { name: 'Reject draft' }).hasAttribute('disabled'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for rejection' }), {
    target: { value: 'Confirm supplier pricing first' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reject draft' }));
  assert.ok(screen.getByRole('button', { name: 'Rejected' }).hasAttribute('disabled'));
  assert.ok(screen.getByText(/Draft rejected$/));
});

test('assistant inherits the reporting period and archives conversations', () => {
  render(
    <Assistant
      days={7}
      initialPrompt=""
      clearPrompt={() => {}}
      navigate={() => {}}
      notify={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'How is my business doing?' }));
  assert.ok(
    within(screen.getByRole('log', { name: 'Conversation' })).getByText(/November 8–14, 2026/),
  );
  assert.ok(screen.getByText(/\$79,900/));
  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
  assert.ok(screen.getByRole('combobox', { name: 'Open saved conversation' }));
  assert.match(localStorage.getItem('nexus-conversations') ?? '', /79,900/);
});

test('report builder filters invoices and rejects a reversed date range', async () => {
  window.location.hash = '#reports';
  render(<Workspace />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Report dataset' }), {
    target: { value: 'Finance' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), {
    target: { value: 'Overdue' },
  });
  assert.equal(within(screen.getByRole('table')).getAllByRole('row').length, 4);
  assert.ok(screen.getByText('$17,850 total value'));
  fireEvent.change(screen.getByLabelText('Issue date from'), { target: { value: '2026-11-14' } });
  fireEvent.change(screen.getByLabelText('Issue date to'), { target: { value: '2026-10-01' } });
  assert.match(screen.getByRole('alert').textContent ?? '', /end date/);
  assert.ok(screen.getByRole('button', { name: 'Download XLSX' }).hasAttribute('disabled'));
});
