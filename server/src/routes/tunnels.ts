import { Router } from 'express';
import { reverseTunnelService } from '../services/reverse-tunnel.service.js';

const router = Router();

/**
 * GET /api/tunnels
 * List all active tunnels with their health status
 */
router.get('/', (_req, res) => {
  const tunnels = reverseTunnelService.getAllTunnelStatuses();
  res.json({
    success: true,
    data: tunnels,
  });
});

/**
 * GET /api/tunnels/:machineId
 * Get status for a specific tunnel
 */
router.get('/:machineId', (req, res) => {
  const { machineId } = req.params;
  const tunnel = reverseTunnelService.getTunnelStatus(machineId);

  if (!tunnel) {
    res.status(404).json({
      success: false,
      error: 'No tunnel found for this machine',
    });
    return;
  }

  res.json({
    success: true,
    data: tunnel,
  });
});

/**
 * POST /api/tunnels/:machineId/reconnect
 * Force reconnection of a tunnel
 */
router.post('/:machineId/reconnect', async (req, res) => {
  const { machineId } = req.params;
  const result = await reverseTunnelService.forceReconnect(machineId);

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error,
    });
    return;
  }

  res.json({
    success: true,
    message: 'Reconnection initiated',
  });
});

export default router;
