const express = require('express');
const router = express.Router();
const { testSMTPConnection, testAPIConnection } = require('../../test-brevo-connection');
const currencyService = require('../services/currencyService');

/**
 * Test Brevo SMTP connection
 */
router.get('/brevo/smtp', async (req, res) => {
  try {
    console.log('🔍 Testing Brevo SMTP via API endpoint...');

    // Capture console output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    await testSMTPConnection();

    // Restore console.log
    console.log = originalLog;

    res.status(200).json({
      success: true,
      message: 'SMTP connection test completed',
      logs: logs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SMTP connection test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test Brevo API connection
 */
router.get('/brevo/api', async (req, res) => {
  try {
    console.log('🔍 Testing Brevo API via API endpoint...');

    // Capture console output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    await testAPIConnection();

    // Restore console.log
    console.log = originalLog;

    res.status(200).json({
      success: true,
      message: 'API connection test completed',
      logs: logs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'API connection test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Quick email test - send a test verification email
 */
router.post('/email/send', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }

    const notificationService = require('../services/notificationService');

    const testEmailContent = {
      to: email,
      subject: 'Test Email from Saiv Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">🧪 Test Email</h2>
          <p>This is a test email to verify your Brevo integration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Sent from:</strong> Saiv Platform Backend</p>
          <hr style="margin: 20px 0; border: 1px solid #e2e8f0;">
          <p style="color: #64748b; font-size: 14px;">
            If you received this email, your email integration is working perfectly! ✅
          </p>
        </div>
      `
    };

    const result = await notificationService.sendEmail(testEmailContent);

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get current email configuration status
 */
router.get('/email/status', (req, res) => {
  const config = {
    smtp: {
      host: process.env.BREVO_SMTP_HOST || 'Not configured',
      port: process.env.BREVO_SMTP_PORT || 'Not configured',
      user: process.env.BREVO_SMTP_USER || 'Not configured',
      hasPassword: !!process.env.BREVO_SMTP_PASS
    },
    api: {
      hasApiKey: !!process.env.BREVO_API_KEY,
      keyPreview: process.env.BREVO_API_KEY ?
        process.env.BREVO_API_KEY.substring(0, 20) + '...' : 'Not configured'
    },
    general: {
      provider: process.env.EMAIL_SERVICE_PROVIDER || 'Not configured',
      fromAddress: process.env.EMAIL_FROM_ADDRESS || 'Not configured',
      fromName: process.env.EMAIL_FROM_NAME || 'Not configured',
      frontendUrl: process.env.FRONTEND_URL || 'Not configured'
    }
  };

  res.status(200).json({
    success: true,
    message: 'Email configuration status',
    config: config,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get currency exchange rates
 */
router.get('/currency/rates', (req, res) => {
  try {
    const rates = currencyService.getExchangeRates();
    res.status(200).json({
      success: true,
      message: 'Currency exchange rates',
      data: rates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get exchange rates',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Convert currency amounts
 */
router.post('/currency/convert', (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    if (!amount || !fromCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Amount and fromCurrency are required'
      });
    }

    let conversion;
    const upperFrom = fromCurrency.toUpperCase();
    const upperTo = (toCurrency || 'USDC').toUpperCase();

    if (upperTo !== 'USDC') {
      return res.status(400).json({
        success: false,
        message: 'Currently only conversion to USDC is supported'
      });
    }

    if (upperFrom === 'ETH') {
      conversion = currencyService.convertEthToUsdc(amount);
    } else if (upperFrom === 'LSK') {
      conversion = currencyService.convertLskToUsdc(amount);
    } else {
      conversion = currencyService.convertToUsdc(amount, fromCurrency);
    }

    res.status(200).json({
      success: true,
      message: 'Currency conversion completed',
      data: conversion,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to convert currency',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Test conversion with sample amounts
 */
router.get('/currency/demo', (req, res) => {
  try {
    const demos = {
      eth: {
        amount: '0.07',
        conversion: currencyService.convertEthToUsdc('0.07')
      },
      lsk: {
        amount: '100',
        conversion: currencyService.convertLskToUsdc('100')
      },
      sampleWallet: currencyService.enhanceWalletBalance({
        mainWallet: { balance: '0.07' },
        savingsWallet: { balance: '0.025' }
      })
    };

    res.status(200).json({
      success: true,
      message: 'Currency conversion demo',
      data: demos,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate demo',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;