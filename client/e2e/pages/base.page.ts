import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly settingsModal: Locator;
  readonly shortcutsModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.settingsModal = page.locator('h2:has-text("Settings")').locator('xpath=ancestor::div[contains(@class, "fixed")]');
    this.shortcutsModal = page.locator('h2:has-text("Keyboard Shortcuts")').locator('xpath=ancestor::div[contains(@class, "fixed")]');
  }

  async goto(path: string = '/') {
    await this.page.goto(path);
    await this.waitForApp();
  }

  async waitForApp() {
    await this.page.waitForLoadState('networkidle');
  }

  async openSettings() {
    await this.page.keyboard.press('Meta+Comma');
    await expect(this.page.locator('h2:has-text("Settings")')).toBeVisible();
  }

  async openShortcuts() {
    await this.page.keyboard.press('Meta+Slash');
    await expect(this.page.locator('h2:has-text("Keyboard Shortcuts")')).toBeVisible();
  }

  async closeModalWithEscape() {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async isSettingsModalVisible(): Promise<boolean> {
    return this.page.locator('h2:has-text("Settings")').isVisible();
  }

  async isShortcutsModalVisible(): Promise<boolean> {
    return this.page.locator('h2:has-text("Keyboard Shortcuts")').isVisible();
  }
}
