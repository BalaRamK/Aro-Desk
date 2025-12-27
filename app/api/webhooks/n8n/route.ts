import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Webhook endpoint for n8n to send synced data
 * 
 * Expected payload structure:
 * {
 *   "integration_id": "uuid",
 *   "sync_log_id": "uuid",
 *   "data_type": "contacts" | "tickets" | "deals",
 *   "records": [...],
 *   "source_type": "jira" | "zoho_crm" | "zoho_desk" | etc
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      integration_id,
      sync_log_id,
      data_type,
      records,
      source_type,
      api_key,
    } = body;
    
    // Verify API key (simple security check)
    const expectedKey = process.env.N8N_WEBHOOK_API_KEY || 'change-this-in-production';
    if (api_key !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (!integration_id || !data_type || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'Missing required fields: integration_id, data_type, records' },
        { status: 400 }
      );
    }
    
    // Get tenant_id from integration
    const integrationResult = await query(
      'SELECT tenant_id FROM integration_sources WHERE id = $1',
      [integration_id]
    );
    
    if (integrationResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }
    
    const tenant_id = integrationResult.rows[0].tenant_id;
    
    let stats = {
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
    };
    
    // Process records based on data type
    for (const record of records) {
      try {
        stats.processed++;
        
        if (data_type === 'contacts') {
          await upsertContact(tenant_id, integration_id, source_type, record);
          stats.created++;
        } else if (data_type === 'tickets') {
          await upsertTicket(tenant_id, integration_id, source_type, record);
          stats.created++;
        } else if (data_type === 'deals') {
          await upsertDeal(tenant_id, integration_id, source_type, record);
          stats.created++;
        } else {
          stats.failed++;
        }
      } catch (error) {
        console.error('Error processing record:', error);
        stats.failed++;
      }
    }
    
    // Update sync log if provided
    if (sync_log_id) {
      await query(
        `UPDATE integration_sync_logs 
         SET status = $1,
             records_processed = $2,
             records_created = $3,
             records_updated = $4,
             records_failed = $5,
             sync_completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - sync_started_at)) * 1000
         WHERE id = $6`,
        [
          stats.failed === 0 ? 'success' : stats.failed === stats.processed ? 'failed' : 'partial',
          stats.processed,
          stats.created,
          stats.updated,
          stats.failed,
          sync_log_id,
        ]
      );
      
      // Update integration source last sync
      await query(
        `UPDATE integration_sources 
         SET last_sync_at = NOW(),
             last_sync_status = $1,
             sync_count = sync_count + 1
         WHERE id = $2`,
        [stats.failed === 0 ? 'success' : 'partial', integration_id]
      );
    }
    
    return NextResponse.json({
      success: true,
      stats,
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

// Helper functions to upsert external data

async function upsertContact(
  tenant_id: string,
  integration_id: string,
  source_type: string,
  record: any
) {
  const {
    external_id,
    account_id,
    first_name,
    last_name,
    email,
    phone,
    title,
    ...properties
  } = record;
  
  // Check if contact exists
  const existing = await query(
    'SELECT id FROM external_contacts WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3',
    [tenant_id, external_id, source_type]
  );
  
  if (existing.rows.length > 0) {
    // Update
    await query(
      `UPDATE external_contacts 
       SET first_name = $1, last_name = $2, email = $3, phone = $4, 
           title = $5, account_id = $6, properties = $7, 
           last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $8`,
      [
        first_name,
        last_name,
        email,
        phone,
        title,
        account_id,
        JSON.stringify(properties),
        existing.rows[0].id,
      ]
    );
    
    // Update synced records
    await query(
      `UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,
      [JSON.stringify(record), integration_id, external_id]
    );
  } else {
    // Insert
    const result = await query(
      `INSERT INTO external_contacts 
       (tenant_id, external_id, source_type, first_name, last_name, 
        email, phone, title, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        tenant_id,
        external_id,
        source_type,
        first_name,
        last_name,
        email,
        phone,
        title,
        account_id,
        JSON.stringify(properties),
      ]
    );
    
    // Track synced record
    await query(
      `INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'contact', 'external_contacts', $3, 'synced', $4)`,
      [integration_id, external_id, result.rows[0].id, JSON.stringify(record)]
    );
  }
}

async function upsertTicket(
  tenant_id: string,
  integration_id: string,
  source_type: string,
  record: any
) {
  const {
    external_id,
    account_id,
    title,
    description,
    status,
    priority,
    ticket_type,
    reporter_email,
    assignee_email,
    created_date,
    updated_date,
    resolved_date,
    ...properties
  } = record;
  
  const existing = await query(
    'SELECT id FROM external_tickets WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3',
    [tenant_id, external_id, source_type]
  );
  
  if (existing.rows.length > 0) {
    await query(
      `UPDATE external_tickets 
       SET title = $1, description = $2, status = $3, priority = $4,
           ticket_type = $5, reporter_email = $6, assignee_email = $7,
           created_date = $8, updated_date = $9, resolved_date = $10,
           account_id = $11, properties = $12,
           last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $13`,
      [
        title,
        description,
        status,
        priority,
        ticket_type,
        reporter_email,
        assignee_email,
        created_date,
        updated_date,
        resolved_date,
        account_id,
        JSON.stringify(properties),
        existing.rows[0].id,
      ]
    );
    
    await query(
      `UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,
      [JSON.stringify(record), integration_id, external_id]
    );
  } else {
    const result = await query(
      `INSERT INTO external_tickets 
       (tenant_id, external_id, source_type, title, description, status, 
        priority, ticket_type, reporter_email, assignee_email, 
        created_date, updated_date, resolved_date, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        tenant_id,
        external_id,
        source_type,
        title,
        description,
        status,
        priority,
        ticket_type,
        reporter_email,
        assignee_email,
        created_date,
        updated_date,
        resolved_date,
        account_id,
        JSON.stringify(properties),
      ]
    );
    
    await query(
      `INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'ticket', 'external_tickets', $3, 'synced', $4)`,
      [integration_id, external_id, result.rows[0].id, JSON.stringify(record)]
    );
  }
}

async function upsertDeal(
  tenant_id: string,
  integration_id: string,
  source_type: string,
  record: any
) {
  const {
    external_id,
    account_id,
    name,
    amount,
    stage,
    probability,
    close_date,
    created_date,
    owner_email,
    ...properties
  } = record;
  
  const existing = await query(
    'SELECT id FROM external_deals WHERE tenant_id = $1 AND external_id = $2 AND source_type = $3',
    [tenant_id, external_id, source_type]
  );
  
  if (existing.rows.length > 0) {
    await query(
      `UPDATE external_deals 
       SET name = $1, amount = $2, stage = $3, probability = $4,
           close_date = $5, owner_email = $6, account_id = $7,
           properties = $8, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = $9`,
      [
        name,
        amount,
        stage,
        probability,
        close_date,
        owner_email,
        account_id,
        JSON.stringify(properties),
        existing.rows[0].id,
      ]
    );
    
    await query(
      `UPDATE integration_synced_records 
       SET last_updated_at = NOW(), sync_status = 'synced', raw_data = $1
       WHERE integration_source_id = $2 AND external_id = $3`,
      [JSON.stringify(record), integration_id, external_id]
    );
  } else {
    const result = await query(
      `INSERT INTO external_deals 
       (tenant_id, external_id, source_type, name, amount, stage, 
        probability, close_date, created_date, owner_email, account_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        tenant_id,
        external_id,
        source_type,
        name,
        amount,
        stage,
        probability,
        close_date,
        created_date,
        owner_email,
        account_id,
        JSON.stringify(properties),
      ]
    );
    
    await query(
      `INSERT INTO integration_synced_records 
       (integration_source_id, external_id, external_type, internal_table, internal_id, sync_status, raw_data)
       VALUES ($1, $2, 'deal', 'external_deals', $3, 'synced', $4)`,
      [integration_id, external_id, result.rows[0].id, JSON.stringify(record)]
    );
  }
}
