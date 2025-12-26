import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { ActivityEvent, ActivityEventType, ActivityFeedStats } from '@cc-orchestrator/shared';

interface ActivityEventRow {
  id: string;
  instance_id: string | null;
  instance_name: string;
  event_type: string;
  message: string;
  metadata: string | null;
  created_at: string;
  read_at: string | null;
}

function rowToEvent(row: ActivityEventRow): ActivityEvent {
  return {
    id: row.id,
    instanceId: row.instance_id,
    instanceName: row.instance_name,
    eventType: row.event_type as ActivityEventType,
    message: row.message,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export function createActivityEvent(
  instanceId: string,
  instanceName: string,
  eventType: ActivityEventType,
  message: string,
  metadata?: Record<string, unknown>
): ActivityEvent {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO activity_feed (id, instance_id, instance_name, event_type, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, instanceId, instanceName, eventType, message, metadata ? JSON.stringify(metadata) : null);

  const event: ActivityEvent = {
    id,
    instanceId,
    instanceName,
    eventType,
    message,
    metadata: metadata || null,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  broadcast({ type: 'feed:new', event });
  console.log(`📣 Activity: ${instanceName} - ${eventType}`);

  return event;
}

export function listActivityEvents(limit: number = 50, offset: number = 0): ActivityEvent[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM activity_feed
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as ActivityEventRow[];

  return rows.map(rowToEvent);
}

export function getActivityFeedStats(): ActivityFeedStats {
  const db = getDatabase();

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM activity_feed').get() as { count: number };
  const unreadRow = db.prepare('SELECT COUNT(*) as count FROM activity_feed WHERE read_at IS NULL').get() as { count: number };

  return {
    total: totalRow.count,
    unread: unreadRow.count,
  };
}

export function markEventAsRead(eventId: string): ActivityEvent | null {
  const db = getDatabase();

  db.prepare(`
    UPDATE activity_feed
    SET read_at = datetime('now')
    WHERE id = ? AND read_at IS NULL
  `).run(eventId);

  const row = db.prepare('SELECT * FROM activity_feed WHERE id = ?').get(eventId) as ActivityEventRow | undefined;

  if (row) {
    const event = rowToEvent(row);
    broadcast({ type: 'feed:updated' });
    return event;
  }

  return null;
}

export function markAllEventsAsRead(): number {
  const db = getDatabase();

  const result = db.prepare(`
    UPDATE activity_feed
    SET read_at = datetime('now')
    WHERE read_at IS NULL
  `).run();

  if (result.changes > 0) {
    broadcast({ type: 'feed:updated' });
  }

  return result.changes;
}

export function clearAllEvents(): number {
  const db = getDatabase();

  const result = db.prepare('DELETE FROM activity_feed').run();

  if (result.changes > 0) {
    broadcast({ type: 'feed:updated' });
  }

  return result.changes;
}
