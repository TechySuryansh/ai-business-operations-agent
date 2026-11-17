export const automations = [
  {
    id: 'AUTO-001',
    title: 'Low stock purchase drafts',
    description:
      'Prepare a purchase order draft when inventory falls below a product’s reorder level.',
    category: 'Inventory',
    lastRun: 'Never',
    runs: 0,
    enabled: true,
  },
  {
    id: 'AUTO-002',
    title: 'Overdue payment reminders',
    description: 'Draft a friendly payment reminder for invoices overdue by more than 7 days.',
    category: 'Finance',
    lastRun: 'Never',
    runs: 0,
    enabled: true,
  },
  {
    id: 'AUTO-003',
    title: 'Customer re-engagement',
    description: 'Prepare a personalized follow-up for customers inactive for 60 days.',
    category: 'Sales',
    lastRun: 'Never',
    runs: 0,
    enabled: false,
  },
];
