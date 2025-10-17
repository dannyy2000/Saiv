const healthService = require('../services/healthService');
const { catchAsync } = require('../middleware/errorHandler');

const healthController = {
  // Basic health check endpoint
  getHealth: catchAsync(async (req, res) => {
    const healthReport = await healthService.runAllChecks();

    // Set appropriate HTTP status based on health
    let httpStatus = 200;
    if (healthReport.status === 'unhealthy') {
      httpStatus = 503; // Service Unavailable
    } else if (healthReport.status === 'degraded') {
      httpStatus = 200; // OK but degraded
    }

    res.status(httpStatus).json({
      success: healthReport.status !== 'unhealthy',
      ...healthReport
    });
  }),

  // Detailed health check with full information
  getDetailedHealth: catchAsync(async (req, res) => {
    const healthReport = await healthService.runAllChecks();

    res.status(200).json({
      success: true,
      data: healthReport
    });
  }),

  // Quick liveness probe (minimal check)
  getLiveness: catchAsync(async (req, res) => {
    // Simple liveness check - just verify the service is running
    res.status(200).json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }),

  // Readiness probe (check if ready to serve traffic)
  getReadiness: catchAsync(async (req, res) => {
    // Run critical checks only for readiness
    const healthReport = await healthService.runAllChecks();

    // Check if any critical systems are down
    const criticalFailures = Object.entries(healthReport.checks)
      .filter(([_, check]) => check.critical && check.status === 'unhealthy')
      .map(([name, _]) => name);

    const isReady = criticalFailures.length === 0;

    res.status(isReady ? 200 : 503).json({
      success: isReady,
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      criticalFailures: criticalFailures.length > 0 ? criticalFailures : undefined,
      summary: healthReport.summary
    });
  }),

  // Get specific health check
  getSpecificHealth: catchAsync(async (req, res) => {
    const { checkName } = req.params;

    try {
      const result = await healthService.runSpecificCheck(checkName);

      res.status(200).json({
        success: result.status !== 'unhealthy',
        data: result
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }),

  // Get health history
  getHealthHistory: catchAsync(async (req, res) => {
    const { limit = 50 } = req.query;
    const history = healthService.getHealthHistory().slice(-parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        history,
        count: history.length
      }
    });
  }),

  // Configure health checks (admin only)
  configureHealthCheck: catchAsync(async (req, res) => {
    const { checkName } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean value'
      });
    }

    try {
      healthService.configureHealthCheck(checkName, enabled);

      res.status(200).json({
        success: true,
        message: `Health check ${checkName} ${enabled ? 'enabled' : 'disabled'}`,
        data: {
          checkName,
          enabled
        }
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }),

  // Get health check configuration
  getHealthConfig: catchAsync(async (req, res) => {
    const config = healthService.getHealthCheckConfig();

    res.status(200).json({
      success: true,
      data: config
    });
  }),

  // System metrics endpoint
  getMetrics: catchAsync(async (req, res) => {
    const healthReport = await healthService.runAllChecks();

    // Extract metrics in Prometheus format (simple)
    const metrics = [];

    // Overall health status
    metrics.push(`# HELP saiv_health_status Overall system health status (0=unhealthy, 1=degraded, 2=healthy)`);
    metrics.push(`# TYPE saiv_health_status gauge`);
    const statusValue = healthReport.status === 'healthy' ? 2 : healthReport.status === 'degraded' ? 1 : 0;
    metrics.push(`saiv_health_status ${statusValue}`);

    // Response time
    metrics.push(`# HELP saiv_health_response_time_ms Health check response time in milliseconds`);
    metrics.push(`# TYPE saiv_health_response_time_ms gauge`);
    metrics.push(`saiv_health_response_time_ms ${healthReport.responseTime}`);

    // Individual check status
    metrics.push(`# HELP saiv_health_check_status Individual health check status (0=unhealthy, 1=degraded, 2=healthy)`);
    metrics.push(`# TYPE saiv_health_check_status gauge`);

    for (const [checkName, check] of Object.entries(healthReport.checks)) {
      const value = check.status === 'healthy' ? 2 : check.status === 'degraded' ? 1 : 0;
      metrics.push(`saiv_health_check_status{check="${checkName}",critical="${check.critical}"} ${value}`);
    }

    // System metrics
    if (healthReport.checks.system && healthReport.checks.system.data) {
      const systemData = healthReport.checks.system.data;

      metrics.push(`# HELP saiv_memory_usage_percent Memory usage percentage`);
      metrics.push(`# TYPE saiv_memory_usage_percent gauge`);
      metrics.push(`saiv_memory_usage_percent ${systemData.memory.usagePercent}`);

      metrics.push(`# HELP saiv_uptime_seconds Application uptime in seconds`);
      metrics.push(`# TYPE saiv_uptime_seconds counter`);
      metrics.push(`saiv_uptime_seconds ${systemData.uptime}`);
    }

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(metrics.join('\n') + '\n');
  }),

  // Dependency status endpoint
  getDependencies: catchAsync(async (req, res) => {
    const healthReport = await healthService.runAllChecks();

    const dependencies = {
      database: {
        status: healthReport.checks.database?.status || 'unknown',
        critical: true,
        description: 'MongoDB database',
        responseTime: healthReport.checks.database?.responseTime
      },
      blockchain: {
        status: healthReport.checks.blockchain?.status || 'unknown',
        critical: true,
        description: 'Blockchain RPC connection',
        responseTime: healthReport.checks.blockchain?.responseTime,
        data: healthReport.checks.blockchain?.data
      },
      contracts: {
        status: healthReport.checks.contracts?.status || 'unknown',
        critical: true,
        description: 'Smart contracts',
        responseTime: healthReport.checks.contracts?.responseTime,
        data: healthReport.checks.contracts?.data
      }
    };

    // Add external services if available
    if (healthReport.checks.services?.data) {
      Object.entries(healthReport.checks.services.data).forEach(([serviceName, serviceData]) => {
        dependencies[serviceName] = {
          status: serviceData.status,
          critical: false,
          description: `${serviceName} service`,
          message: serviceData.message,
          data: serviceData.data
        };
      });
    }

    res.status(200).json({
      success: true,
      data: {
        dependencies,
        summary: {
          total: Object.keys(dependencies).length,
          healthy: Object.values(dependencies).filter(d => d.status === 'healthy').length,
          degraded: Object.values(dependencies).filter(d => d.status === 'degraded').length,
          unhealthy: Object.values(dependencies).filter(d => d.status === 'unhealthy').length
        }
      }
    });
  })
};

module.exports = healthController;