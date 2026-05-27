import type { ActivityItem } from '@/types/job';

export const mockActivity: ActivityItem[] = [
  { id: '1', type: 'ASSIGNMENT', description: 'Guardian Jean-Marie started duty at Kigali Heights',    timestamp: '2 min ago' },
  { id: '2', type: 'REQUEST',    description: 'New request from Bank of Kigali — high priority',       timestamp: '8 min ago' },
  { id: '3', type: 'BILLING',    description: 'Invoice RWF 85,000 generated for Serena Hotel',         timestamp: '24 min ago' },
  { id: '4', type: 'INCIDENT',   description: 'Incident reported — suspicious activity, MTN Centre',   timestamp: '1 hr ago' },
  { id: '5', type: 'COMPLETED',  description: 'Assignment completed — lobby patrol, RDB offices',      timestamp: '2 hrs ago' },
];
