// Continuous Arena API Routes - RESTful endpoints for auto-evolution control
import { Router } from 'express';
import type { ContinuousArena } from '../services/arena/continuousArena';
import type { BotGroupName } from '../services/arena/types';

export function createContinuousArenaRoutes(continuousArena: ContinuousArena): Router {
  const router = Router();

  // ===================== CONTROL =====================

  // GET /api/continuous-arena/status - Get current status
  router.get('/status', (req, res) => {
    try {
      const status = continuousArena.getStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get continuous arena status', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // POST /api/continuous-arena/start - Start continuous monitoring
  router.post('/start', (req, res) => {
    try {
      continuousArena.start();
      res.json({ 
        success: true, 
        message: 'Continuous arena started - monitoring market sessions and auto-evolution' 
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to start continuous arena', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // POST /api/continuous-arena/stop - Stop continuous monitoring
  router.post('/stop', (req, res) => {
    try {
      continuousArena.stop();
      res.json({ 
        success: true, 
        message: 'Continuous arena stopped' 
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to stop continuous arena', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ===================== CONFIGURATION =====================

  // GET /api/continuous-arena/config - Get current configuration
  router.get('/config', (req, res) => {
    try {
      const config = continuousArena.getConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get configuration', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // POST /api/continuous-arena/config - Update configuration
  router.post('/config', (req, res) => {
    try {
      const updates = req.body;
      
      // Validate configuration updates
      const validKeys = [
        'minRoundDurationMs',
        'maxRoundDurationMs', 
        'evolutionTriggerThreshold',
        'evolutionCooldownMs',
        'profitThresholdPercent',
        'maxDrawdownThreshold'
      ];

      const filteredUpdates: any = {};
      for (const key of validKeys) {
        if (key in updates) {
          const value = updates[key];
          if (typeof value === 'number' && !isNaN(value)) {
            filteredUpdates[key] = value;
          }
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ 
          error: 'No valid configuration updates provided',
          validKeys 
        });
      }

      continuousArena.updateConfig(filteredUpdates);
      
      res.json({ 
        success: true, 
        message: 'Configuration updated successfully',
        updates: filteredUpdates,
        currentConfig: continuousArena.getConfig()
      });

    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to update configuration', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ===================== EVOLUTION CONTROL =====================

  // POST /api/continuous-arena/evolve - Manual evolution trigger
  router.post('/evolve', (req, res) => {
    try {
      const { groupName } = req.body;
      
      // Validate group name if provided
      if (groupName && !['Alpha', 'Beta', 'Gamma'].includes(groupName)) {
        return res.status(400).json({ 
          error: 'Invalid group name', 
          validGroups: ['Alpha', 'Beta', 'Gamma'] 
        });
      }

      continuousArena.manualEvolution(groupName as BotGroupName);
      
      res.json({ 
        success: true, 
        message: groupName 
          ? `Manual evolution triggered for ${groupName} group`
          : 'Manual evolution triggered for all active groups',
        groupName: groupName || 'all'
      });

    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to trigger evolution', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ===================== ANALYTICS =====================

  // GET /api/continuous-arena/performance/:groupName - Get group performance history
  router.get('/performance/:groupName', (req, res) => {
    try {
      const { groupName } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!['Alpha', 'Beta', 'Gamma'].includes(groupName)) {
        return res.status(400).json({ 
          error: 'Invalid group name', 
          validGroups: ['Alpha', 'Beta', 'Gamma'] 
        });
      }

      const history = continuousArena.getGroupPerformanceHistory(groupName as BotGroupName, limit);
      
      res.json({
        groupName,
        snapshots: history.length,
        history,
        summary: history.length > 0 ? {
          latestProfit: history[history.length - 1]?.bestProfit || 0,
          avgProfit: history.reduce((sum, s) => sum + s.bestProfit, 0) / history.length,
          maxProfit: Math.max(...history.map(s => s.bestProfit)),
          minProfit: Math.min(...history.map(s => s.bestProfit)),
          totalTrades: history[history.length - 1]?.totalTrades || 0,
          currentGeneration: history[history.length - 1]?.generation || 0,
        } : null
      });

    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get performance history', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // GET /api/continuous-arena/performance - Get all groups performance summary
  router.get('/performance', (req, res) => {
    try {
      const groups = ['Alpha', 'Beta', 'Gamma'] as BotGroupName[];
      const performance = groups.map(groupName => {
        const history = continuousArena.getGroupPerformanceHistory(groupName, 20);
        
        return {
          groupName,
          snapshots: history.length,
          latest: history.length > 0 ? history[history.length - 1] : null,
          summary: history.length > 0 ? {
            avgProfit: history.reduce((sum, s) => sum + s.bestProfit, 0) / history.length,
            maxProfit: Math.max(...history.map(s => s.bestProfit)),
            totalTrades: history[history.length - 1]?.totalTrades || 0,
          } : null
        };
      });
      
      res.json({ groups: performance });

    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get performance summary', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ===================== WEBSOCKET EVENTS INFO =====================

  // GET /api/continuous-arena/events - Get available WebSocket events
  router.get('/events', (req, res) => {
    res.json({
      events: [
        'continuous:started',
        'continuous:stopped', 
        'continuous:market_open',
        'continuous:market_close',
        'continuous:tournament_started',
        'continuous:tournament_paused',
        'continuous:evolution_triggered',
        'continuous:config_updated',
        'continuous:trade',
        'continuous:tournament'
      ],
      description: 'Subscribe to these events via WebSocket for real-time updates',
      websocketUrl: '/ws'
    });
  });

  return router;
}