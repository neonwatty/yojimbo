import { Router } from 'express';
import { sshConnectionService } from '../services/ssh-connection.service.js';

const router = Router();

// GET /api/ssh/keys - List available SSH keys
router.get('/keys', (_req, res) => {
  try {
    const keys = sshConnectionService.listSSHKeys();
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error('Error listing SSH keys:', error);
    res.status(500).json({ success: false, error: 'Failed to list SSH keys' });
  }
});

export default router;
