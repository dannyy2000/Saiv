const { ethers } = require('ethers');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Comprehensive Health Monitoring Service
 * Monitors all system components and dependencies
 */
class HealthService {
  constructor() {
    this.healthChecks = new Map();
    this.healthHistory = [];
    this.maxHistoryLength = 100;
    this.warningThresholds = {
      responseTime: 5000, // 5 seconds
      memoryUsage: 85, // 85%
      cpuUsage: 80, // 80%
      diskUsage: 90 // 90%
    };
  }

  /**
   * Register a health check
   */
  registerHealthCheck(name, checkFunction, options = {}) {
    this.healthChecks.set(name, {
      checkFunction,
      enabled: options.enabled !== false,
      timeout: options.timeout || 10000,
      critical: options.critical || false,
      description: options.description || `Health check for ${name}`
    });
  }

  /**
   * Initialize default health checks
   */
  initialize() {
    // Database connectivity
    this.registerHealthCheck('database', this.checkDatabase.bind(this), {
      critical: true,
      description: 'MongoDB database connectivity'
    });

    // Blockchain connectivity
    this.registerHealthCheck('blockchain', this.checkBlockchain.bind(this), {
      critical: true,
      description: 'Blockchain RPC connectivity'
    });

    // Contract accessibility
    this.registerHealthCheck('contracts', this.checkContracts.bind(this), {
      critical: true,
      description: 'Smart contract accessibility'
    });

    // External services
    this.registerHealthCheck('services', this.checkServices.bind(this), {
      critical: false,
      description: 'External service dependencies'
    });

    // System resources
    this.registerHealthCheck('system', this.checkSystemResources.bind(this), {
      critical: false,
      description: 'System resource utilization'
    });

    // Application metrics
    this.registerHealthCheck('application', this.checkApplication.bind(this), {
      critical: false,
      description: 'Application performance metrics'
    });

    logger.info('Health monitoring service initialized', {
      registeredChecks: Array.from(this.healthChecks.keys())
    });
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const startTime = Date.now();
    const results = {};
    let overallStatus = 'healthy';
    const errors = [];

    for (const [name, check] of this.healthChecks) {
      if (!check.enabled) {
        results[name] = {
          status: 'disabled',
          message: 'Health check disabled'
        };
        continue;
      }

      try {
        const checkStartTime = Date.now();
        const result = await Promise.race([
          check.checkFunction(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
          )
        ]);

        const responseTime = Date.now() - checkStartTime;

        results[name] = {
          status: result.status || 'healthy',
          message: result.message || 'OK',
          responseTime,
          data: result.data || {},
          critical: check.critical,
          description: check.description
        };

        // Check if response time is concerning
        if (responseTime > this.warningThresholds.responseTime) {
          results[name].warning = `Slow response time: ${responseTime}ms`;
        }

        // Update overall status
        if (result.status === 'unhealthy' && check.critical) {
          overallStatus = 'unhealthy';
          errors.push(`Critical check failed: ${name}`);
        } else if (result.status === 'unhealthy' || result.status === 'degraded') {
          if (overallStatus === 'healthy') {
            overallStatus = 'degraded';
          }
        }

      } catch (error) {
        const responseTime = Date.now() - checkStartTime;

        results[name] = {
          status: 'unhealthy',
          message: error.message,
          responseTime,
          error: true,
          critical: check.critical,
          description: check.description
        };

        if (check.critical) {
          overallStatus = 'unhealthy';
          errors.push(`Critical check failed: ${name} - ${error.message}`);
        } else if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }

        logger.error(`Health check failed: ${name}`, {
          error: error.message,
          responseTime
        });
      }
    }

    const totalResponseTime = Date.now() - startTime;

    const healthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      checks: results,
      summary: {
        total: this.healthChecks.size,
        healthy: Object.values(results).filter(r => r.status === 'healthy').length,
        degraded: Object.values(results).filter(r => r.status === 'degraded').length,
        unhealthy: Object.values(results).filter(r => r.status === 'unhealthy').length,
        disabled: Object.values(results).filter(r => r.status === 'disabled').length
      },
      errors: errors.length > 0 ? errors : undefined
    };

    // Store in history
    this.addToHistory(healthReport);

    return healthReport;
  }

  /**
   * Database connectivity check
   */
  async checkDatabase() {
    try {
      const startTime = Date.now();

      // Check connection state
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'unhealthy',
          message: 'Database not connected',
          data: { connectionState: mongoose.connection.readyState }
        };
      }

      // Perform a simple query
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      // Get database stats
      const stats = await mongoose.connection.db.stats();

      return {
        status: 'healthy',
        message: 'Database connected and responsive',
        data: {
          connectionState: mongoose.connection.readyState,
          responseTime,
          collections: stats.collections,
          dataSize: stats.dataSize,
          indexSize: stats.indexSize
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database check failed: ${error.message}`
      };
    }
  }

  /**
   * Blockchain connectivity check
   */
  async checkBlockchain() {
    try {
      const rpcUrl = process.env.RPC_URL;
      if (!rpcUrl) {
        return {
          status: 'unhealthy',
          message: 'RPC_URL not configured'
        };
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const startTime = Date.now();

      // Get network info
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const responseTime = Date.now() - startTime;

      // Check if we're significantly behind (more than 10 blocks)
      const currentTime = Date.now();
      const block = await provider.getBlock(blockNumber);
      const blockAge = currentTime - (block.timestamp * 1000);

      let status = 'healthy';
      let message = 'Blockchain connected and synced';

      if (blockAge > 300000) { // 5 minutes
        status = 'degraded';
        message = 'Blockchain may be behind';
      }

      return {
        status,
        message,
        data: {
          network: network.name,
          chainId: network.chainId.toString(),
          blockNumber,
          blockAge: Math.floor(blockAge / 1000),
          responseTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Blockchain check failed: ${error.message}`
      };
    }
  }

  /**
   * Smart contracts accessibility check
   */
  async checkContracts() {
    try {
      const addressManagerAddress = process.env.ADDRESS_MANAGER_CONTRACT;
      if (!addressManagerAddress) {
        return {
          status: 'degraded',
          message: 'Contract addresses not configured'
        };
      }

      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const startTime = Date.now();

      // Check if contract exists
      const code = await provider.getCode(addressManagerAddress);
      if (code === '0x') {
        return {
          status: 'unhealthy',
          message: 'AddressManager contract not found at configured address'
        };
      }

      // Try to call a view function
      const addressManagerABI = [
        "function getTotalWallets() external view returns (uint256)",
        "function getTotalGroupPools() external view returns (uint256)"
      ];

      const contract = new ethers.Contract(addressManagerAddress, addressManagerABI, provider);
      const totalWallets = await contract.getTotalWallets();
      const totalPools = await contract.getTotalGroupPools();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        message: 'Contracts accessible and functional',
        data: {
          addressManager: addressManagerAddress,
          totalWallets: totalWallets.toString(),
          totalGroupPools: totalPools.toString(),
          responseTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Contract check failed: ${error.message}`
      };
    }
  }

  /**
   * External services check
   */
  async checkServices() {
    try {
      const services = {};
      let overallStatus = 'healthy';

      // Check gasless service
      try {
        const gaslessService = require('./gaslessService');
        if (gaslessService.isReady && gaslessService.isReady()) {
          services.gasless = { status: 'healthy', message: 'Gasless service operational' };
        } else {
          services.gasless = { status: 'degraded', message: 'Gasless service not ready' };
          overallStatus = 'degraded';
        }
      } catch (error) {
        services.gasless = { status: 'unhealthy', message: `Gasless service error: ${error.message}` };
        overallStatus = 'degraded';
      }

      // Check Aave service
      try {
        const aaveService = require('./aaveService');
        if (aaveService.isReady && aaveService.isReady()) {
          services.aave = { status: 'healthy', message: 'Aave service operational' };
        } else {
          services.aave = { status: 'degraded', message: 'Aave service not ready' };
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        }
      } catch (error) {
        services.aave = { status: 'unhealthy', message: `Aave service error: ${error.message}` };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }

      // Check webhook service
      try {
        const webhookService = require('./webhookService');
        const webhookStatus = webhookService.getStatus();
        if (webhookStatus.isListening) {
          services.webhooks = {
            status: 'healthy',
            message: 'Webhook service operational',
            data: webhookStatus
          };
        } else {
          services.webhooks = {
            status: 'degraded',
            message: 'Webhook service not listening',
            data: webhookStatus
          };
          if (overallStatus === 'healthy') overallStatus = 'degraded';
        }
      } catch (error) {
        services.webhooks = { status: 'unhealthy', message: `Webhook service error: ${error.message}` };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      }

      return {
        status: overallStatus,
        message: `Services check completed`,
        data: services
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Services check failed: ${error.message}`
      };
    }
  }

  /**
   * System resources check
   */
  async checkSystemResources() {
    try {
      const used = process.memoryUsage();
      const total = require('os').totalmem();
      const free = require('os').freemem();
      const uptime = process.uptime();

      const memoryUsagePercent = ((total - free) / total) * 100;
      const heapUsed = used.heapUsed / 1024 / 1024; // MB
      const heapTotal = used.heapTotal / 1024 / 1024; // MB

      let status = 'healthy';
      let warnings = [];

      if (memoryUsagePercent > this.warningThresholds.memoryUsage) {
        status = 'degraded';
        warnings.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
      }

      if (heapUsed / heapTotal > 0.9) {
        status = 'degraded';
        warnings.push(`High heap usage: ${(heapUsed / heapTotal * 100).toFixed(1)}%`);
      }

      return {
        status,
        message: warnings.length > 0 ? warnings.join(', ') : 'System resources normal',
        data: {
          memory: {
            total: Math.round(total / 1024 / 1024), // MB
            free: Math.round(free / 1024 / 1024), // MB
            used: Math.round((total - free) / 1024 / 1024), // MB
            usagePercent: Math.round(memoryUsagePercent)
          },
          heap: {
            used: Math.round(heapUsed),
            total: Math.round(heapTotal),
            external: Math.round(used.external / 1024 / 1024)
          },
          uptime: Math.round(uptime),
          pid: process.pid
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `System resources check failed: ${error.message}`
      };
    }
  }

  /**
   * Application metrics check
   */
  async checkApplication() {
    try {
      const startTime = Date.now();

      // Get recent health history
      const recentChecks = this.healthHistory.slice(-10);
      const avgResponseTime = recentChecks.length > 0
        ? recentChecks.reduce((sum, check) => sum + check.responseTime, 0) / recentChecks.length
        : 0;

      // Count recent failures
      const recentFailures = recentChecks.filter(check => check.status === 'unhealthy').length;

      let status = 'healthy';
      let warnings = [];

      if (avgResponseTime > this.warningThresholds.responseTime) {
        status = 'degraded';
        warnings.push(`Slow average response time: ${avgResponseTime.toFixed(0)}ms`);
      }

      if (recentFailures > 3) {
        status = 'degraded';
        warnings.push(`High failure rate: ${recentFailures}/10 recent checks failed`);
      }

      return {
        status,
        message: warnings.length > 0 ? warnings.join(', ') : 'Application metrics normal',
        data: {
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          uptimeSeconds: Math.round(process.uptime()),
          avgResponseTime: Math.round(avgResponseTime),
          recentFailures,
          healthHistoryLength: this.healthHistory.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Application metrics check failed: ${error.message}`
      };
    }
  }

  /**
   * Add health report to history
   */
  addToHistory(report) {
    this.healthHistory.push({
      status: report.status,
      timestamp: report.timestamp,
      responseTime: report.responseTime,
      summary: report.summary
    });

    // Keep only recent history
    if (this.healthHistory.length > this.maxHistoryLength) {
      this.healthHistory.shift();
    }
  }

  /**
   * Get health history
   */
  getHealthHistory() {
    return this.healthHistory;
  }

  /**
   * Get specific health check status
   */
  async runSpecificCheck(checkName) {
    const check = this.healthChecks.get(checkName);
    if (!check) {
      throw new Error(`Health check '${checkName}' not found`);
    }

    if (!check.enabled) {
      return {
        status: 'disabled',
        message: 'Health check disabled'
      };
    }

    try {
      const startTime = Date.now();
      const result = await Promise.race([
        check.checkFunction(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), check.timeout)
        )
      ]);

      return {
        ...result,
        responseTime: Date.now() - startTime,
        checkName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
        responseTime: Date.now() - startTime,
        checkName,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Enable/disable specific health check
   */
  configureHealthCheck(checkName, enabled) {
    const check = this.healthChecks.get(checkName);
    if (!check) {
      throw new Error(`Health check '${checkName}' not found`);
    }

    check.enabled = enabled;
    logger.info(`Health check ${checkName} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get health check configuration
   */
  getHealthCheckConfig() {
    const config = {};
    for (const [name, check] of this.healthChecks) {
      config[name] = {
        enabled: check.enabled,
        critical: check.critical,
        timeout: check.timeout,
        description: check.description
      };
    }
    return config;
  }
}

module.exports = new HealthService();