import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { GlobalTask, TaskStatus, TaskStats } from '@cc-orchestrator/shared';

interface TaskRow {
  id: string;
  text: string;
  status: string;
  dispatched_instance_id: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): GlobalTask {
  return {
    id: row.id,
    text: row.text,
    status: row.status as TaskStatus,
    dispatchedInstanceId: row.dispatched_instance_id,
    dispatchedAt: row.dispatched_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTask(text: string): GlobalTask {
  const db = getDatabase();
  const id = randomUUID();

  // Get max display_order
  const maxOrderRow = db.prepare(
    "SELECT MAX(display_order) as max_order FROM global_tasks WHERE status != 'archived'"
  ).get() as { max_order: number | null } | undefined;
  const displayOrder = (maxOrderRow?.max_order ?? 0) + 1;

  db.prepare(`
    INSERT INTO global_tasks (id, text, status, display_order)
    VALUES (?, ?, 'captured', ?)
  `).run(id, text, displayOrder);

  const task: GlobalTask = {
    id,
    text,
    status: 'captured',
    dispatchedInstanceId: null,
    dispatchedAt: null,
    completedAt: null,
    archivedAt: null,
    displayOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  broadcast({ type: 'task:created', task });
  console.log(`📋 Task created: ${text.substring(0, 50)}...`);

  return task;
}

export function listTasks(includeArchived: boolean = false): GlobalTask[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM global_tasks
    WHERE 1=1
  `;

  if (!includeArchived) {
    query += " AND status != 'archived'";
  }

  query += ' ORDER BY display_order ASC, created_at ASC';

  const rows = db.prepare(query).all() as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): GlobalTask | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM global_tasks WHERE id = ?').get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function updateTask(
  id: string,
  updates: { text?: string; status?: TaskStatus; dispatchedInstanceId?: string | null }
): GlobalTask | null {
  const db = getDatabase();

  const updateFields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.text !== undefined) {
    updateFields.push('text = ?');
    values.push(updates.text);
  }

  if (updates.status !== undefined) {
    updateFields.push('status = ?');
    values.push(updates.status);

    // Set timestamp based on status
    if (updates.status === 'done') {
      updateFields.push("completed_at = datetime('now')");
    } else if (updates.status === 'archived') {
      updateFields.push("archived_at = datetime('now')");
    }
  }

  if (updates.dispatchedInstanceId !== undefined) {
    updateFields.push('dispatched_instance_id = ?');
    values.push(updates.dispatchedInstanceId);
  }

  if (updateFields.length === 0) {
    return getTask(id);
  }

  updateFields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`
    UPDATE global_tasks
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `).run(...values);

  const task = getTask(id);
  if (task) {
    broadcast({ type: 'task:updated', task });
  }

  return task;
}

export function deleteTask(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM global_tasks WHERE id = ?').run(id);

  if (result.changes > 0) {
    broadcast({ type: 'task:deleted', taskId: id });
    return true;
  }

  return false;
}

export function dispatchTask(taskId: string, instanceId: string): GlobalTask | null {
  const db = getDatabase();

  db.prepare(`
    UPDATE global_tasks
    SET status = 'in_progress',
        dispatched_instance_id = ?,
        dispatched_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(instanceId, taskId);

  const task = getTask(taskId);
  if (task) {
    broadcast({ type: 'task:updated', task });
    console.log(`📋 Task dispatched to instance: ${instanceId}`);
  }

  return task;
}

export function markTaskDone(id: string): GlobalTask | null {
  return updateTask(id, { status: 'done' });
}

export function archiveTask(id: string): GlobalTask | null {
  return updateTask(id, { status: 'archived' });
}

export function reorderTasks(taskIds: string[]): void {
  const db = getDatabase();

  const updateOrder = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => {
      db.prepare(`
        UPDATE global_tasks
        SET display_order = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(index + 1, id);
    });
  });

  updateOrder(taskIds);

  // Broadcast that tasks were reordered (clients should refetch)
  broadcast({ type: 'task:updated', task: undefined });
}

export function getTaskStats(): TaskStats {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'captured' THEN 1 ELSE 0 END) as captured,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
    FROM global_tasks
    WHERE status != 'archived'
  `).get() as { total: number; captured: number; in_progress: number; done: number };

  return {
    total: stats.total,
    captured: stats.captured,
    inProgress: stats.in_progress,
    done: stats.done,
  };
}
