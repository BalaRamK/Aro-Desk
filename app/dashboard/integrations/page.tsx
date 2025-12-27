import { Metadata } from 'next';
import { Suspense } from 'react';
import IntegrationsContent from './integrations-content';

export const metadata: Metadata = {
  title: 'Integrations | Customer Success Platform',
  description: 'Connect external data sources like Jira, Zoho CRM, and more',
};

export default function IntegrationsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
          <p className="text-muted-foreground">
            Connect external data sources to sync contacts, tickets, and deals
          </p>
        </div>
      </div>
      
      <Suspense fallback={<div>Loading...</div>}>
        <IntegrationsContent />
      </Suspense>
    </div>
  );
}
