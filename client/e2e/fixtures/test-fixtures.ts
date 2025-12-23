import { test as base, expect } from '@playwright/test';
import { BasePage } from '../pages/base.page';
import { InstancesPage } from '../pages/instances.page';

const API_BASE = 'http://localhost:3456/api';

interface ApiClient {
  listInstances(): Promise<{ id: string; name: string }[]>;
  closeInstance(id: string): Promise<void>;
  cleanupAllInstances(): Promise<void>;
}

function createApiClient(): ApiClient {
  return {
    async listInstances() {
      const response = await fetch(`${API_BASE}/instances`);
      const data = await response.json();
      return data.data || [];
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
