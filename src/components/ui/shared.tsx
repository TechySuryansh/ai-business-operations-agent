import { ArrowUpRight, Search, FileSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'green' | 'red' | 'amber' | 'blue' | 'neutral' | 'purple';
}) {
  return (
    <span className={cn('badge', `badge-${tone}`)}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const tone = ['Paid', 'Delivered', 'Active', 'Healthy'].includes(status)
    ? 'green'
    : ['Overdue', 'Critical', 'Low stock', 'Inactive'].includes(status)
      ? 'red'
      : ['Pending', 'Warning', 'Processing'].includes(status)
        ? 'amber'
        : 'blue';
  return <Badge tone={tone}>{status}</Badge>;
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search">
          ×
        </button>
      )}
    </div>
  );
}
export function Empty({
  title = 'No results found',
  description = 'Try a different search or filter.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty">
      <FileSearch size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
