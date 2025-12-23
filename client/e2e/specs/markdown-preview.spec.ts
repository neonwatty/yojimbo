import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Markdown Preview', () => {
  const notesDir = path.join(os.homedir(), 'notes');
  const testNotePath = path.join(notesDir, 'markdown-test.md');

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
    // Ensure notes directory exists
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
  });

  test.afterEach(async () => {
    // Clean up test note
    if (fs.existsSync(testNotePath)) {
      fs.unlinkSync(testNotePath);
    }
  });

  test('renders markdown headings correctly', async ({ instancesPage }) => {
    // Create test note with headings
    fs.writeFileSync(testNotePath, '# Heading 1\n\n## Heading 2\n\n### Heading 3\n\nParagraph text.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify headings are rendered as HTML elements (not raw markdown)
    await expect(instancesPage.page.locator('h1:has-text("Heading 1")')).toBeVisible();
    await expect(instancesPage.page.locator('h2:has-text("Heading 2")')).toBeVisible();
    await expect(instancesPage.page.locator('h3:has-text("Heading 3")')).toBeVisible();
  });

  test('renders bold and italic text', async ({ instancesPage }) => {
    // Create test note with formatting
    fs.writeFileSync(testNotePath, '# Test\n\nThis is **bold** and *italic* text.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify bold is rendered as <strong>
    await expect(instancesPage.page.locator('strong:has-text("bold")')).toBeVisible();

    // Verify italic is rendered as <em>
    await expect(instancesPage.page.locator('em:has-text("italic")')).toBeVisible();
  });

  test('renders code blocks with syntax highlighting', async ({ instancesPage }) => {
    // Create test note with code block
    fs.writeFileSync(testNotePath, '# Code Test\n\n```javascript\nfunction hello() {\n  console.log("Hello");\n}\n```');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify code block is rendered (look for syntax highlighting class or pre/code elements)
    await expect(instancesPage.page.locator('pre').filter({ hasText: 'function' })).toBeVisible();
  });

  test('renders inline code', async ({ instancesPage }) => {
    // Create test note with inline code
    fs.writeFileSync(testNotePath, '# Test\n\nUse the `console.log()` function.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify inline code is rendered
    await expect(instancesPage.page.locator('code:has-text("console.log()")')).toBeVisible();
  });

  test('renders bullet lists', async ({ instancesPage }) => {
    // Create test note with bullet list
    fs.writeFileSync(testNotePath, '# List Test\n\n- Item 1\n- Item 2\n- Item 3');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify list items are rendered
    await expect(instancesPage.page.locator('li:has-text("Item 1")')).toBeVisible();
    await expect(instancesPage.page.locator('li:has-text("Item 2")')).toBeVisible();
    await expect(instancesPage.page.locator('li:has-text("Item 3")')).toBeVisible();
  });

  test('renders links correctly', async ({ instancesPage }) => {
    // Create test note with link
    fs.writeFileSync(testNotePath, '# Links\n\nVisit [Example](https://example.com) for more info.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify link is rendered with correct href
    const link = instancesPage.page.locator('a:has-text("Example")');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://example.com');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('can toggle between preview and edit mode', async ({ instancesPage }) => {
    // Create test note
    fs.writeFileSync(testNotePath, '# Test Note\n\nContent here.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("markdown-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Should be in preview mode by default (rendered markdown visible)
    await expect(instancesPage.page.locator('h1:has-text("Test Note")')).toBeVisible();

    // Click Edit button
    await instancesPage.page.locator('button:has-text("Edit")').click();
    await instancesPage.page.waitForTimeout(300);

    // Should now show textarea with raw markdown
    const textarea = instancesPage.page.locator('textarea:not([aria-label="Terminal input"])');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(/# Test Note/);

    // Click Cancel to go back to preview
    await instancesPage.page.locator('button:has-text("Cancel")').click();
    await instancesPage.page.waitForTimeout(300);

    // Should be back in preview mode
    await expect(instancesPage.page.locator('h1:has-text("Test Note")')).toBeVisible();
  });
});
