import { Router } from 'express';
import { portForwardService } from '../services/port-forward.service.js';
import { broadcast } from '../websocket/server.js';

const router = Router();

// GET /api/instances/:id/ports - List active port forwards for an instance
router.get('/:id/ports', (req, res) => {
  try {
    const { id } = req.params;
    const forwards = portForwardService.getInstanceForwards(id);
    res.json({ success: true, data: forwards });
  } catch (error) {
    console.error('Error listing port forwards:', error);
    res.status(500).json({ success: false, error: 'Failed to list port forwards' });
  }
});

// POST /api/instances/:id/ports - Create a manual port forward
router.post('/:id/ports', async (req, res) => {
  try {
    const { id } = req.params;
    const { remotePort, localPort } = req.body;

    if (!remotePort || typeof remotePort !== 'number') {
      return res.status(400).json({ success: false, error: 'remotePort is required' });
    }

    const forward = await portForwardService.createForward(id, remotePort, localPort);

    if (!forward) {
      return res.status(500).json({ success: false, error: 'Failed to create port forward' });
    }

    broadcast({ type: 'port:forwarded', portForward: forward });

    res.status(201).json({ success: true, data: forward });
  } catch (error) {
    console.error('Error creating port forward:', error);
    res.status(500).json({ success: false, error: 'Failed to create port forward' });
  }
});

// DELETE /api/instances/:id/ports/:portId - Close a port forward
router.delete('/:id/ports/:portId', async (req, res) => {
  try {
    const { portId } = req.params;

    const success = await portForwardService.closeForward(portId);

    if (!success) {
      return res.status(404).json({ success: false, error: 'Port forward not found' });
    }

    broadcast({ type: 'port:closed', portForward: { id: portId } as any });

    res.json({ success: true, data: { id: portId } });
  } catch (error) {
    console.error('Error closing port forward:', error);
    res.status(500).json({ success: false, error: 'Failed to close port forward' });
  }
});

export default router;
