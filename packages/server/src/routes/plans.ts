import { FastifyPluginAsync } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';

interface PlanFile {
  id: string;
  name: string;
  path: string;
  modifiedAt: string;
}

interface ListPlansQuery {
  workingDir: string;
}

interface PlanParams {
  planId: string;
}

interface ReadPlanQuery {
  workingDir: string;
}

interface WritePlanBody {
  workingDir: string;
  content: string;
}

interface CreatePlanBody {
  workingDir: string;
  name: string;
  content?: string;
}

interface DeletePlanQuery {
  workingDir: string;
}

/**
 * Get the plans directory for a working directory
 */
function getPlansDir(workingDir: string): string {
  return path.join(workingDir, 'plans');
}

/**
 * Ensure plans directory exists
 */
function ensurePlansDir(workingDir: string): void {
  const plansDir = getPlansDir(workingDir);
  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true });
  }
}

/**
 * Get plan file path from ID (base64 encoded relative path)
 */
function getPlanPath(workingDir: string, planId: string): string {
  const relativePath = Buffer.from(planId, 'base64').toString('utf-8');
  return path.join(getPlansDir(workingDir), relativePath);
}

/**
 * Create plan ID from relative path (base64 encoded)
 */
function createPlanId(relativePath: string): string {
  return Buffer.from(relativePath).toString('base64');
}

/**
 * Recursively list markdown files in a directory
 */
function listMarkdownFiles(dir: string, basePath: string = ''): PlanFile[] {
  const files: PlanFile[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      files.push(...listMarkdownFiles(fullPath, relativePath));
    } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
      const stats = fs.statSync(fullPath);
      files.push({
        id: createPlanId(relativePath),
        name: entry.name,
        path: relativePath,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  }

  return files;
}

export const planRoutes: FastifyPluginAsync = async (fastify) => {
  // List all plans for a working directory
  fastify.get<{ Querystring: ListPlansQuery }>('/api/plans', async (request, reply) => {
    const { workingDir } = request.query;

    if (!workingDir) {
      return reply.status(400).send({ error: 'workingDir is required' });
    }

    const plansDir = getPlansDir(workingDir);
    const files = listMarkdownFiles(plansDir);

    // Sort by modification time, newest first
    files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return {
      workingDir,
      plansDir,
      files,
    };
  });

  // Read a single plan
  fastify.get<{ Params: PlanParams; Querystring: ReadPlanQuery }>(
    '/api/plans/:planId',
    async (request, reply) => {
      const { planId } = request.params;
      const { workingDir } = request.query;

      if (!workingDir) {
        return reply.status(400).send({ error: 'workingDir is required' });
      }

      try {
        const filePath = getPlanPath(workingDir, planId);

        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({ error: 'Plan not found' });
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);
        const relativePath = Buffer.from(planId, 'base64').toString('utf-8');

        return {
          id: planId,
          name: path.basename(relativePath),
          path: relativePath,
          content,
          modifiedAt: stats.mtime.toISOString(),
        };
      } catch (error) {
        console.error('Error reading plan:', error);
        return reply.status(500).send({ error: 'Failed to read plan' });
      }
    }
  );

  // Write/update a plan
  fastify.put<{ Params: PlanParams; Body: WritePlanBody }>(
    '/api/plans/:planId',
    async (request, reply) => {
      const { planId } = request.params;
      const { workingDir, content } = request.body;

      if (!workingDir) {
        return reply.status(400).send({ error: 'workingDir is required' });
      }

      if (content === undefined) {
        return reply.status(400).send({ error: 'content is required' });
      }

      try {
        const filePath = getPlanPath(workingDir, planId);

        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({ error: 'Plan not found' });
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        const stats = fs.statSync(filePath);
        const relativePath = Buffer.from(planId, 'base64').toString('utf-8');

        return {
          id: planId,
          name: path.basename(relativePath),
          path: relativePath,
          modifiedAt: stats.mtime.toISOString(),
          success: true,
        };
      } catch (error) {
        console.error('Error writing plan:', error);
        return reply.status(500).send({ error: 'Failed to write plan' });
      }
    }
  );

  // Create a new plan
  fastify.post<{ Body: CreatePlanBody }>('/api/plans', async (request, reply) => {
    const { workingDir, name, content = '' } = request.body;

    if (!workingDir) {
      return reply.status(400).send({ error: 'workingDir is required' });
    }

    if (!name) {
      return reply.status(400).send({ error: 'name is required' });
    }

    // Ensure name ends with .md or .mdx
    let fileName = name;
    if (!/\.(md|mdx)$/i.test(fileName)) {
      fileName = `${fileName}.md`;
    }

    try {
      ensurePlansDir(workingDir);
      const filePath = path.join(getPlansDir(workingDir), fileName);

      if (fs.existsSync(filePath)) {
        return reply.status(409).send({ error: 'Plan already exists' });
      }

      // Create default content if empty
      const defaultContent =
        content ||
        `# ${name.replace(/\.(md|mdx)$/i, '')}\n\n## Summary\n\nDescribe the plan here.\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step\n`;

      fs.writeFileSync(filePath, defaultContent, 'utf-8');
      const stats = fs.statSync(filePath);
      const planId = createPlanId(fileName);

      return {
        id: planId,
        name: fileName,
        path: fileName,
        modifiedAt: stats.mtime.toISOString(),
        success: true,
      };
    } catch (error) {
      console.error('Error creating plan:', error);
      return reply.status(500).send({ error: 'Failed to create plan' });
    }
  });

  // Delete a plan
  fastify.delete<{ Params: PlanParams; Querystring: DeletePlanQuery }>(
    '/api/plans/:planId',
    async (request, reply) => {
      const { planId } = request.params;
      const { workingDir } = request.query;

      if (!workingDir) {
        return reply.status(400).send({ error: 'workingDir is required' });
      }

      try {
        const filePath = getPlanPath(workingDir, planId);

        if (!fs.existsSync(filePath)) {
          return reply.status(404).send({ error: 'Plan not found' });
        }

        fs.unlinkSync(filePath);

        return { success: true };
      } catch (error) {
        console.error('Error deleting plan:', error);
        return reply.status(500).send({ error: 'Failed to delete plan' });
      }
    }
  );
};
