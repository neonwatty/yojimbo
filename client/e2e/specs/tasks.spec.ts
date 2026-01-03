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

      // Click the checkbox (the status icon button) - target the task item div specifically
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'Task to complete' });
      const checkbox = taskItem.locator('button').first();
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

    test('copy to clipboard works', async ({ basePage, apiClient, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await apiClient.createTask('CopyTaskTest');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=CopyTaskTest')).toBeVisible();

      // Hover and click dispatch on the task item
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'CopyTaskTest' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Click copy to clipboard - the dropdown should close after clicking
      await basePage.page.locator('text=Copy to clipboard').click();

      // Dropdown should close after successful copy (Copy to clipboard option no longer visible)
      await expect(basePage.page.locator('text=Copy to clipboard')).not.toBeVisible();
    });

    test('shows running instances in dispatch dropdown', async ({ basePage, apiClient }) => {
      // Create an instance
      await apiClient.createInstance({ name: 'DropdownInstance', workingDir: '/tmp' });

      // Create a task
      await apiClient.createTask('TaskForDropdown');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=TaskForDropdown')).toBeVisible();

      // Hover and click dispatch on the task item
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'TaskForDropdown' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Should show the instance in the dropdown (check within the dispatch dropdown)
      await expect(basePage.page.locator('text=Running Instances')).toBeVisible();
      // The dropdown is the one with shadow-xl class
      const dropdown = basePage.page.locator('.shadow-xl');
      await expect(dropdown.locator('text=DropdownInstance')).toBeVisible();
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

    test('dispatch to instance via API updates task status', async ({ apiClient }) => {
      // Create an instance
      const instance = await apiClient.createInstance({ name: 'Dispatch Target', workingDir: '/tmp' });

      // Create a task
      const task = await apiClient.createTask('Task to dispatch via API');

      // Dispatch the task
      const dispatchedTask = await apiClient.dispatchTask(task.id, instance.id);

      // Verify task is now in_progress and linked to instance
      expect(dispatchedTask.status).toBe('in_progress');
      expect(dispatchedTask.dispatchedInstanceId).toBe(instance.id);
      expect(dispatchedTask.dispatchedAt).not.toBeNull();
    });

    test('dispatch to instance via UI shows in-progress status', async ({ basePage, apiClient }) => {
      // Create an instance
      const instance = await apiClient.createInstance({ name: 'DispatchTargetUI', workingDir: '/tmp' });

      // Create a task
      const task = await apiClient.createTask('UIDispatchTask');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=UIDispatchTask')).toBeVisible();

      // Hover and click dispatch on the task item
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'UIDispatchTask' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Click on the instance in the dropdown (use the dispatch dropdown with shadow-xl)
      const dropdown = basePage.page.locator('.shadow-xl');
      await dropdown.locator('text=DispatchTargetUI').click();

      // Wait for update
      await basePage.page.waitForTimeout(500);

      // Verify via API that task was dispatched
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.dispatchedInstanceId).toBe(instance.id);
    });

    test('create new instance from dispatch opens modal', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task for new instance');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task for new instance')).toBeVisible();

      // Hover and click dispatch
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'Task for new instance' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Click "Create new instance"
      await basePage.page.locator('text=Create new instance').click();

      // Tasks panel should close and New Session modal should open
      await expect(basePage.page.locator('h2:has-text("Global Tasks")')).not.toBeVisible();
      await expect(basePage.page.locator('h2:has-text("New Session")')).toBeVisible();
    });

    test('create new instance defaults to Claude Code mode', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task for Claude Code');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task for Claude Code')).toBeVisible();

      // Hover and click dispatch
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'Task for Claude Code' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click();

      // Click "Create new instance"
      await basePage.page.locator('text=Create new instance').click();

      // New Session modal should open
      await expect(basePage.page.locator('h2:has-text("New Session")')).toBeVisible();

      // Claude Code button should be selected (has the active styling)
      const claudeCodeButton = basePage.page.locator('button').filter({ hasText: 'Claude Code' });
      await expect(claudeCodeButton).toHaveClass(/bg-frost-4/);
    });

    test('create new instance copies task to clipboard', async ({ basePage, apiClient, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await apiClient.createTask('ClipboardTaskNewInstance');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=ClipboardTaskNewInstance')).toBeVisible();

      // Hover and click dispatch
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'ClipboardTaskNewInstance' });
      await taskItem.hover();
      const dispatchButton = taskItem.locator('button[title="Dispatch to instance"]');
      await dispatchButton.click({ force: true });

      // Click "Create new instance"
      await basePage.page.locator('text=Create new instance').click();

      // Wait for modal to open
      await expect(basePage.page.locator('h2:has-text("New Session")')).toBeVisible();

      // Verify clipboard contains the task text
      const clipboardText = await basePage.page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe('ClipboardTaskNewInstance');
    });
  });

  test.describe('Task Creation Flow', () => {
    test('input clears after task creation', async ({ basePage }) => {
      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      const input = basePage.page.locator('input[placeholder="Add a new task..."]');
      await input.fill('Task to create');
      await basePage.page.locator('button:has-text("Add")').click();

      // Wait for task to appear
      await expect(basePage.page.locator('text=Task to create')).toBeVisible();

      // Input should be cleared
      await expect(input).toHaveValue('');
    });

    test('can create multiple tasks in sequence', async ({ basePage, apiClient }) => {
      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      const input = basePage.page.locator('input[placeholder="Add a new task..."]');

      // Create first task
      await input.fill('First task');
      await basePage.page.locator('button:has-text("Add")').click();
      await expect(basePage.page.locator('text=First task')).toBeVisible();

      // Create second task
      await input.fill('Second task');
      await basePage.page.locator('button:has-text("Add")').click();
      await expect(basePage.page.locator('text=Second task')).toBeVisible();

      // Create third task
      await input.fill('Third task');
      await basePage.page.locator('button:has-text("Add")').click();
      await expect(basePage.page.locator('text=Third task')).toBeVisible();

      // Verify via API
      const tasks = await apiClient.listTasks();
      expect(tasks.length).toBe(3);
    });

    test('pending badge updates after task creation', async ({ basePage, apiClient }) => {
      // Start with one task
      await apiClient.createTask('Initial task');

      await basePage.goto('/instances');

      // Wait for WebSocket update
      await basePage.page.waitForTimeout(500);

      // Badge should show 1
      const badge = basePage.page.locator('button:has-text("Tasks") span').filter({ hasText: /\d+/ });
      await expect(badge).toHaveText('1');

      // Open tasks and create another
      await basePage.page.locator('button:has-text("Tasks")').click();
      const input = basePage.page.locator('input[placeholder="Add a new task..."]');
      await input.fill('Second task');
      await basePage.page.locator('button:has-text("Add")').click();

      // Wait for task to appear
      await expect(basePage.page.locator('text=Second task')).toBeVisible();

      // Close modal
      await basePage.page.keyboard.press('Escape');

      // Wait for WebSocket update
      await basePage.page.waitForTimeout(500);

      // Badge should update to show 2
      await expect(badge).toHaveText('2');
    });
  });

  test.describe('Task Editing', () => {
    test('can edit task via edit button', async ({ basePage, apiClient }) => {
      const task = await apiClient.createTask('EditButtonTask');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task text
      await expect(basePage.page.locator('text=EditButtonTask')).toBeVisible();

      // Find the task row and hover to show action buttons
      const taskRow = basePage.page.locator('div.group').filter({ hasText: 'EditButtonTask' });
      await taskRow.hover();

      // Click edit button
      await taskRow.locator('button[title="Edit task"]').click({ force: true });

      // Wait for edit mode - find the input with the task value
      const editInput = basePage.page.locator('input[value="EditButtonTask"]');
      await expect(editInput).toBeVisible({ timeout: 5000 });

      // Clear, type new text, and press Enter (using keyboard since selector changes after fill)
      await editInput.fill('UpdatedButtonTask');
      await basePage.page.keyboard.press('Enter');

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify new text is shown
      await expect(basePage.page.locator('text=UpdatedButtonTask')).toBeVisible();

      // Verify via API
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.text).toBe('UpdatedButtonTask');
    });

    test('can edit task via double-click', async ({ basePage, apiClient }) => {
      const task = await apiClient.createTask('DoubleClickTask');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task text
      await expect(basePage.page.locator('text=DoubleClickTask')).toBeVisible();

      // Double-click the task text to edit
      const taskText = basePage.page.locator('p.font-mono').filter({ hasText: 'DoubleClickTask' });
      await taskText.dblclick();

      // Wait for edit mode - find the input with the task value
      const editInput = basePage.page.locator('input[value="DoubleClickTask"]');
      await expect(editInput).toBeVisible({ timeout: 5000 });

      // Type new text and press Enter (using keyboard since selector changes after fill)
      await editInput.fill('DoubleClickedEdit');
      await basePage.page.keyboard.press('Enter');

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify new text
      await expect(basePage.page.locator('text=DoubleClickedEdit')).toBeVisible();

      // Verify via API
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.text).toBe('DoubleClickedEdit');
    });

    test('Escape cancels edit without saving', async ({ basePage, apiClient }) => {
      const task = await apiClient.createTask('EscapeCancelTask');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task text
      await expect(basePage.page.locator('text=EscapeCancelTask')).toBeVisible();

      // Find the task row and hover
      const taskRow = basePage.page.locator('div.group').filter({ hasText: 'EscapeCancelTask' });
      await taskRow.hover();
      await taskRow.locator('button[title="Edit task"]').click({ force: true });

      // Wait for edit mode - find the input with the task value
      const editInput = basePage.page.locator('input[value="EscapeCancelTask"]');
      await expect(editInput).toBeVisible({ timeout: 5000 });

      // Type new text
      await editInput.fill('ChangedText');

      // Press Escape to cancel (using keyboard since selector changes after fill)
      await basePage.page.keyboard.press('Escape');

      // Wait for state update
      await basePage.page.waitForTimeout(100);

      // Original text should still be shown
      await expect(basePage.page.locator('text=EscapeCancelTask')).toBeVisible();
      await expect(basePage.page.locator('text=ChangedText')).not.toBeVisible();

      // Verify via API that text was not changed
      const unchangedTask = await apiClient.getTask(task.id);
      expect(unchangedTask.text).toBe('EscapeCancelTask');
    });

    test('blur saves edit', async ({ basePage, apiClient }) => {
      const task = await apiClient.createTask('BlurSaveTask');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task text
      await expect(basePage.page.locator('text=BlurSaveTask')).toBeVisible();

      // Find the task row and hover
      const taskRow = basePage.page.locator('div.group').filter({ hasText: 'BlurSaveTask' });
      await taskRow.hover();
      await taskRow.locator('button[title="Edit task"]').click({ force: true });

      // Wait for edit mode - find the input with the task value
      const editInput = basePage.page.locator('input[value="BlurSaveTask"]');
      await expect(editInput).toBeVisible({ timeout: 5000 });

      // Type new text
      await editInput.fill('SavedViaBlur');

      // Click elsewhere to blur (on the modal header)
      await basePage.page.locator('h2:has-text("Global Tasks")').click();

      // Wait for update
      await basePage.page.waitForTimeout(300);

      // Verify new text is shown
      await expect(basePage.page.locator('text=SavedViaBlur')).toBeVisible();

      // Verify via API
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.text).toBe('SavedViaBlur');
    });

    test('edit updates task via API', async ({ apiClient }) => {
      const task = await apiClient.createTask('API edit test');

      // Update via API
      const updated = await apiClient.updateTask(task.id, { text: 'API updated text' });

      expect(updated.text).toBe('API updated text');
      expect(updated.id).toBe(task.id);
    });
  });

  test.describe('Task Deletion Flow', () => {
    test('delete task removes it from UI immediately', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task to delete immediately');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Task to delete immediately')).toBeVisible();

      // Hover and delete
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Task to delete immediately' }).first();
      await taskRow.hover();
      const deleteButton = taskRow.locator('button[title="Delete task"]');
      await deleteButton.click();

      // Task should be removed from UI
      await expect(basePage.page.locator('text=Task to delete immediately')).not.toBeVisible();
    });

    test('delete last task shows empty state', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Only task');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for task
      await expect(basePage.page.locator('text=Only task')).toBeVisible();

      // Hover and delete
      const taskRow = basePage.page.locator('div').filter({ hasText: 'Only task' }).first();
      await taskRow.hover();
      const deleteButton = taskRow.locator('button[title="Delete task"]');
      await deleteButton.click();

      // Wait for deletion
      await basePage.page.waitForTimeout(300);

      // Should show empty state
      await expect(basePage.page.locator('text=No tasks yet')).toBeVisible();
    });

    test('pending badge updates after task deletion', async ({ basePage, apiClient }) => {
      // Create two tasks with unique names
      await apiClient.createTask('DeleteBadgeTaskA');
      await apiClient.createTask('DeleteBadgeTaskB');

      await basePage.goto('/instances');

      // Wait for WebSocket update
      await basePage.page.waitForTimeout(500);

      // Badge should show 2
      const badge = basePage.page.locator('button:has-text("Tasks") span').filter({ hasText: /\d+/ });
      await expect(badge).toHaveText('2');

      // Open tasks and delete one
      await basePage.page.locator('button:has-text("Tasks")').click();
      const taskItem = basePage.page.locator('div.group').filter({ hasText: 'DeleteBadgeTaskA' });
      await taskItem.hover();
      const deleteButton = taskItem.locator('button[title="Delete task"]');
      await deleteButton.click();

      // Wait for deletion
      await basePage.page.waitForTimeout(300);

      // Close modal
      await basePage.page.keyboard.press('Escape');

      // Wait for WebSocket update
      await basePage.page.waitForTimeout(500);

      // Badge should update to show 1
      await expect(badge).toHaveText('1');
    });

    test('can delete multiple tasks', async ({ basePage, apiClient }) => {
      await apiClient.createTask('MultiDeleteA');
      await apiClient.createTask('MultiDeleteB');
      await apiClient.createTask('MultiKeeper');

      await basePage.goto('/instances');
      await basePage.page.locator('button:has-text("Tasks")').click();

      // Wait for tasks
      await expect(basePage.page.locator('text=MultiDeleteA')).toBeVisible();
      await expect(basePage.page.locator('text=MultiDeleteB')).toBeVisible();
      await expect(basePage.page.locator('text=MultiKeeper')).toBeVisible();

      // Delete first task using task item locator
      let taskItem = basePage.page.locator('div.group').filter({ hasText: 'MultiDeleteA' });
      await taskItem.hover();
      await taskItem.locator('button[title="Delete task"]').click();
      await basePage.page.waitForTimeout(200);

      // Delete second task
      taskItem = basePage.page.locator('div.group').filter({ hasText: 'MultiDeleteB' });
      await taskItem.hover();
      await taskItem.locator('button[title="Delete task"]').click();
      await basePage.page.waitForTimeout(200);

      // Verify only "MultiKeeper" remains
      await expect(basePage.page.locator('text=MultiDeleteA')).not.toBeVisible();
      await expect(basePage.page.locator('text=MultiDeleteB')).not.toBeVisible();
      await expect(basePage.page.locator('text=MultiKeeper')).toBeVisible();

      // Verify via API
      const tasks = await apiClient.listTasks();
      expect(tasks.length).toBe(1);
      expect(tasks[0].text).toBe('MultiKeeper');
    });
  });
});
