import { test as base, expect } from '@playwright/test';
import { BasePage } from '../pages/base.page';
import { InstancesPage } from '../pages/instances.page';

const API_BASE = 'http://localhost:3456/api';

interface ApiClient {
  listInstances(): Promise<{ id: string; name: string }[]>;
  createInstance(data: { name: string; workingDir: string }): Promise<{ id: string; name: string }>;
  updateInstance(id: string, data: { name?: string; isPinned?: boolean }): Promise<{ id: string; name: string }>;
  closeInstance(id: string): Promise<void>;
  cleanupAllInstances(): Promise<void>;
  getSettings(): Promise<{ theme: string; terminalFontSize: number }>;
  resetDatabase(): Promise<{ reset: boolean }>;
}

function createApiClient(): ApiClient {
  return {
    async listInstances() {
      const response = await fetch(`${API_BASE}/instances`);
      const data = await response.json();
      return data.data || [];
    },

    async createInstance(data: { name: string; workingDir: string }) {
      const response = await fetch(`${API_BASE}/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return result.data;
    },

    async updateInstance(id: string, data: { name?: string; isPinned?: boolean }) {
      const response = await fetch(`${API_BASE}/instances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return result.data;
    },

    async closeInstance(id: string) {
      await fetch(`${API_BASE}/instances/${id}`, {
        method: 'DELETE',
      });
    },

    async cleanupAllInstances() {
      const instances = await this.listInstances();
      for (const instance of instances) {
        await this.closeInstance(instance.id);
      }
    },

    async getSettings() {
      const response = await fetch(`${API_BASE}/settings`);
      const data = await response.json();
      return data.data;
    },

    async resetDatabase() {
      const response = await fetch(`${API_BASE}/settings/reset-database`, {
        method: 'POST',
      });
      const data = await response.json();
      return data.data;
    },
  };
}

type TestFixtures = {
  basePage: BasePage;
  instancesPage: InstancesPage;
  apiClient: ApiClient;
};

export const test = base.extend<TestFixtures>({
  basePage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await use(basePage);
  },

  instancesPage: async ({ page }, use) => {
    const instancesPage = new InstancesPage(page);
    await use(instancesPage);
  },

  apiClient: async ({}, use) => {
    const client = createApiClient();
    await use(client);
    // Cleanup after each test
    await client.cleanupAllInstances();
  },
});

export { expect };
