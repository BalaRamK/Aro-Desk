'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type IntegrationType = 'jira' | 'zoho_crm' | 'zoho_desk' | 'salesforce' | 'hubspot' | 'zendesk' | 'intercom' | 'slack' | 'custom';

export interface IntegrationSource {
  id: string;
  tenant_id: string;
  source_type: IntegrationType;
  name: string;
  description?: string;
  config: Record<string, any>;
  n8n_workflow_id?: string;
  n8n_webhook_url?: string;
  is_active: boolean;
  last_sync_at?: Date;
  last_sync_status?: 'success' | 'failed' | 'partial' | 'pending';
  last_sync_error?: string;
  sync_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface IntegrationStats {
  total_integrations: number;
  active_integrations: number;
  total_synced_records: number;
  contacts: number;
  tickets: number;
  deals: number;
  last_24h_syncs: number;
  failed_syncs: number;
}

// Get all integration sources
export async function getIntegrationSources() {
  try {
    const result = await query(
      `SELECT 
        id, tenant_id, source_type, name, description, 
        config, n8n_workflow_id, n8n_webhook_url, 
        is_active, last_sync_at, last_sync_status, last_sync_error,
        sync_count, created_at, updated_at
       FROM integration_sources
       ORDER BY created_at DESC`
    );
    
    return result.rows as IntegrationSource[];
  } catch (error) {
    console.error('Error fetching integration sources:', error);
    throw error;
  }
}

// Get integration statistics
export async function getIntegrationStats(): Promise<IntegrationStats> {
  try {
    const statsQuery = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE source_type IS NOT NULL) as total_integrations,
        COUNT(*) FILTER (WHERE is_active = true) as active_integrations
      FROM integration_sources
    `);
    
    const recordsQuery = await query(`
      SELECT 
        COUNT(*) as total_synced_records,
        COUNT(*) FILTER (WHERE internal_table = 'external_contacts') as contacts,
        COUNT(*) FILTER (WHERE internal_table = 'external_tickets') as tickets,
        COUNT(*) FILTER (WHERE internal_table = 'external_deals') as deals
      FROM integration_synced_records
      WHERE sync_status = 'synced'
    `);
    
    const syncLogsQuery = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE sync_started_at > NOW() - INTERVAL '24 hours') as last_24h_syncs,
        COUNT(*) FILTER (WHERE status = 'failed' AND sync_started_at > NOW() - INTERVAL '7 days') as failed_syncs
      FROM integration_sync_logs
    `);
    
    return {
      total_integrations: parseInt(statsQuery.rows[0]?.total_integrations || '0'),
      active_integrations: parseInt(statsQuery.rows[0]?.active_integrations || '0'),
      total_synced_records: parseInt(recordsQuery.rows[0]?.total_synced_records || '0'),
      contacts: parseInt(recordsQuery.rows[0]?.contacts || '0'),
      tickets: parseInt(recordsQuery.rows[0]?.tickets || '0'),
      deals: parseInt(recordsQuery.rows[0]?.deals || '0'),
      last_24h_syncs: parseInt(syncLogsQuery.rows[0]?.last_24h_syncs || '0'),
      failed_syncs: parseInt(syncLogsQuery.rows[0]?.failed_syncs || '0'),
    };
  } catch (error) {
    console.error('Error fetching integration stats:', error);
    return {
      total_integrations: 0,
      active_integrations: 0,
      total_synced_records: 0,
      contacts: 0,
      tickets: 0,
      deals: 0,
      last_24h_syncs: 0,
      failed_syncs: 0,
    };
  }
}

// Create new integration source
export async function createIntegrationSource(data: {
  source_type: IntegrationType;
  name: string;
  description?: string;
  config: Record<string, any>;
  n8n_workflow_id?: string;
  n8n_webhook_url?: string;
}) {
  try {
    const result = await query(
      `INSERT INTO integration_sources 
       (source_type, name, description, config, n8n_workflow_id, n8n_webhook_url, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, requesting_tenant_id())
       RETURNING *`,
      [
        data.source_type,
        data.name,
        data.description,
        JSON.stringify(data.config),
        data.n8n_workflow_id,
        data.n8n_webhook_url,
      ]
    );
    
    revalidatePath('/dashboard/integrations');
    return result.rows[0];
  } catch (error) {
    console.error('Error creating integration source:', error);
    throw error;
  }
}

// Update integration source
export async function updateIntegrationSource(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    config: Record<string, any>;
    n8n_workflow_id: string;
    n8n_webhook_url: string;
    is_active: boolean;
  }>
) {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(data.config));
    }
    if (data.n8n_workflow_id !== undefined) {
      updates.push(`n8n_workflow_id = $${paramIndex++}`);
      values.push(data.n8n_workflow_id);
    }
    if (data.n8n_webhook_url !== undefined) {
      updates.push(`n8n_webhook_url = $${paramIndex++}`);
      values.push(data.n8n_webhook_url);
    }
    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    values.push(id);

    const result = await query(
      `UPDATE integration_sources 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    revalidatePath('/dashboard/integrations');
    return result.rows[0];
  } catch (error) {
    console.error('Error updating integration source:', error);
    throw error;
  }
}

// Delete integration source
export async function deleteIntegrationSource(id: string) {
  try {
    await query(
      'DELETE FROM integration_sources WHERE id = $1',
      [id]
    );
    
    revalidatePath('/dashboard/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error deleting integration source:', error);
    throw error;
  }
}

// Trigger manual sync
export async function triggerSync(integrationId: string) {
  try {
    // Create sync log entry
    const logResult = await query(
      `INSERT INTO integration_sync_logs 
       (integration_source_id, status, triggered_by)
       VALUES ($1, 'running', 'manual')
       RETURNING id`,
      [integrationId]
    );
    
    // Get integration details
    const integration = await query(
      'SELECT n8n_webhook_url FROM integration_sources WHERE id = $1',
      [integrationId]
    );
    
    if (integration.rows[0]?.n8n_webhook_url) {
      // Trigger n8n webhook
      try {
        const response = await fetch(integration.rows[0].n8n_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: 'manual', sync_log_id: logResult.rows[0].id }),
        });
        
        if (!response.ok) {
          throw new Error(`n8n webhook failed: ${response.statusText}`);
        }
      } catch (webhookError) {
        // Update log with error
        await query(
          `UPDATE integration_sync_logs 
           SET status = 'failed', 
               error_message = $1,
               sync_completed_at = NOW(),
               duration_ms = EXTRACT(EPOCH FROM (NOW() - sync_started_at)) * 1000
           WHERE id = $2`,
          [String(webhookError), logResult.rows[0].id]
        );
        throw webhookError;
      }
    }
    
    revalidatePath('/dashboard/integrations');
    return { success: true, sync_log_id: logResult.rows[0].id };
  } catch (error) {
    console.error('Error triggering sync:', error);
    throw error;
  }
}

// Get recent sync logs for an integration
export async function getSyncLogs(integrationId: string, limit = 10) {
  try {
    const result = await query(
      `SELECT 
        id, sync_started_at, sync_completed_at, status,
        records_processed, records_created, records_updated, records_failed,
        error_message, triggered_by, duration_ms
       FROM integration_sync_logs
       WHERE integration_source_id = $1
       ORDER BY sync_started_at DESC
       LIMIT $2`,
      [integrationId, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    throw error;
  }
}

// Get synced external data
export async function getExternalData(type: 'contacts' | 'tickets' | 'deals', accountId?: string) {
  try {
    let query = '';
    let params: any[] = [];
    
    if (type === 'contacts') {
      query = `
        SELECT 
          id, external_id, source_type, 
          first_name, last_name, email, phone, title,
          properties, last_synced_at
        FROM external_contacts
        ${accountId ? 'WHERE account_id = $1' : ''}
        ORDER BY last_synced_at DESC
      `;
      if (accountId) params = [accountId];
    } else if (type === 'tickets') {
      query = `
        SELECT 
          id, external_id, source_type, title, status, priority,
          reporter_email, created_date, resolved_date,
          properties, last_synced_at
        FROM external_tickets
        ${accountId ? 'WHERE account_id = $1' : ''}
        ORDER BY created_date DESC
      `;
      if (accountId) params = [accountId];
    } else if (type === 'deals') {
      query = `
        SELECT 
          id, external_id, source_type, name, amount, stage,
          close_date, owner_email,
          properties, last_synced_at
        FROM external_deals
        ${accountId ? 'WHERE account_id = $1' : ''}
        ORDER BY created_date DESC
      `;
      if (accountId) params = [accountId];
    }
    
    const result = await query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching external data:', error);
    throw error;
  }
}

// Get field mappings for an integration
export async function getFieldMappings(integrationId: string) {
  try {
    const result = await query(
      `SELECT 
        id, source_field, target_table, target_field,
        transformation_rule, is_required, default_value
       FROM integration_field_mappings
       WHERE integration_source_id = $1
       ORDER BY target_table, target_field`,
      [integrationId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error fetching field mappings:', error);
    throw error;
  }
}

// Create field mapping
export async function createFieldMapping(data: {
  integration_source_id: string;
  source_field: string;
  target_table: string;
  target_field: string;
  transformation_rule?: Record<string, any>;
  is_required?: boolean;
  default_value?: string;
}) {
  try {
    const result = await query(
      `INSERT INTO integration_field_mappings 
       (integration_source_id, source_field, target_table, target_field, 
        transformation_rule, is_required, default_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.integration_source_id,
        data.source_field,
        data.target_table,
        data.target_field,
        JSON.stringify(data.transformation_rule || {}),
        data.is_required || false,
        data.default_value,
      ]
    );
    
    revalidatePath('/dashboard/integrations');
    return result.rows[0];
  } catch (error) {
    console.error('Error creating field mapping:', error);
    throw error;
  }
}

// Delete field mapping
export async function deleteFieldMapping(id: string) {
  try {
    await query('DELETE FROM integration_field_mappings WHERE id = $1', [id]);
    revalidatePath('/dashboard/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error deleting field mapping:', error);
    throw error;
  }
}
