const request = require('supertest');
const express = require('express');
const healthController = require('../../src/controllers/healthController');
const healthService = require('../../src/services/healthService');

// Mock the health service
jest.mock('../../src/services/healthService');

describe('HealthController', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Setup routes
    app.get('/health', healthController.getHealth);
    app.get('/health/detailed', healthController.getDetailedHealth);
    app.get('/health/liveness', healthController.getLiveness);
    app.get('/health/readiness', healthController.getReadiness);
    app.get('/health/specific/:checkName', healthController.getSpecificHealth);
    app.get('/health/history', healthController.getHealthHistory);
    app.post('/health/configure/:checkName', healthController.configureHealthCheck);
    app.get('/health/config', healthController.getHealthConfig);
    app.get('/health/metrics', healthController.getMetrics);
    app.get('/health/dependencies', healthController.getDependencies);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return healthy status with 200', async () => {
      const mockHealthReport = {
        status: 'healthy',
        summary: { healthy: 3, degraded: 0, unhealthy: 0 },
        responseTime: 25
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(healthService.runAllChecks).toHaveBeenCalled();
    });

    it('should return unhealthy status with 503', async () => {
      const mockHealthReport = {
        status: 'unhealthy',
        summary: { healthy: 1, degraded: 0, unhealthy: 2 },
        responseTime: 100
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('unhealthy');
    });

    it('should return degraded status with 200', async () => {
      const mockHealthReport = {
        status: 'degraded',
        summary: { healthy: 2, degraded: 1, unhealthy: 0 },
        responseTime: 50
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('degraded');
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health report', async () => {
      const mockHealthReport = {
        status: 'healthy',
        checks: {
          database: { status: 'healthy', responseTime: 10 },
          blockchain: { status: 'healthy', responseTime: 15 }
        },
        summary: { healthy: 2, degraded: 0, unhealthy: 0 },
        responseTime: 25
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHealthReport);
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/liveness');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('getReadiness', () => {
    it('should return ready when no critical failures', async () => {
      const mockHealthReport = {
        status: 'healthy',
        checks: {
          database: { status: 'healthy', critical: true },
          blockchain: { status: 'healthy', critical: true },
          cache: { status: 'degraded', critical: false }
        },
        summary: { healthy: 2, degraded: 1, unhealthy: 0 }
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health/readiness');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('ready');
      expect(response.body.criticalFailures).toBeUndefined();
    });

    it('should return not ready when critical failures exist', async () => {
      const mockHealthReport = {
        status: 'unhealthy',
        checks: {
          database: { status: 'unhealthy', critical: true },
          blockchain: { status: 'healthy', critical: true },
          cache: { status: 'degraded', critical: false }
        },
        summary: { healthy: 1, degraded: 1, unhealthy: 1 }
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health/readiness');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('not_ready');
      expect(response.body.criticalFailures).toEqual(['database']);
    });
  });

  describe('getSpecificHealth', () => {
    it('should return specific health check result', async () => {
      const mockResult = {
        status: 'healthy',
        responseTime: 10,
        data: { connection: 'active' }
      };

      healthService.runSpecificCheck.mockResolvedValue(mockResult);

      const response = await request(app).get('/health/specific/database');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(healthService.runSpecificCheck).toHaveBeenCalledWith('database');
    });

    it('should return 404 for invalid check name', async () => {
      healthService.runSpecificCheck.mockRejectedValue(new Error('Check not found'));

      const response = await request(app).get('/health/specific/invalid');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Check not found');
    });
  });

  describe('getHealthHistory', () => {
    it('should return health history with default limit', async () => {
      const mockHistory = [
        { timestamp: '2023-01-01T00:00:00Z', status: 'healthy' },
        { timestamp: '2023-01-01T01:00:00Z', status: 'healthy' }
      ];

      healthService.getHealthHistory.mockReturnValue(mockHistory);

      const response = await request(app).get('/health/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual(mockHistory);
      expect(response.body.data.count).toBe(2);
    });

    it('should return health history with custom limit', async () => {
      const mockHistory = Array(100).fill(null).map((_, i) => ({
        timestamp: `2023-01-01T${i.toString().padStart(2, '0')}:00:00Z`,
        status: 'healthy'
      }));

      healthService.getHealthHistory.mockReturnValue(mockHistory);

      const response = await request(app).get('/health/history?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(10);
    });
  });

  describe('configureHealthCheck', () => {
    it('should enable health check', async () => {
      healthService.configureHealthCheck.mockImplementation(() => {});

      const response = await request(app)
        .post('/health/configure/database')
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Health check database enabled');
      expect(response.body.data.enabled).toBe(true);
      expect(healthService.configureHealthCheck).toHaveBeenCalledWith('database', true);
    });

    it('should disable health check', async () => {
      healthService.configureHealthCheck.mockImplementation(() => {});

      const response = await request(app)
        .post('/health/configure/database')
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Health check database disabled');
      expect(response.body.data.enabled).toBe(false);
    });

    it('should return 400 for invalid enabled value', async () => {
      const response = await request(app)
        .post('/health/configure/database')
        .send({ enabled: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('enabled must be a boolean value');
    });

    it('should return 404 for invalid check name', async () => {
      healthService.configureHealthCheck.mockImplementation(() => {
        throw new Error('Check not found');
      });

      const response = await request(app)
        .post('/health/configure/invalid')
        .send({ enabled: true });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Check not found');
    });
  });

  describe('getHealthConfig', () => {
    it('should return health check configuration', async () => {
      const mockConfig = {
        database: { enabled: true, critical: true },
        blockchain: { enabled: true, critical: true },
        cache: { enabled: false, critical: false }
      };

      healthService.getHealthCheckConfig.mockReturnValue(mockConfig);

      const response = await request(app).get('/health/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockConfig);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      const mockHealthReport = {
        status: 'healthy',
        responseTime: 25,
        checks: {
          database: { status: 'healthy', critical: true },
          blockchain: { status: 'healthy', critical: true },
          system: {
            status: 'healthy',
            data: {
              memory: { usagePercent: 65 },
              uptime: 3600
            }
          }
        }
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/plain/);
      expect(response.text).toContain('saiv_health_status 2');
      expect(response.text).toContain('saiv_health_response_time_ms 25');
      expect(response.text).toContain('saiv_memory_usage_percent 65');
      expect(response.text).toContain('saiv_uptime_seconds 3600');
    });
  });

  describe('getDependencies', () => {
    it('should return dependency status', async () => {
      const mockHealthReport = {
        checks: {
          database: { status: 'healthy', responseTime: 10 },
          blockchain: { status: 'healthy', responseTime: 15, data: { blockNumber: 12345 } },
          contracts: { status: 'healthy', responseTime: 20, data: { deployed: true } },
          services: {
            status: 'healthy',
            data: {
              emailService: { status: 'healthy', message: 'Connected' },
              smsService: { status: 'degraded', message: 'Limited capacity' }
            }
          }
        }
      };

      healthService.runAllChecks.mockResolvedValue(mockHealthReport);

      const response = await request(app).get('/health/dependencies');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dependencies).toBeDefined();
      expect(response.body.data.dependencies.database).toBeDefined();
      expect(response.body.data.dependencies.blockchain).toBeDefined();
      expect(response.body.data.dependencies.contracts).toBeDefined();
      expect(response.body.data.dependencies.emailService).toBeDefined();
      expect(response.body.data.dependencies.smsService).toBeDefined();
      expect(response.body.data.summary.total).toBe(5);
    });
  });
});