import { test, expect } from '../fixtures/test-fixtures';

test.describe('Global Tasks', () => {
  test.beforeEach(async ({ apiClient }) => {
    // Clean up before each test
    await apiClient.cleanupAllTasks();
    await apiClient.cleanupAllInstances();
  });

  test.describe('Tasks Button in Header', () => {
    test('shows Tasks button in header', async ({ basePage }) => {
      await basePage.goto('/instances');

      // Tasks button should be visible
      const tasksButton = basePage.page.locator('button:has-text("Tasks")');
      await expect(tasksButton).toBeVisible();
    });

    test('Tasks button opens modal with keyboard shortcut', async ({ basePage }) => {
      await basePage.goto('/instances');

      // Press Cmd+G to open tasks panel
      await basePage.page.keyboard.press('Meta+g');

      // Should show tasks modal
      await expect(basePage.page.locator('h2:has-text("Global Tasks")')).toBeVisible();
    });

    test('Tasks button click opens modal', async ({ basePage }) => {
      await basePage.goto('/instances');

      // Click Tasks button
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Should show tasks modal
      await expect(basePage.page.locator('h2:has-text("Global Tasks")')).toBeVisible();
    });

    test('shows pending badge when there are tasks', async ({ basePage, apiClient }) => {
      // Create test tasks
      await apiClient.createTask('Test task 1');
      await apiClient.createTask('Test task 2');

      await basePage.goto('/instances');

      // Wait for WebSocket update
      await basePage.page.waitForTimeout(500);

      // Check for pending badge (should show 2)
      const badge = basePage.page.locator('button:has-text("Tasks") span').filter({ hasText: /\d+/ });
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('2');
    });
  });

  test.describe('Tasks Panel', () => {
    test('shows empty state when no tasks', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Should show empty state
      await expect(basePage.page.locator('text=No tasks yet')).toBeVisible();
    });

    test('can create a new task', async ({ basePage, apiClient }) => {
      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Type in the input
      const input = basePage.page.locator('input[placeholder="Add a new task..."]');
      await input.fill('My new task');

      // Click Add button
      await basePage.page.locator('button:has-text("Add")').click();

      // Wait for task to appear
      await expect(basePage.page.locator('text=My new task')).toBeVisible();

      // Verify via API
      const tasks = await apiClient.listTasks();
      expect(tasks.length).toBe(1);
      expect(tasks[0].text).toBe('My new task');
    });

    test('can mark task as done', async ({ basePage, apiClient }) => {
      // Create test task via API
      const task = await apiClient.createTask('Task to complete');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task to appear
      await expect(basePage.page.locator('text=Task to complete')).toBeVisible();

      // Click the checkbox (the status icon button)
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to complete' }).first();
      const checkbox = taskRow.locator('button').first();
      await checkbox.click();

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify via API
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.status).toBe('done');
    });

    test('can delete task', async ({ basePage, apiClient }) => {
      // Create test task via API
      await apiClient.createTask('Task to delete');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task to appear
      await expect(basePage.page.locator('text=Task to delete')).toBeVisible();

      // Hover to reveal delete button and click it
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to delete' }).first();
      await taskRow.hover();

      // Click delete button (trash icon)
      const deleteButton = taskRow.locator('button[title="Delete task"]');
      await deleteButton.click();

      // Wait for deletion
      await basePage.page.waitForTimeout(300);

      // Verify task is gone
      await expect(basePage.page.locator('text=Task to delete')).not.toBeVisible();

      // Verify via API
      const tasks = await apiClient.listTasks();
      expect(tasks.length).toBe(0);
    });

    test('Escape key closes modal', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Verify modal is open
      await expect(basePage.page.locator('h2:has-text("Global Tasks")')).toBeVisible();

      // Press Escape
      await basePage.page.keyboard.press('Escape');

      // Modal should be closed
      await expect(basePage.page.locator('h2:has-text("Global Tasks")')).not.toBeVisible();
    });
  });

  test.describe('Tasks API', () => {
    test('can list tasks', async ({ apiClient }) => {
      // Create test tasks
      await apiClient.createTask('Task 1');
      await apiClient.createTask('Task 2');

      const tasks = await apiClient.listTasks();

      expect(tasks.length).toBe(2);
      expect(tasks.map(t => t.text)).toContain('Task 1');
      expect(tasks.map(t => t.text)).toContain('Task 2');
    });

    test('can create task', async ({ apiClient }) => {
      const task = await apiClient.createTask('New task');

      expect(task.text).toBe('New task');
      expect(task.status).toBe('captured');
      expect(task.id).toBeDefined();
    });

    test('can get task by id', async ({ apiClient }) => {
      const created = await apiClient.createTask('Test task');
      const task = await apiClient.getTask(created.id);

      expect(task.text).toBe('Test task');
      expect(task.id).toBe(created.id);
    });

    test('can update task', async ({ apiClient }) => {
      const task = await apiClient.createTask('Original text');
      const updated = await apiClient.updateTask(task.id, { text: 'Updated text' });

      expect(updated.text).toBe('Updated text');
    });

    test('can mark task as done', async ({ apiClient }) => {
      const task = await apiClient.createTask('Task to complete');
      const completed = await apiClient.markTaskDone(task.id);

      expect(completed.status).toBe('done');
      expect(completed.completedAt).not.toBeNull();
    });

    test('can delete task', async ({ apiClient }) => {
      const task = await apiClient.createTask('Task to delete');
      await apiClient.deleteTask(task.id);

      const tasks = await apiClient.listTasks();
      expect(tasks.find(t => t.id === task.id)).toBeUndefined();
    });

    test('can get task stats', async ({ apiClient }) => {
      // Create tasks with different statuses
      await apiClient.createTask('Captured task');
      const taskToComplete = await apiClient.createTask('To complete');
      await apiClient.markTaskDone(taskToComplete.id);

      const stats = await apiClient.getTaskStats();

      expect(stats.total).toBe(2);
      expect(stats.captured).toBe(1);
      expect(stats.done).toBe(1);
    });
  });

  test.describe('Task Dispatch', () => {
    test('dispatch button shows dropdown', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task to dispatch');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task to dispatch')).toBeVisible();

      // Hover over task to reveal dispatch button
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to dispatch' }).first();
      await taskRow.hover();

      // Click dispatch button
      const dispatchButton = taskRow.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Dropdown should be visible with Copy option
      await expect(basePage.page.locator('text=Copy to clipboard')).toBeVisible();
    });

    test('copy to clipboard works', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task text to copy');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task text to copy')).toBeVisible();

      // Hover and click dispatch
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task text to copy' }).first();
      await taskRow.hover();
      const dispatchButton = taskRow.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Click copy to clipboard
      await basePage.page.locator('text=Copy to clipboard').click();

      // Should show success toast
      await expect(basePage.page.locator('text=Copied to clipboard')).toBeVisible();
    });

    test('shows running instances in dispatch dropdown', async ({ basePage, apiClient }) => {
      // Create an instance
      await apiClient.createInstance({ name: 'Test Instance', workingDir: '/tmp' });

      // Create a task
      await apiClient.createTask('Task to dispatch');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task to dispatch')).toBeVisible();

      // Hover and click dispatch
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to dispatch' }).first();
      await taskRow.hover();
      const dispatchButton = taskRow.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Should show the instance
      await expect(basePage.page.locator('text=Running Instances')).toBeVisible();
      await expect(basePage.page.locator('text=Test Instance')).toBeVisible();
    });

    test('shows create new instance option', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task to dispatch');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task to dispatch')).toBeVisible();

      // Hover and click dispatch
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to dispatch' }).first();
      await taskRow.hover();
      const dispatchButton = taskRow.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Should show create new instance option
      await expect(basePage.page.locator('text=Create new instance')).toBeVisible();
    });
  });
});
