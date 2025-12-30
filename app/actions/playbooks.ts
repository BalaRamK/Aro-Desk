'use server';

import { query, setUserContext } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSession } from './auth-local';
import { redirect } from 'next/navigation';

export interface PlaybookConfig {
  name: string;
  description: string;
  trigger_criteria: Record<string, any>;
  actions: Array<{
    type: string;
    config: Record<string, any>;
  }>;
  conditions: Array<{
    type: string;
    operator: string;
    value: any;
  }>;
}

export interface Playbook {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  config: PlaybookConfig;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Save an AI-generated playbook
 */
export async function savePlaybook(config: PlaybookConfig) {
  const session = await getSession();
  if (!session) redirect('/login');

  await setUserContext(session.userId);

  try {
    // Get user's tenant_id
    const tenantRes = await query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    );
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) {
      throw new Error('Unable to resolve tenant for current user');
    }

    // Insert the playbook
    const result = await query<Playbook>(
      `INSERT INTO playbooks (
        tenant_id, name, description, config, is_active
      ) VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [
        tenantId,
        config.name,
        config.description,
        JSON.stringify(config),
      ]
    );

    revalidatePath('/dashboard/automation');
    return { success: true, playbook: result.rows[0] };
  } catch (error) {
    console.error('Error saving playbook:', error);
    throw error;
  }
}

/**
 * Get all playbooks for current user's tenant
 */
export async function getPlaybooksForTenant() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };

  try {
    const tenantRes = await query<{ tenant_id: string }>(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [session.userId]
    );
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) {
      return { error: 'Unable to resolve tenant' };
    }

    const result = await query<Playbook>(
      `SELECT * FROM playbooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );

    return { success: true, playbooks: result.rows };
  } catch (error) {
    console.error('Error fetching playbooks:', error);
    return { error: 'Failed to fetch playbooks' };
  }
}

/**
 * Update a playbook
 */
export async function updatePlaybook(
  playbookId: string,
  config: Partial<PlaybookConfig> & { is_active?: boolean }
) {
  const session = await getSession();
  if (!session) redirect('/login');

  await setUserContext(session.userId);

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (config.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(config.name);
    }
    if (config.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(config.description);
    }
    if (config.trigger_criteria || config.actions || config.conditions) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(config));
    }
    if (config.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(config.is_active);
    }

    values.push(playbookId);

    const result = await query<Playbook>(
      `UPDATE playbooks 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    revalidatePath('/dashboard/automation');
    return { success: true, playbook: result.rows[0] };
  } catch (error) {
    console.error('Error updating playbook:', error);
    throw error;
  }
}

/**
 * Delete a playbook
 */
export async function deletePlaybook(playbookId: string) {
  const session = await getSession();
  if (!session) redirect('/login');

  await setUserContext(session.userId);

  try {
    await query('DELETE FROM playbooks WHERE id = $1', [playbookId]);

    revalidatePath('/dashboard/automation');
    return { success: true };
  } catch (error) {
    console.error('Error deleting playbook:', error);
    throw error;
  }
}

/**
 * Toggle playbook active status
 */
export async function togglePlaybookStatus(playbookId: string, isActive: boolean) {
  const session = await getSession();
  if (!session) redirect('/login');

  await setUserContext(session.userId);

  try {
    const result = await query<Playbook>(
      `UPDATE playbooks 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isActive, playbookId]
    );

    revalidatePath('/dashboard/automation');
    return { success: true, playbook: result.rows[0] };
  } catch (error) {
    console.error('Error toggling playbook:', error);
    throw error;
  }
}
