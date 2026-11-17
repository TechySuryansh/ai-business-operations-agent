'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './backend-client';
import * as seed from '@/data/mock-data';
import type { Customer, Product, Order, Invoice } from '@/types/business';
export interface BusinessData {
  live?: boolean;
  dailySales?: { date?: string; day: string; revenue: number; previous: number; orders: number }[];
  customers: Customer[];
  products: Product[];
  orders: Order[];
  invoices: Invoice[];
}
export interface AuditEntry {
  id: string;
  at: string;
  message: string;
}
export const initialData: BusinessData = {
  customers: seed.customers,
  products: seed.products,
  orders: seed.orders,
  invoices: seed.invoices,
};
export type BusinessRecord = Customer | Product | Order | Invoice;
export type Collection = 'customers' | 'products' | 'orders' | 'invoices';
export interface LiveBootstrap {
  workspace?: { data: unknown; version: number } | null;
  data: BusinessData;
  audit: AuditEntry[];
  company: { id: string; name: string; timeZone: string; currency: string };
  role: string;
  businessDate: string;
}
export const snapshotDate = '2026-11-14';
export function validData(value: unknown): value is BusinessData {
  if (!value || typeof value !== 'object') return false;
  const d = value as BusinessData;
  return (
    (Object.keys(initialData) as Collection[]).every(
      (key) =>
        Array.isArray(d[key]) &&
        new Set(d[key].map((r) => r?.id)).size === d[key].length &&
        d[key].every((row) => {
          if (!row || typeof row !== 'object') return false;
          return Object.entries(initialData[key][0]).every(([field, sample]) => {
            const v = (row as unknown as Record<string, unknown>)[field];
            if (typeof v !== typeof sample) return false;
            if (typeof v === 'number')
              return (
                Number.isFinite(v) &&
                v >= 0 &&
                (!['stock', 'reorder', 'sold', 'items', 'orders'].includes(field) ||
                  Number.isInteger(v))
              );
            if (typeof v !== 'string' || !v.trim()) return false;
            if (['date', 'due', 'issued', 'lastOrder'].includes(field))
              return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
            if (field === 'status')
              return (
                key === 'customers'
                  ? ['Active', 'Inactive']
                  : key === 'orders'
                    ? ['Processing', 'Shipped', 'Delivered']
                    : ['Paid', 'Pending', 'Overdue']
              ).includes(v);
            return true;
          });
        }),
    ) &&
    d.orders.every((o) => d.customers.some((c) => c.name === o.customer)) &&
    d.invoices.every((i) => d.customers.some((c) => c.name === i.customer))
  );
}
const Context = createContext({
  live: undefined as LiveBootstrap | undefined,
  execute: async (_action: string, _payload: unknown, _key?: string): Promise<unknown> => undefined,
  refresh: async () => {},
  data: initialData,
  companyName: seed.company.name,
  audit: [] as AuditEntry[],
  storageError: '',
  save: (_key: Collection, _record: BusinessRecord, _message: string) => {},
  reset: () => {},
});
export function BusinessProvider({
  children,
  live: initialLive,
}: {
  children: ReactNode;
  live?: LiveBootstrap;
}) {
  const [live, setLive] = useState(initialLive);
  const [data, setData] = useState(live?.data ?? initialData);
  const [audit, setAudit] = useState<AuditEntry[]>(live?.audit ?? []);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    if (live) {
      setLoaded(true);
      return;
    }
    try {
      const raw = localStorage.getItem('nexus-records-v1');
      if (raw) {
        const saved = JSON.parse(raw);
        if (validData(saved.data)) {
          setData(saved.data);
          if (Array.isArray(saved.audit))
            setAudit(
              saved.audit
                .filter(
                  (e: AuditEntry) =>
                    e &&
                    typeof e.id === 'string' &&
                    typeof e.at === 'string' &&
                    typeof e.message === 'string',
                )
                .slice(0, 100),
            );
        } else
          setStorageError(
            'Saved records could not be read. Original samples are shown. Reset demo data to clear the invalid save.',
          );
      }
    } catch {
      setStorageError(
        'Browser storage is unavailable or invalid. Changes may last only for this session.',
      );
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded && !live)
      try {
        localStorage.setItem('nexus-records-v1', JSON.stringify({ data, audit }));
      } catch {
        setStorageError(
          'Records could not be saved on this device. Keep this tab open to retain session changes.',
        );
      }
  }, [data, audit, loaded]);
  const refresh = async () => {
    if (!live) return;
    const result = await api<LiveBootstrap>(`${live.company.id}/snapshot`);
    setData(result.data);
    setAudit(result.audit);
    setLive({ ...live, ...result, workspace: live.workspace });
    setStorageError('');
  };
  const execute = async (action: string, payload: unknown, key?: string) => {
    if (!live) throw new Error('Live backend is not connected.');
    const result = await api(`${live.company.id}/command`, { action, payload }, key);
    try {
      await refresh();
    } catch {
      setStorageError(
        'Saved successfully, but the updated ledger could not be loaded. Refresh before making another change.',
      );
    }
    return result;
  };
  const save = (key: Collection, record: BusinessRecord, message: string) => {
    if (live) throw new Error('Use the live transaction form to save this record.');
    setData((prev) => {
      const next = {
        ...prev,
        [key]: prev[key].some((r) => r.id === record.id)
          ? prev[key].map((r) => (r.id === record.id ? record : r))
          : [record, ...prev[key]],
      } as BusinessData;
      if (key === 'customers' && 'name' in record) {
        const old = prev.customers.find((c) => c.id === record.id);
        if (old && old.name !== record.name) {
          next.orders = next.orders.map((o) =>
            o.customer === old.name ? { ...o, customer: record.name } : o,
          );
          next.invoices = next.invoices.map((i) =>
            i.customer === old.name ? { ...i, customer: record.name } : i,
          );
        }
      }
      return next;
    });
    setAudit((prev) =>
      [{ id: crypto.randomUUID(), at: new Date().toISOString(), message }, ...prev].slice(0, 100),
    );
  };
  return (
    <Context.Provider
      value={{
        data,
        live,
        refresh,
        execute,
        audit,
        storageError,
        companyName: seed.company.name,
        save,
        reset: () => {
          if (live) return;
          setData(initialData);
          setAudit([]);
          setStorageError('');
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
const Identity = createContext({ name: seed.company.name, timeZone: 'UTC' });
export function WorkspaceIdentity({
  name,
  timeZone = 'UTC',
  children,
}: {
  name: string;
  timeZone?: string;
  children: ReactNode;
}) {
  return <Identity.Provider value={{ name, timeZone }}>{children}</Identity.Provider>;
}
export function useBusiness() {
  const context = useContext(Context);
  const identity = useContext(Identity);
  return {
    ...context,
    companyName: identity.name,
    timeZone: identity.timeZone,
    formatTime: (at: string) => {
      if (Number.isNaN(Date.parse(at))) return at;
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: identity.timeZone,
      }).format(new Date(at));
    },
  };
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
export const exportName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';
