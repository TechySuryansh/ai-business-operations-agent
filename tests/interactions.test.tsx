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
