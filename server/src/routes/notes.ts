import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Note, CreateNoteRequest, UpdateNoteRequest } from '@cc-orchestrator/shared';
import { startWatching } from '../services/file-watcher.service.js';

const router = Router();

// Expand ~ to home directory
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

// GET /api/notes - List notes for a working directory
router.get('/', (req, res) => {
  try {
    const workingDir = req.query.workingDir as string;

    if (!workingDir) {
      return res.status(400).json({ success: false, error: 'workingDir is required' });
    }

    const notesDir = path.join(expandPath(workingDir), 'notes');

    if (!fs.existsSync(notesDir)) {
      return res.json({ success: true, data: [], hasNotesDir: false });
    }

    const notes: Note[] = [];

    function scanDirectory(dir: string, folder: string | null = null): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, entry.name);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          notes.push({
            id: Buffer.from(fullPath).toString('base64'),
            name: entry.name,
            path: fullPath,
            folder,
            content: '', // Don't load content in list view
            isDirty: false,
          });
        }
      }
    }

    scanDirectory(notesDir);

    // Start watching for file changes in this directory
    startWatching(expandPath(workingDir), 'note');

    res.json({ success: true, data: notes, hasNotesDir: true });
  } catch (error) {
    console.error('Error listing notes:', error);
    res.status(500).json({ success: false, error: 'Failed to list notes' });
  }
});

// GET /api/notes/:id - Read note file content
router.get('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath);
    const folder = path.basename(path.dirname(filePath));
    const notesIndex = filePath.indexOf('/notes/');
    const parentFolder = notesIndex >= 0 && folder !== 'notes' ? folder : null;

    const note: Note = {
      id: req.params.id,
      name,
      path: filePath,
      folder: parentFolder,
      content,
      isDirty: false,
    };

    res.json({ success: true, data: note });
  } catch (error) {
    console.error('Error reading note:', error);
    res.status(500).json({ success: false, error: 'Failed to read note' });
  }
});

// PUT /api/notes/:id - Update note file
router.put('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');
    const { content } = req.body as UpdateNoteRequest;

    if (content === undefined) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
});

// POST /api/notes/init - Initialize notes directory
router.post('/init', (req, res) => {
  try {
    const { workingDir } = req.body as { workingDir: string };

    if (!workingDir) {
      return res.status(400).json({ success: false, error: 'workingDir is required' });
    }

    const notesDir = path.join(expandPath(workingDir), 'notes');

    if (fs.existsSync(notesDir)) {
      return res.json({ success: true, data: { created: false, message: 'Directory already exists' } });
    }

    fs.mkdirSync(notesDir, { recursive: true });

    // Start watching for file changes in this directory
    startWatching(expandPath(workingDir), 'note');

    res.status(201).json({ success: true, data: { created: true } });
  } catch (error) {
    console.error('Error initializing notes directory:', error);
    res.status(500).json({ success: false, error: 'Failed to create notes directory' });
  }
});

// POST /api/notes - Create new note file
router.post('/', (req, res) => {
  try {
    const { workingDir, name, content = '' } = req.body as CreateNoteRequest;

    if (!workingDir || !name) {
      return res.status(400).json({ success: false, error: 'workingDir and name are required' });
    }

    const notesDir = path.join(expandPath(workingDir), 'notes');

    // Create notes directory if it doesn't exist
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Ensure .md extension
    const fileName = name.endsWith('.md') || name.endsWith('.mdx') ? name : `${name}.md`;
    const filePath = path.join(notesDir, fileName);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ success: false, error: 'Note already exists' });
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    const note: Note = {
      id: Buffer.from(filePath).toString('base64'),
      name: fileName,
      path: filePath,
      folder: null,
      content,
      isDirty: false,
    };

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
});

// DELETE /api/notes/:id - Delete note file
router.delete('/:id', (req, res) => {
  try {
    const filePath = Buffer.from(req.params.id, 'base64').toString('utf-8');

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
});

export default router;
