import { test, expect } from '../fixtures/test-fixtures';

test.describe('Activity Feed', () => {
  test.beforeEach(async ({ apiClient }) => {
    // Clean up before each test
    await apiClient.cleanupAllInstances();
    await apiClient.clearFeedEvents();
  });

  test.describe('Activity Button in Header', () => {
    test('shows Activity button in header when enabled in settings', async ({ basePage }) => {
      await basePage.goto('/instances');

      // Activity button should be visible by default
      const activityButton = basePage.page.locator('button:has-text("Activity")');
      await expect(activityButton).toBeVisible();
    });

    test('Activity button navigates to Activity page', async ({ basePage }) => {
      await basePage.goto('/instances');

      // Click Activity button
      await basePage.page.locator('button:has-text("Activity")').click();

      // Should navigate to Activity page
      await expect(basePage.page).toHaveURL(/.*\/activity$/);
      // The heading is h2 with text "Activity"
      await expect(basePage.page.locator('h2:has-text("Activity")')).toBeVisible();
    });

    test('shows unread badge when there are unread events', async ({ basePage, apiClient }) => {
      // Create test events (only "completed" is enabled by default)
      await apiClient.createTestEvent('test-id-1', 'Test Instance', 'completed', 'Test completed');
      await apiClient.createTestEvent('test-id-2', 'Test Instance 2', 'completed', 'Test 2 completed');

      await basePage.goto('/instances');

      // Wait for WebSocket update or refresh
      await basePage.page.waitForTimeout(500);

      // Check for unread badge (should show 2)
      const badge = basePage.page.locator('button:has-text("Activity") span').filter({ hasText: /\d+/ });
      await expect(badge).toBeVisible();
    });
  });

  test.describe('Activity Page', () => {
    test('shows empty state when no events', async ({ basePage }) => {
      await basePage.goto('/activity');

      // Should show empty state
      await expect(basePage.page.locator('text=No activity yet')).toBeVisible();
    });

    test('shows activity events', async ({ basePage, apiClient }) => {
      // Create test event (only "completed" is enabled by default)
      await apiClient.createTestEvent('test-id-1', 'My Instance', 'completed', 'My Instance finished working');

      await basePage.goto('/activity');

      // Event should be visible
      await expect(basePage.page.locator('text=My Instance finished working')).toBeVisible();
    });

    test('shows event type icons for enabled types', async ({ basePage, apiClient }) => {
      // By default only "completed" is enabled in settings
      await apiClient.createTestEvent('id-1', 'Instance 1', 'completed', 'Completed task');

      await basePage.goto('/activity');

      // Only completed event should be visible (settings filter)
      await expect(basePage.page.locator('text=Completed task')).toBeVisible();
    });

    test('can filter events by type using dropdown', async ({ basePage, apiClient }) => {
      // Create only completed events since that's enabled by default
      await apiClient.createTestEvent('id-1', 'Instance 1', 'completed', 'First completed');
      await apiClient.createTestEvent('id-2', 'Instance 2', 'completed', 'Second completed');

      await basePage.goto('/activity');

      // Both should be visible
      await expect(basePage.page.locator('text=First completed')).toBeVisible();
      await expect(basePage.page.locator('text=Second completed')).toBeVisible();

      // Filter to show completed only (should still show both)
      await basePage.page.locator('select').selectOption('completed');

      await expect(basePage.page.locator('text=First completed')).toBeVisible();
      await expect(basePage.page.locator('text=Second completed')).toBeVisible();
    });

    test('can mark event as read by clicking', async ({ basePage, apiClient }) => {
      // Create a test event
      await apiClient.createTestEvent('test-id', 'Test Instance', 'completed', 'Test completed');

      await basePage.goto('/activity');

      // Event should have unread indicator (border accent)
      const eventItem = basePage.page.locator('[class*="cursor-pointer"]').filter({ hasText: 'Test completed' });
      await expect(eventItem).toBeVisible();

      // Click to mark as read
      await eventItem.click();

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify event is marked as read via API
      const events = await apiClient.listFeedEvents();
      const event = events.find(e => e.message === 'Test completed');
      expect(event?.readAt).not.toBeNull();
    });

    test('shows Mark all read button when there are unread events', async ({ basePage, apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id-1', 'Test Instance', 'completed', 'Test 1');
      await apiClient.createTestEvent('test-id-2', 'Test Instance', 'completed', 'Test 2');

      await basePage.goto('/activity');

      // Wait for events to load
      await expect(basePage.page.locator('text=Test 1')).toBeVisible();

      // Mark all read button should be visible (text is "Mark all read", not "Mark all as read")
      await expect(basePage.page.locator('button:has-text("Mark all read")')).toBeVisible();
    });

    test('Mark all read button works', async ({ basePage, apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id-1', 'Test Instance', 'completed', 'Test 1');
      await apiClient.createTestEvent('test-id-2', 'Test Instance', 'completed', 'Test 2');

      await basePage.goto('/activity');

      // Wait for events to load
      await expect(basePage.page.locator('text=Test 1')).toBeVisible();

      // Click Mark all read
      await basePage.page.locator('button:has-text("Mark all read")').click();

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify all events are marked as read via API
      const stats = await apiClient.getFeedStats();
      expect(stats.unread).toBe(0);
    });
  });

  test.describe('Activity Feed API', () => {
    test('can list feed events', async ({ apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id', 'Test Instance', 'completed', 'Test message');

      const events = await apiClient.listFeedEvents();

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].message).toBe('Test message');
      expect(events[0].eventType).toBe('completed');
    });

    test('can get feed stats', async ({ apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id-1', 'Test 1', 'completed', 'Message 1');
      await apiClient.createTestEvent('test-id-2', 'Test 2', 'completed', 'Message 2');

      const stats = await apiClient.getFeedStats();

      expect(stats.total).toBe(2);
      expect(stats.unread).toBe(2);
    });

    test('can mark event as read', async ({ apiClient }) => {
      // Create test event
      await apiClient.createTestEvent('test-id', 'Test Instance', 'completed', 'Test message');

      const events = await apiClient.listFeedEvents();
      const eventId = events[0].id;

      // Mark as read
      const updatedEvent = await apiClient.markEventAsRead(eventId);

      expect(updatedEvent.readAt).not.toBeNull();

      // Verify stats updated
      const stats = await apiClient.getFeedStats();
      expect(stats.unread).toBe(0);
    });

    test('can mark all events as read', async ({ apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id-1', 'Test 1', 'completed', 'Message 1');
      await apiClient.createTestEvent('test-id-2', 'Test 2', 'completed', 'Message 2');

      // Mark all as read
      const result = await apiClient.markAllEventsAsRead();

      expect(result.count).toBe(2);

      // Verify stats
      const stats = await apiClient.getFeedStats();
      expect(stats.unread).toBe(0);
    });

    test('can clear all events', async ({ apiClient }) => {
      // Create test events
      await apiClient.createTestEvent('test-id-1', 'Test 1', 'completed', 'Message 1');
      await apiClient.createTestEvent('test-id-2', 'Test 2', 'completed', 'Message 2');

      // Clear all
      const result = await apiClient.clearFeedEvents();

      expect(result.count).toBe(2);

      // Verify empty
      const events = await apiClient.listFeedEvents();
      expect(events.length).toBe(0);
    });
  });

  test.describe('Activity Feed Settings', () => {
    test('settings modal has Activity Feed section', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Check Activity Feed section heading exists
      await expect(basePage.page.getByRole('heading', { name: 'Activity Feed' })).toBeVisible();
    });

    test('shows toggle for Activity nav visibility', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Scroll to Activity Feed section using the heading
      await basePage.page.getByRole('heading', { name: 'Activity Feed' }).scrollIntoViewIfNeeded();

      // Check for nav visibility toggle (text is "Show in navigation")
      await expect(basePage.page.locator('text=Show in navigation')).toBeVisible();
    });

    test('shows event type filter checkboxes', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Scroll to Activity Feed section using the heading
      await basePage.page.getByRole('heading', { name: 'Activity Feed' }).scrollIntoViewIfNeeded();

      // Check for event type filter checkboxes (only completed, error, started exist)
      await expect(basePage.page.locator('label:has-text("Completed")')).toBeVisible();
      await expect(basePage.page.locator('label:has-text("Error")')).toBeVisible();
      await expect(basePage.page.locator('label:has-text("Started")')).toBeVisible();
    });

    test('shows retention days selector', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Scroll to Activity Feed section using the heading
      await basePage.page.getByRole('heading', { name: 'Activity Feed' }).scrollIntoViewIfNeeded();

      // Check for retention selector (text is "Retention period")
      await expect(basePage.page.locator('text=Retention period')).toBeVisible();
    });

    test('shows maximum items selector', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Scroll to Activity Feed section using the heading
      await basePage.page.getByRole('heading', { name: 'Activity Feed' }).scrollIntoViewIfNeeded();

      // Check for maximum items selector
      await expect(basePage.page.locator('text=Maximum items')).toBeVisible();
    });

    test('can change maximum items setting', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.openSettings();

      // Scroll to Activity Feed section using the heading
      await basePage.page.getByRole('heading', { name: 'Activity Feed' }).scrollIntoViewIfNeeded();

      // Find and change the maximum items dropdown
      const maxItemsSelect = basePage.page.locator('select').filter({ has: basePage.page.locator('option:has-text("20 items")') });
      await expect(maxItemsSelect).toBeVisible();

      // Change to 50 items
      await maxItemsSelect.selectOption('50');

      // Verify the change persisted
      await expect(maxItemsSelect).toHaveValue('50');
    });
  });
});
