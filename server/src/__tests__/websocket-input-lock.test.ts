import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for WebSocket input lock management.
 *
 * The input lock system ensures that:
 * 1. First subscriber to an instance automatically gets the input lock
 * 2. Subsequent subscribers are view-only (can't send input)
 * 3. Lock is released when lock holder disconnects
 * 4. Lock is auto-granted to next subscriber when holder disconnects
 * 5. Lock can be explicitly requested/released
 *
 * These tests validate the logic without needing full WebSocket infrastructure.
 */

// Mock WebSocket client for testing
interface MockWebSocket {
  id: string;
  readyState: number;
  messages: Array<{ type: string; instanceId?: string; hasLock?: boolean; lockHolder?: string }>;
}

const OPEN = 1;
const CLOSED = 3;

describe('WebSocket Input Lock Management', () => {
  // Simulate the lock and subscription tracking from server.ts
  let inputLocks: Map<string, MockWebSocket>;
  let subscriptions: Map<string, Set<MockWebSocket>>;
  let clientIds: WeakMap<MockWebSocket, string>;
  let clientIdCounter: number;

  function getClientId(ws: MockWebSocket): string {
    let id = clientIds.get(ws);
    if (!id) {
      id = `client-${++clientIdCounter}`;
      clientIds.set(ws, id);
    }
    return id;
  }

  function createMockClient(id: string): MockWebSocket {
    return {
      id,
      readyState: OPEN,
      messages: [],
    };
  }

  function send(ws: MockWebSocket, message: { type: string; instanceId?: string; hasLock?: boolean; lockHolder?: string }): void {
    if (ws.readyState === OPEN) {
      ws.messages.push(message);
    }
  }

  function handleSubscribe(ws: MockWebSocket, instanceId: string): void {
    if (!subscriptions.has(instanceId)) {
      subscriptions.set(instanceId, new Set());
    }
    subscriptions.get(instanceId)!.add(ws);

    // Handle input lock: auto-grant to first subscriber
    const existingLock = inputLocks.get(instanceId);
    if (!existingLock) {
      // No lock exists, grant to this client
      inputLocks.set(instanceId, ws);
      send(ws, {
        type: 'input:lockGranted',
        instanceId,
        hasLock: true,
      });
    } else {
      // Lock exists, inform this client they don't have it
      const lockHolderId = getClientId(existingLock);
      send(ws, {
        type: 'input:lockStatus',
        instanceId,
        hasLock: false,
        lockHolder: lockHolderId,
      });
    }
  }

  function handleUnsubscribe(ws: MockWebSocket, instanceId: string): void {
    if (subscriptions.has(instanceId)) {
      subscriptions.get(instanceId)!.delete(ws);

      // Release lock if this client held it
      if (inputLocks.get(instanceId) === ws) {
        inputLocks.delete(instanceId);
      }
    }
  }

  function handleDisconnect(ws: MockWebSocket): void {
    // Check if this client held any input locks
    for (const [instanceId, lockHolder] of inputLocks.entries()) {
      if (lockHolder === ws) {
        inputLocks.delete(instanceId);

        // Auto-grant lock to next subscriber if any
        const subscribers = subscriptions.get(instanceId);
        if (subscribers && subscribers.size > 0) {
          const nextClient = Array.from(subscribers).find(c => c !== ws && c.readyState === OPEN);
          if (nextClient) {
            inputLocks.set(instanceId, nextClient);
            const newHolderId = getClientId(nextClient);

            // Notify the new lock holder
            send(nextClient, {
              type: 'input:lockGranted',
              instanceId,
              hasLock: true,
            });

            // Notify other subscribers about the new lock holder
            for (const client of subscribers) {
              if (client !== nextClient && client !== ws && client.readyState === OPEN) {
                send(client, {
                  type: 'input:lockStatus',
                  instanceId,
                  hasLock: false,
                  lockHolder: newHolderId,
                });
              }
            }
          }
        }
      }
    }

    // Remove from all subscriptions
    for (const clients of subscriptions.values()) {
      clients.delete(ws);
    }
  }

  function handleRequestLock(ws: MockWebSocket, instanceId: string): void {
    const currentLock = inputLocks.get(instanceId);
    if (!currentLock) {
      // No lock exists, grant to requester
      inputLocks.set(instanceId, ws);
      send(ws, {
        type: 'input:lockGranted',
        instanceId,
        hasLock: true,
      });
    } else if (currentLock === ws) {
      // Already holds the lock
      send(ws, {
        type: 'input:lockGranted',
        instanceId,
        hasLock: true,
      });
    } else {
      // Lock held by another client
      send(ws, {
        type: 'input:lockDenied',
        instanceId,
        hasLock: false,
        lockHolder: getClientId(currentLock),
      });
    }
  }

  function handleReleaseLock(ws: MockWebSocket, instanceId: string): void {
    if (inputLocks.get(instanceId) === ws) {
      inputLocks.delete(instanceId);

      // Notify all subscribers that lock is released
      const subscribers = subscriptions.get(instanceId);
      if (subscribers) {
        for (const client of subscribers) {
          if (client.readyState === OPEN) {
            send(client, {
              type: 'input:lockReleased',
              instanceId,
              hasLock: false,
            });
          }
        }
      }
    }
  }

  function canSendInput(ws: MockWebSocket, instanceId: string): boolean {
    const lockHolder = inputLocks.get(instanceId);
    return !lockHolder || lockHolder === ws;
  }

  beforeEach(() => {
    inputLocks = new Map();
    subscriptions = new Map();
    clientIds = new WeakMap();
    clientIdCounter = 0;
  });

  describe('auto-lock on first subscribe', () => {
    it('grants lock to first subscriber automatically', () => {
      const client1 = createMockClient('client-1');

      handleSubscribe(client1, 'instance-1');

      expect(inputLocks.get('instance-1')).toBe(client1);
      expect(client1.messages).toContainEqual({
        type: 'input:lockGranted',
        instanceId: 'instance-1',
        hasLock: true,
      });
    });

    it('denies lock to second subscriber', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');

      expect(inputLocks.get('instance-1')).toBe(client1);
      expect(client2.messages).toContainEqual(
        expect.objectContaining({
          type: 'input:lockStatus',
          instanceId: 'instance-1',
          hasLock: false,
        })
      );
    });

    it('grants lock per instance independently', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-2');

      expect(inputLocks.get('instance-1')).toBe(client1);
      expect(inputLocks.get('instance-2')).toBe(client2);
    });
  });

  describe('input gating', () => {
    it('allows lock holder to send input', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');

      expect(canSendInput(client1, 'instance-1')).toBe(true);
    });

    it('blocks non-lock-holder from sending input', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');

      expect(canSendInput(client1, 'instance-1')).toBe(true);
      expect(canSendInput(client2, 'instance-1')).toBe(false);
    });

    it('allows input when no lock exists', () => {
      const client1 = createMockClient('client-1');

      // Client is subscribed but no lock mechanism triggered
      expect(canSendInput(client1, 'instance-1')).toBe(true);
    });
  });

  describe('lock release on disconnect', () => {
    it('releases lock when lock holder disconnects', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');

      client1.readyState = CLOSED;
      handleDisconnect(client1);

      expect(inputLocks.get('instance-1')).toBeUndefined();
    });

    it('auto-grants lock to remaining subscriber on disconnect', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');

      client1.readyState = CLOSED;
      handleDisconnect(client1);

      expect(inputLocks.get('instance-1')).toBe(client2);
      expect(client2.messages).toContainEqual({
        type: 'input:lockGranted',
        instanceId: 'instance-1',
        hasLock: true,
      });
    });

    it('notifies other subscribers when lock is auto-granted', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');
      const client3 = createMockClient('client-3');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');
      handleSubscribe(client3, 'instance-1');

      client1.readyState = CLOSED;
      handleDisconnect(client1);

      // Client3 should receive notification about new lock holder
      expect(client3.messages).toContainEqual(
        expect.objectContaining({
          type: 'input:lockStatus',
          instanceId: 'instance-1',
          hasLock: false,
        })
      );
    });
  });

  describe('lock release on unsubscribe', () => {
    it('releases lock when lock holder unsubscribes', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');

      handleUnsubscribe(client1, 'instance-1');

      expect(inputLocks.get('instance-1')).toBeUndefined();
    });

    it('does not release lock when non-holder unsubscribes', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');

      handleUnsubscribe(client2, 'instance-1');

      expect(inputLocks.get('instance-1')).toBe(client1);
    });
  });

  describe('explicit lock request', () => {
    it('grants lock when no lock exists', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');
      client1.messages = []; // Clear subscribe messages

      handleRequestLock(client1, 'instance-1');

      expect(client1.messages).toContainEqual({
        type: 'input:lockGranted',
        instanceId: 'instance-1',
        hasLock: true,
      });
    });

    it('denies lock request when another holds it', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');
      client2.messages = []; // Clear subscribe messages

      handleRequestLock(client2, 'instance-1');

      expect(client2.messages).toContainEqual(
        expect.objectContaining({
          type: 'input:lockDenied',
          instanceId: 'instance-1',
          hasLock: false,
        })
      );
    });

    it('confirms lock when requester already holds it', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');
      client1.messages = [];

      handleRequestLock(client1, 'instance-1');

      expect(client1.messages).toContainEqual({
        type: 'input:lockGranted',
        instanceId: 'instance-1',
        hasLock: true,
      });
    });
  });

  describe('explicit lock release', () => {
    it('releases lock when holder requests release', () => {
      const client1 = createMockClient('client-1');
      handleSubscribe(client1, 'instance-1');

      handleReleaseLock(client1, 'instance-1');

      expect(inputLocks.get('instance-1')).toBeUndefined();
    });

    it('notifies all subscribers when lock is released', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');
      client2.messages = [];

      handleReleaseLock(client1, 'instance-1');

      expect(client2.messages).toContainEqual({
        type: 'input:lockReleased',
        instanceId: 'instance-1',
        hasLock: false,
      });
    });

    it('ignores release request from non-holder', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client2, 'instance-1');

      handleReleaseLock(client2, 'instance-1');

      expect(inputLocks.get('instance-1')).toBe(client1);
    });
  });

  describe('multiple instances', () => {
    it('maintains separate locks for different instances', () => {
      const client1 = createMockClient('client-1');
      const client2 = createMockClient('client-2');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client1, 'instance-2');
      handleSubscribe(client2, 'instance-1');
      handleSubscribe(client2, 'instance-2');

      expect(inputLocks.get('instance-1')).toBe(client1);
      expect(inputLocks.get('instance-2')).toBe(client1);

      // Client1 can send to both
      expect(canSendInput(client1, 'instance-1')).toBe(true);
      expect(canSendInput(client1, 'instance-2')).toBe(true);

      // Client2 can send to neither
      expect(canSendInput(client2, 'instance-1')).toBe(false);
      expect(canSendInput(client2, 'instance-2')).toBe(false);
    });

    it('releases all locks when client disconnects', () => {
      const client1 = createMockClient('client-1');

      handleSubscribe(client1, 'instance-1');
      handleSubscribe(client1, 'instance-2');
      handleSubscribe(client1, 'instance-3');

      client1.readyState = CLOSED;
      handleDisconnect(client1);

      expect(inputLocks.get('instance-1')).toBeUndefined();
      expect(inputLocks.get('instance-2')).toBeUndefined();
      expect(inputLocks.get('instance-3')).toBeUndefined();
    });
  });
});
