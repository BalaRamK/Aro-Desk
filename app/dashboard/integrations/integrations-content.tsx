'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Database, RefreshCw, Settings, Trash2, AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import {
  getIntegrationSources,
  getIntegrationStats,
  deleteIntegrationSource,
  triggerSync,
  getSyncLogs,
  provisionN8nWebhook,
  type IntegrationSource,
  type IntegrationStats,
} from '@/app/actions/integrations';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createIntegrationSource, type IntegrationType } from '@/app/actions/integrations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

const INTEGRATION_ICONS: Record<IntegrationType, string> = {
  jira: '🎯',
  zoho_crm: '📊',
  zoho_desk: '🎫',
  salesforce: '☁️',
  hubspot: '🟠',
  zendesk: '💬',
  intercom: '💬',
  slack: '💬',
  custom: '🔌',
};

export default function IntegrationsContent() {
  const [integrations, setIntegrations] = useState<IntegrationSource[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationSource | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [integrationsData, statsData] = await Promise.all([
        getIntegrationSources(),
        getIntegrationStats(),
      ]);
      setIntegrations(integrationsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading integrations:', error);
      alert('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;
    
    try {
      await deleteIntegrationSource(id);
      alert('Integration deleted successfully');
      loadData();
    } catch (error) {
      alert('Failed to delete integration');
    }
  };

  const handleSync = async (id: string) => {
    try {
      await triggerSync(id);
      alert('Sync triggered successfully');
      setTimeout(loadData, 1000);
    } catch (error) {
      alert('Failed to trigger sync');
    }
  };

  const handleProvision = async (id: string) => {
    try {
      const res = await provisionN8nWebhook(id, { name: `CS Auto ${id}` });
      if ((res as any).error) {
        alert((res as any).error);
        return;
      }
      const { webhookUrl } = res as { webhookUrl?: string };
      alert(`Webhook generated${webhookUrl ? `: ${webhookUrl}` : ''}`);
      loadData();
    } catch (error) {
      alert('Failed to generate webhook');
    }
  };

  const viewLogs = async (integration: IntegrationSource) => {
    setSelectedIntegration(integration);
    try {
      const logs = await getSyncLogs(integration.id);
      setSyncLogs(logs);
    } catch (error) {
      alert('Failed to load sync logs');
    }
  };

  if (loading) {
    return <div>Loading integrations...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_integrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active_integrations || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced Records</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_synced_records || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.contacts || 0} contacts, {stats?.tickets || 0} tickets, {stats?.deals || 0} deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last 24h Syncs</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.last_24h_syncs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Automatic and manual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Syncs</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed_syncs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integrations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>Manage your external data sources</CardDescription>
            </div>
            <AddIntegrationDialog onSuccess={loadData} />
          </div>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No integrations configured yet</p>
              <p className="text-sm">Click "Add Integration" to connect your first data source</p>
            </div>
          ) : (
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{INTEGRATION_ICONS[integration.source_type]}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{integration.name}</h3>
                        <Badge variant={integration.is_active ? 'default' : 'secondary'}>
                          {integration.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {integration.last_sync_status && (
                          <Badge variant={
                            integration.last_sync_status === 'success' ? 'default' :
                            integration.last_sync_status === 'failed' ? 'destructive' :
                            'secondary'
                          }>
                            {integration.last_sync_status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {integration.last_sync_status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {integration.last_sync_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {integration.last_sync_status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {integration.description || `${integration.source_type} integration`}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {integration.last_sync_at && (
                          <span>Last sync: {new Date(integration.last_sync_at).toLocaleString()}</span>
                        )}
                        <span>{integration.sync_count} total syncs</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProvision(integration.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Generate n8n Webhook
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(integration.id)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sync Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewLogs(integration)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Logs
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(integration.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs Dialog */}
      {selectedIntegration && (
        <Dialog open={!!selectedIntegration} onOpenChange={() => setSelectedIntegration(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Sync Logs - {selectedIntegration.name}</DialogTitle>
              <DialogDescription>Recent synchronization history</DialogDescription>
            </DialogHeader>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Triggered By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.sync_started_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(2)}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          log.status === 'success' ? 'default' :
                          log.status === 'failed' ? 'destructive' :
                          log.status === 'running' ? 'secondary' :
                          'secondary'
                        }>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-1">
                          <span>✅ {log.records_created} created</span>
                          <span>🔄 {log.records_updated} updated</span>
                          {log.records_failed > 0 && (
                            <span className="text-destructive">❌ {log.records_failed} failed</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{log.triggered_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AddIntegrationDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    source_type: 'zoho_crm' as IntegrationType,
    name: '',
    description: '',
    n8n_webhook_url: '',
    api_url: '',
    api_key: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createIntegrationSource({
        source_type: formData.source_type,
        name: formData.name,
        description: formData.description,
        n8n_webhook_url: formData.n8n_webhook_url,
        config: {
          api_url: formData.api_url,
          api_key: formData.api_key,
        },
      });
      
      alert('Integration created successfully');
      
      setOpen(false);
      setFormData({
        source_type: 'zoho_crm',
        name: '',
        description: '',
        n8n_webhook_url: '',
        api_url: '',
        api_key: '',
      });
      onSuccess();
    } catch (error) {
      alert('Failed to create integration');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Integration</DialogTitle>
          <DialogDescription>
            Connect a new external data source to sync data automatically
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source_type">Integration Type</Label>
            <Select
              value={formData.source_type}
              onValueChange={(value) => setFormData({ ...formData, source_type: value as IntegrationType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jira">🎯 Jira</SelectItem>
                <SelectItem value="zoho_crm">📊 Zoho CRM</SelectItem>
                <SelectItem value="zoho_desk">🎫 Zoho Desk</SelectItem>
                <SelectItem value="salesforce">☁️ Salesforce</SelectItem>
                <SelectItem value="hubspot">🟠 HubSpot</SelectItem>
                <SelectItem value="zendesk">💬 Zendesk</SelectItem>
                <SelectItem value="intercom">💬 Intercom</SelectItem>
                <SelectItem value="slack">💬 Slack</SelectItem>
                <SelectItem value="custom">🔌 Custom API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Integration Name</Label>
            <Input
              id="name"
              placeholder="e.g., Zoho CRM Production"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what data this integration syncs"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="n8n_webhook_url">n8n Webhook URL</Label>
            <Input
              id="n8n_webhook_url"
              placeholder="http://localhost:5678/webhook/zoho-crm-sync"
              value={formData.n8n_webhook_url}
              onChange={(e) => setFormData({ ...formData, n8n_webhook_url: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              The webhook URL from your n8n workflow that will handle the sync
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_url">API URL (Optional)</Label>
            <Input
              id="api_url"
              placeholder="https://api.zoho.com/crm/v2"
              value={formData.api_url}
              onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">API Key (Optional)</Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Your API key or token"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Integration</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
