import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { GlobalTodo, TodoStatus, TodoStats } from '@cc-orchestrator/shared';

interface TodoRow {
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

function rowToTodo(row: TodoRow): GlobalTodo {
  return {
    id: row.id,
    text: row.text,
    status: row.status as TodoStatus,
    dispatchedInstanceId: row.dispatched_instance_id,
    dispatchedAt: row.dispatched_at,
    completedAt: row.completed_at,
    archivedAt: row.archived_at,
    displayOrder: row.display_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTodo(text: string): GlobalTodo {
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

  const todo: GlobalTodo = {
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

  broadcast({ type: 'todo:created', todo });
  console.log(`📋 Todo created: ${text.substring(0, 50)}...`);

  return todo;
}

export function listTodos(includeArchived: boolean = false): GlobalTodo[] {
  const db = getDatabase();

  let query = `
    SELECT * FROM global_tasks
    WHERE 1=1
  `;

  if (!includeArchived) {
    query += " AND status != 'archived'";
  }

  query += ' ORDER BY display_order ASC, created_at ASC';

  const rows = db.prepare(query).all() as TodoRow[];
  return rows.map(rowToTodo);
}

export function getTodo(id: string): GlobalTodo | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM global_tasks WHERE id = ?').get(id) as TodoRow | undefined;
  return row ? rowToTodo(row) : null;
}

export function updateTodo(
  id: string,
  updates: { text?: string; status?: TodoStatus; dispatchedInstanceId?: string | null }
): GlobalTodo | null {
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
    return getTodo(id);
  }

  updateFields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`
    UPDATE global_tasks
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `).run(...values);

  const todo = getTodo(id);
  if (todo) {
    broadcast({ type: 'todo:updated', todo });
  }

  return todo;
}

export function deleteTodo(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM global_tasks WHERE id = ?').run(id);

  if (result.changes > 0) {
    broadcast({ type: 'todo:deleted', todoId: id });
    return true;
  }

  return false;
}

export function dispatchTodo(todoId: string, instanceId: string): GlobalTodo | null {
  const db = getDatabase();

  db.prepare(`
    UPDATE global_tasks
    SET status = 'in_progress',
        dispatched_instance_id = ?,
        dispatched_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(instanceId, todoId);

  const todo = getTodo(todoId);
  if (todo) {
    broadcast({ type: 'todo:updated', todo });
    console.log(`📋 Todo dispatched to instance: ${instanceId}`);
  }

  return todo;
}

export function markTodoDone(id: string): GlobalTodo | null {
  return updateTodo(id, { status: 'done' });
}

export function archiveTodo(id: string): GlobalTodo | null {
  return updateTodo(id, { status: 'archived' });
}

export function reorderTodos(todoIds: string[]): void {
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

  updateOrder(todoIds);

  // Broadcast that todos were reordered (clients should refetch)
  broadcast({ type: 'todo:updated', todo: undefined });
}

export function getTodoStats(): TodoStats {
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
