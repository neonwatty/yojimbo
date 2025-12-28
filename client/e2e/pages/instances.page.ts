import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class InstancesPage extends BasePage {
  readonly newInstanceButton: Locator;
  readonly instanceCards: Locator;
  readonly newInstanceModal: Locator;

  constructor(page: Page) {
    super(page);
    // Target the card that contains "New Session" span (excludes tooltip)
    this.newInstanceButton = page.locator('.grid > div').filter({ has: page.locator('span:has-text("New Session")') });
    this.instanceCards = page.locator('.grid > div').filter({ hasNot: page.locator('span:has-text("New Session")') });
    // Target the modal dialog (fixed overlay with the New Session heading)
    this.newInstanceModal = page.locator('.fixed.inset-0').filter({ has: page.getByRole('heading', { name: 'New Session' }) });
  }

  async gotoInstances() {
    await this.goto('/instances');
  }

  async createNewInstance(name?: string) {
    // Click the New Session button (either in cards or header)
    await this.newInstanceButton.click();

    // Wait for modal to appear
    await expect(this.page.getByRole('heading', { name: 'New Session' })).toBeVisible({ timeout: 5000 });

    // Fill in the name if provided, otherwise use a default
    const instanceName = name || `instance-${Date.now()}`;
    await this.page.locator('input[placeholder="My Project"]').fill(instanceName);

    // Click Create Session button inside the modal
    await this.newInstanceModal.getByRole('button', { name: 'Create Session' }).click();

    // Wait for modal to close and navigation
    await this.page.waitForTimeout(500);
  }

  async getInstanceCount(): Promise<number> {
    return this.instanceCards.count();
  }

  async getInstanceCard(name: string): Locator {
    return this.page.locator('.grid > div').filter({ hasText: name }).first();
  }

  async getInstanceCardByIndex(index: number): Locator {
    return this.instanceCards.nth(index);
  }

  async clickInstanceCard(name: string) {
    const card = await this.getInstanceCard(name);
    await card.click();
  }

  async doubleClickInstanceCard(name: string) {
    const card = await this.getInstanceCard(name);
    await card.dblclick();
  }

  async expandInstance(name: string) {
    const card = await this.getInstanceCard(name);
    await card.hover();
    const expandButton = card.locator('button[title="Expand"]');
    await expandButton.click();
  }

  async closeInstance(name: string) {
    const card = await this.getInstanceCard(name);
    await card.hover();
    const closeButton = card.locator('button[title="Close"]');
    await closeButton.click();
  }

  async renameInstance(oldName: string, newName: string) {
    const card = await this.getInstanceCard(oldName);
    const nameElement = card.locator('span').filter({ hasText: oldName }).first();
    await nameElement.dblclick();

    const input = card.locator('input');
    await input.clear();
    await input.fill(newName);
    await input.press('Enter');
  }

  async waitForInstanceWithName(name: string, timeout = 5000) {
    await expect(this.page.locator('.grid > div').filter({ hasText: name })).toBeVisible({ timeout });
  }

  async isInstanceVisible(name: string): Promise<boolean> {
    return this.page.locator('.grid > div').filter({ hasText: name }).isVisible();
  }
}
