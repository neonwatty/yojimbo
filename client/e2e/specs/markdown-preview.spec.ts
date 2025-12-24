import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Markdown WYSIWYG Editor', () => {
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

    // Open notes panel and wait for it to be visible
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify headings are rendered as HTML elements in the WYSIWYG editor
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Heading 1")')).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content h2:has-text("Heading 2")')).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content h3:has-text("Heading 3")')).toBeVisible({ timeout: 5000 });
  });

  test('renders bold and italic text', async ({ instancesPage }) => {
    // Create test note with formatting
    fs.writeFileSync(testNotePath, '# Test\n\nThis is **bold** and *italic* text.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify bold is rendered as <strong>
    await expect(instancesPage.page.locator('.mdx-editor-content strong:has-text("bold")')).toBeVisible({ timeout: 5000 });

    // Verify italic is rendered as <em>
    await expect(instancesPage.page.locator('.mdx-editor-content em:has-text("italic")')).toBeVisible({ timeout: 5000 });
  });

  test('renders code blocks with syntax highlighting', async ({ instancesPage }) => {
    // Create test note with code block
    fs.writeFileSync(testNotePath, '# Code Test\n\n```javascript\nfunction hello() {\n  console.log("Hello");\n}\n```');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify code block is rendered (MDXEditor uses CodeMirror for code blocks)
    await expect(instancesPage.page.locator('.mdx-editor-content').filter({ hasText: 'function hello' })).toBeVisible({ timeout: 5000 });
  });

  test('renders inline code', async ({ instancesPage }) => {
    // Create test note with inline code
    fs.writeFileSync(testNotePath, '# Test\n\nUse the `console.log()` function.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify inline code is rendered
    await expect(instancesPage.page.locator('.mdx-editor-content code:has-text("console.log()")')).toBeVisible({ timeout: 5000 });
  });

  test('renders bullet lists', async ({ instancesPage }) => {
    // Create test note with bullet list
    fs.writeFileSync(testNotePath, '# List Test\n\n- Item 1\n- Item 2\n- Item 3');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify list items are rendered
    await expect(instancesPage.page.locator('.mdx-editor-content li:has-text("Item 1")')).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content li:has-text("Item 2")')).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content li:has-text("Item 3")')).toBeVisible({ timeout: 5000 });
  });

  test('renders links correctly', async ({ instancesPage }) => {
    // Create test note with link
    fs.writeFileSync(testNotePath, '# Links\n\nVisit [Example](https://example.com) for more info.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify link is rendered with correct href
    const link = instancesPage.page.locator('.mdx-editor-content a:has-text("Example")');
    await expect(link).toBeVisible({ timeout: 5000 });
    await expect(link).toHaveAttribute('href', 'https://example.com');
  });

  test('can toggle between WYSIWYG and source mode', async ({ instancesPage }) => {
    // Create test note
    fs.writeFileSync(testNotePath, '# Test Note\n\nContent here.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    const notesButton = instancesPage.page.locator('button:has-text("Notes")');
    await expect(notesButton).toBeVisible({ timeout: 5000 });
    await notesButton.click();

    // Wait for file browser and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("markdown-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for editor content to load (WYSIWYG mode by default)
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Verify heading is rendered in WYSIWYG mode
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Test Note")')).toBeVisible({ timeout: 5000 });

    // Click Source button to switch to source mode
    const sourceButton = instancesPage.page.locator('button:has-text("Source")');
    await expect(sourceButton).toBeVisible({ timeout: 5000 });
    await sourceButton.click();

    // Should now show textarea with raw markdown
    const textarea = instancesPage.page.locator('textarea').filter({ hasText: /# Test Note/ });
    await expect(textarea).toBeVisible({ timeout: 5000 });

    // Click WYSIWYG button to go back to WYSIWYG mode
    const wysiwygButton = instancesPage.page.locator('button:has-text("WYSIWYG")');
    await expect(wysiwygButton).toBeVisible({ timeout: 5000 });
    await wysiwygButton.click();

    // Should be back in WYSIWYG mode
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Test Note")')).toBeVisible({ timeout: 5000 });
  });
});
