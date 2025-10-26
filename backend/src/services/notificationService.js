const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const axios = require('axios');
const logger = require('../utils/logger');
const notificationTemplates = require('./notificationTemplates');
const NotificationPreference = require('../models/NotificationPreference');
const ScheduledNotification = require('../models/ScheduledNotification');

/**
 * Comprehensive Notification Service
 * Handles email, SMS, and push notifications for the Saiv platform
 */
class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.emailProvider = null;
    this.emailTransporter = null;
    this.smsProvider = null;
    this.pushProvider = null;
    this.notificationQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initialize the notification service
   */
  async initialize() {
    try {
      logger.info('Initializing notification service...');

      // Initialize email service
      await this.initializeEmailService();

      // Initialize SMS service
      await this.initializeSMSService();

      // Initialize push notification service
      await this.initializePushService();

      this.isInitialized = true;
      logger.info('Notification service initialized successfully');
      return true;

    } catch (error) {
      logger.error('Failed to initialize notification service', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Initialize email service
   */
  async initializeEmailService() {
    const provider = process.env.EMAIL_SERVICE_PROVIDER;

    if (!provider) {
      logger.warn('No email service provider configured');
      return;
    }

    switch (provider.toLowerCase()) {
      case 'sendgrid':
        if (process.env.EMAIL_SERVICE_API_KEY) {
          sgMail.setApiKey(process.env.EMAIL_SERVICE_API_KEY);
          this.emailProvider = 'sendgrid';
          logger.info('SendGrid email service initialized');
        }
        break;

      case 'mailgun':
        // Mailgun implementation would go here
        logger.warn('Mailgun not implemented yet');
        break;

      case 'brevo':
        // Prefer API over SMTP (API is more reliable)
        if (process.env.BREVO_API_KEY) {
          try {
            // Test API connection
            const response = await axios.get('https://api.brevo.com/v3/account', {
              headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json'
              }
            });

            this.emailProvider = 'brevo-api';
            this.brevoApiKey = process.env.BREVO_API_KEY;
            logger.info('Brevo API service initialized and verified', {
              email: response.data.email,
              plan: response.data.plan?.type || 'Unknown'
            });
          } catch (error) {
            logger.error('Brevo API verification failed:', error.response?.data?.message || error.message);
            logger.error('Falling back to SMTP if configured...');
          }
        }

        // Fallback to SMTP if API not configured or failed
        if (!this.emailProvider && process.env.BREVO_SMTP_HOST && process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS) {
          this.emailTransporter = nodemailer.createTransport({
            host: process.env.BREVO_SMTP_HOST,
            port: parseInt(process.env.BREVO_SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
              user: process.env.BREVO_SMTP_USER,
              pass: process.env.BREVO_SMTP_PASS
            }
          });

          // Verify SMTP connection
          try {
            await this.emailTransporter.verify();
            this.emailProvider = 'brevo-smtp';
            logger.info('Brevo SMTP service initialized and verified');
          } catch (error) {
            logger.error('Brevo SMTP verification failed:', error.message);
            logger.error('Please check your BREVO_SMTP credentials and ensure the sender email is verified in Brevo');
            this.emailTransporter = null;
          }
        }

        if (!this.emailProvider) {
          logger.warn('Brevo credentials not configured (neither API nor SMTP)');
        }
        break;

      case 'ses':
        // Amazon SES implementation would go here
        logger.warn('Amazon SES not implemented yet');
        break;

      default:
        logger.warn(`Unknown email provider: ${provider}`);
    }
  }

  /**
   * Initialize SMS service
   */
  async initializeSMSService() {
    const provider = process.env.SMS_SERVICE_PROVIDER;

    if (!provider) {
      logger.warn('No SMS service provider configured');
      return;
    }

    switch (provider.toLowerCase()) {
      case 'twilio':
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (accountSid && authToken) {
          this.smsProvider = twilio(accountSid, authToken);
          logger.info('Twilio SMS service initialized');
        }
        break;

      case 'sns':
        // Amazon SNS implementation would go here
        logger.warn('Amazon SNS not implemented yet');
        break;

      default:
        logger.warn(`Unknown SMS provider: ${provider}`);
    }
  }

  /**
   * Initialize push notification service
   */
  async initializePushService() {
    const provider = process.env.PUSH_SERVICE_PROVIDER;

    if (!provider) {
      logger.warn('No push notification service provider configured');
      return;
    }

    switch (provider.toLowerCase()) {
      case 'firebase':
        try {
          const admin = require('firebase-admin');
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

          if (serviceAccount.project_id) {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id
            });
            this.pushProvider = 'firebase';
            logger.info('Firebase push notification service initialized');
          } else {
            logger.warn('Firebase service account not properly configured');
          }
        } catch (error) {
          logger.error('Failed to initialize Firebase', { error: error.message });
        }
        break;

      case 'onesignal':
        if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_API_KEY) {
          this.pushProvider = 'onesignal';
          logger.info('OneSignal push notification service initialized');
        } else {
          logger.warn('OneSignal credentials not configured');
        }
        break;

      default:
        logger.warn(`Unknown push provider: ${provider}`);
    }
  }

  // ============================================
  // EMAIL NOTIFICATIONS
  // ============================================

  /**
   * Send email notification
   * @param {Object} options Email options
   * @param {string|Array} options.to Recipient email(s)
   * @param {string} options.subject Email subject
   * @param {string} options.html HTML content
   * @param {string} options.text Plain text content
   * @param {string} options.template Template name (optional)
   * @param {Object} options.templateData Template data (optional)
   */
  async sendEmail(options) {
    if (!this.emailProvider) {
      logger.warn('Email service not configured');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const emailData = {
        to: options.to,
        from: {
          email: process.env.EMAIL_FROM_ADDRESS || 'noreply@saiv.platform',
          name: process.env.EMAIL_FROM_NAME || 'Saiv Platform'
        },
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html)
      };

      if (process.env.EMAIL_REPLY_TO) {
        emailData.replyTo = process.env.EMAIL_REPLY_TO;
      }

      let result;

      switch (this.emailProvider) {
        case 'sendgrid':
          result = await sgMail.send(emailData);
          break;

        case 'brevo-api':
          // Use Brevo API
          const apiEmailData = {
            sender: {
              name: emailData.from.name,
              email: emailData.from.email
            },
            to: [{
              email: emailData.to,
              name: emailData.to
            }],
            subject: emailData.subject,
            htmlContent: emailData.html,
            textContent: emailData.text
          };

          if (emailData.replyTo) {
            apiEmailData.replyTo = {
              email: emailData.replyTo
            };
          }

          const apiResponse = await axios.post('https://api.brevo.com/v3/smtp/email', apiEmailData, {
            headers: {
              'api-key': this.brevoApiKey,
              'Content-Type': 'application/json'
            }
          });

          result = { messageId: apiResponse.data.messageId };
          break;

        case 'brevo-smtp':
          // Use Brevo SMTP
          const mailOptions = {
            from: `${emailData.from.name} <${emailData.from.email}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text
          };
          if (emailData.replyTo) {
            mailOptions.replyTo = emailData.replyTo;
          }
          result = await this.emailTransporter.sendMail(mailOptions);
          break;

        default:
          throw new Error(`Unsupported email provider: ${this.emailProvider}`);
      }

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        provider: this.emailProvider
      });

      return { success: true, result };

    } catch (error) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error.message,
        provider: this.emailProvider
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send templated email notification
   * @param {string} templateId Template identifier
   * @param {string|Array} recipients Email recipient(s)
   * @param {Object} variables Template variables
   */
  async sendTemplatedEmail(templateId, recipients, variables = {}) {
    try {
      const template = notificationTemplates.renderTemplate(templateId, variables);

      return await this.sendEmail({
        to: recipients,
        subject: template.subject,
        html: template.html,
        text: template.text
      });
    } catch (error) {
      logger.error('Failed to send templated email', {
        templateId,
        recipients,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail, userName) {
    return await this.sendTemplatedEmail('email_welcome', userEmail, {
      userName: userName || 'there',
      userEmail
    });
  }

  /**
   * Send savings milestone email
   */
  async sendSavingsMilestone(userEmail, milestoneData) {
    return await this.sendTemplatedEmail('email_milestone', userEmail, milestoneData);
  }

  /**
   * Send group savings round completion email
   */
  async sendGroupRoundCompletion(userEmail, roundData) {
    const { groupName, roundNumber, userContribution, totalContributions, interestEarned, nextRoundDate } = roundData;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Group Savings Round Complete! 🏁</h1>

        <p>Great news! Round ${roundNumber} for <strong>${groupName}</strong> has been completed successfully.</p>

        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="color: #1d4ed8; margin-top: 0;">Round ${roundNumber} Summary:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Your Contribution:</strong> ${userContribution}</li>
            <li><strong>Total Group Contributions:</strong> ${totalContributions}</li>
            <li><strong>Your Interest Earned:</strong> ${interestEarned}</li>
          </ul>
        </div>

        <p><strong>Next Round:</strong> Round ${roundNumber + 1} starts on ${new Date(nextRoundDate).toDateString()}</p>

        <p>Your interest has been automatically added to your savings. Keep contributing to earn more!</p>

        <p>
          Best regards,<br>
          The Saiv Team
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: `${groupName} - Round ${roundNumber} Complete! Interest Distributed`,
      html
    });
  }

  /**
   * Send transaction confirmation email
   */
  async sendTransactionConfirmation(userEmail, transactionData) {
    const formattedData = {
      ...transactionData,
      timestamp: new Date(transactionData.timestamp).toLocaleString()
    };

    return await this.sendTemplatedEmail('email_transaction_confirmation', userEmail, formattedData);
  }

  /**
   * Send group invitation email
   */
  async sendGroupInvitation(userEmail, groupData, inviterName) {
    return await this.sendTemplatedEmail('email_group_invitation', userEmail, {
      ...groupData,
      inviterName,
      joinUrl: `${process.env.FRONTEND_URL || 'https://app.saiv.platform'}/groups/join`
    });
  }

  // ============================================
  // SMS NOTIFICATIONS
  // ============================================

  /**
   * Send SMS notification
   * @param {string} phoneNumber Recipient phone number
   * @param {string} message SMS message content
   */
  async sendSMS(phoneNumber, message) {
    if (!this.smsProvider) {
      logger.warn('SMS service not configured');
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const result = await this.smsProvider.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info('SMS sent successfully', {
        to: phoneNumber,
        sid: result.sid
      });

      return { success: true, result };

    } catch (error) {
      logger.error('Failed to send SMS', {
        to: phoneNumber,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send security alert SMS
   */
  async sendSecurityAlert(phoneNumber, alertType, details) {
    const message = `🔒 SAIV Security Alert: ${alertType}. ${details}. If this wasn't you, contact support immediately.`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send transaction alert SMS
   */
  async sendTransactionAlert(phoneNumber, amount, asset, type) {
    const message = `✅ SAIV: ${type} of ${amount} ${asset} confirmed. Check your app for details.`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send templated SMS notification
   * @param {string} templateId Template identifier
   * @param {string} phoneNumber Recipient phone number
   * @param {Object} variables Template variables
   */
  async sendTemplatedSMS(templateId, phoneNumber, variables = {}) {
    try {
      const template = notificationTemplates.renderTemplate(templateId, variables);
      return await this.sendSMS(phoneNumber, template.message);
    } catch (error) {
      logger.error('Failed to send templated SMS', {
        templateId,
        phoneNumber,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome SMS to new user
   */
  async sendWelcomeSMS(phoneNumber, userName) {
    return await this.sendTemplatedSMS('sms_welcome', phoneNumber, { userName });
  }

  /**
   * Send group payment reminder SMS
   */
  async sendGroupPaymentReminder(phoneNumber, groupName, amount, daysLeft) {
    const message = `⏰ SAIV Reminder: ${groupName} payment of ${amount} due in ${daysLeft} day(s). Don't miss this round's interest!`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send savings milestone SMS
   */
  async sendSavingsMilestoneSMS(phoneNumber, milestone, amount, asset) {
    const message = `🎯 SAIV: Milestone reached! You've saved ${amount} ${asset} - ${milestone} achieved! Keep it up!`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send low balance alert SMS
   */
  async sendLowBalanceAlert(phoneNumber, balance, asset, threshold) {
    const message = `⚠️ SAIV: Low balance alert! Your ${asset} balance (${balance}) is below ${threshold}. Consider topping up.`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send automatic withdrawal notification SMS
   */
  async sendAutoWithdrawalSMS(phoneNumber, amount, asset, destination) {
    const message = `💰 SAIV: Auto-withdrawal of ${amount} ${asset} to ${destination} completed successfully.`;

    return await this.sendSMS(phoneNumber, message);
  }

  // ============================================
  // PUSH NOTIFICATIONS
  // ============================================

  /**
   * Send push notification
   * @param {Array|string} tokens Device token(s) or user IDs
   * @param {Object} notification Notification data
   * @param {string} notification.title Notification title
   * @param {string} notification.body Notification body
   * @param {Object} notification.data Optional data payload
   */
  async sendPushNotification(tokens, notification) {
    if (!this.pushProvider) {
      logger.warn('Push notification service not configured');
      return { success: false, error: 'Push notification service not configured' };
    }

    try {
      let result;

      switch (this.pushProvider) {
        case 'firebase':
          result = await this.sendFirebasePushNotification(tokens, notification);
          break;

        case 'onesignal':
          result = await this.sendOneSignalPushNotification(tokens, notification);
          break;

        default:
          throw new Error(`Unsupported push provider: ${this.pushProvider}`);
      }

      logger.info('Push notification sent successfully', {
        tokens: Array.isArray(tokens) ? tokens.length : 1,
        title: notification.title,
        provider: this.pushProvider
      });

      return { success: true, result };

    } catch (error) {
      logger.error('Failed to send push notification', {
        tokens: Array.isArray(tokens) ? tokens.length : 1,
        title: notification.title,
        error: error.message,
        provider: this.pushProvider
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Send Firebase push notification
   */
  async sendFirebasePushNotification(tokens, notification) {
    const admin = require('firebase-admin');

    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    return await admin.messaging().sendMulticast(message);
  }

  /**
   * Send OneSignal push notification
   */
  async sendOneSignalPushNotification(tokens, notification) {
    const axios = require('axios');

    const data = {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: Array.isArray(tokens) ? tokens : [tokens],
      headings: { en: notification.title },
      contents: { en: notification.body },
      data: notification.data || {}
    };

    const response = await axios.post('https://onesignal.com/api/v1/notifications', data, {
      headers: {
        'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  }

  /**
   * Send welcome push notification
   */
  async sendWelcomePushNotification(deviceTokens, userName) {
    return await this.sendPushNotification(deviceTokens, {
      title: 'Welcome to Saiv! 🎉',
      body: `Hi ${userName}! Your gasless Web3 savings journey starts now. Tap to explore!`,
      data: {
        type: 'welcome',
        action: 'open_dashboard'
      }
    });
  }

  /**
   * Send transaction push notification
   */
  async sendTransactionPushNotification(deviceTokens, transactionData) {
    const { type, amount, asset } = transactionData;

    return await this.sendPushNotification(deviceTokens, {
      title: 'Transaction Confirmed ✅',
      body: `Your ${type} of ${amount} ${asset} was successful!`,
      data: {
        type: 'transaction',
        action: 'view_transaction',
        transactionData
      }
    });
  }

  /**
   * Send group payment reminder push notification
   */
  async sendGroupPaymentReminderPush(deviceTokens, groupData) {
    const { groupName, amount, daysLeft } = groupData;

    return await this.sendPushNotification(deviceTokens, {
      title: 'Payment Reminder ⏰',
      body: `${groupName} payment of ${amount} due in ${daysLeft} day(s)!`,
      data: {
        type: 'payment_reminder',
        action: 'make_payment',
        groupData
      }
    });
  }

  /**
   * Send savings milestone push notification
   */
  async sendSavingsMilestonePush(deviceTokens, milestoneData) {
    const { milestone, amount, asset } = milestoneData;

    return await this.sendPushNotification(deviceTokens, {
      title: 'Milestone Reached! 🎯',
      body: `Congratulations! You've achieved ${milestone} with ${amount} ${asset} saved!`,
      data: {
        type: 'milestone',
        action: 'view_savings',
        milestoneData
      }
    });
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Strip HTML tags from content
   */
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Queue notification for batch processing
   */
  queueNotification(type, options) {
    this.notificationQueue.push({
      type,
      options,
      timestamp: Date.now(),
      retries: 0
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processNotificationQueue();
    }
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue() {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batchSize = parseInt(process.env.NOTIFICATION_BATCH_SIZE) || 10;
      const batch = this.notificationQueue.splice(0, batchSize);

      for (const notification of batch) {
        try {
          let result;

          switch (notification.type) {
            case 'email':
              result = await this.sendEmail(notification.options);
              break;
            case 'sms':
              result = await this.sendSMS(notification.options.phoneNumber, notification.options.message);
              break;
            case 'push':
              // Push notification implementation
              break;
            default:
              logger.warn(`Unknown notification type: ${notification.type}`);
              continue;
          }

          if (!result.success && notification.retries < (parseInt(process.env.NOTIFICATION_RETRY_ATTEMPTS) || 3)) {
            // Retry failed notification
            notification.retries++;
            this.notificationQueue.push(notification);
          }

        } catch (error) {
          logger.error('Error processing notification', {
            type: notification.type,
            error: error.message
          });
        }
      }

    } finally {
      this.isProcessing = false;

      // Continue processing if there are more notifications
      if (this.notificationQueue.length > 0) {
        setTimeout(() => this.processNotificationQueue(),
          parseInt(process.env.NOTIFICATION_RETRY_DELAY) || 1000);
      }
    }
  }

  // ============================================
  // NOTIFICATION PREFERENCES & SCHEDULING
  // ============================================

  /**
   * Send notification with preference checking
   * @param {string} userId User ID
   * @param {string} type Notification type
   * @param {Object} data Notification data
   * @param {Array} channels Preferred channels ['email', 'sms', 'push']
   */
  async sendNotificationToUser(userId, type, data, channels = ['email']) {
    try {
      const preferences = await NotificationPreference.findByUserId(userId);

      if (!preferences) {
        logger.warn('No notification preferences found for user', { userId });
        return { success: false, error: 'User preferences not found' };
      }

      const results = [];

      for (const channel of channels) {
        if (!preferences.shouldReceiveNotification(channel, type)) {
          logger.info('User opted out of notification', { userId, channel, type });
          continue;
        }

        let result;

        switch (channel) {
          case 'email':
            result = await this.sendTemplatedEmail(`email_${type}`, preferences.email, data);
            break;

          case 'sms':
            if (preferences.phoneNumber) {
              result = await this.sendTemplatedSMS(`sms_${type}`, preferences.phoneNumber, data);
            } else {
              result = { success: false, error: 'No phone number configured' };
            }
            break;

          case 'push':
            const tokens = preferences.getActiveDeviceTokens();
            if (tokens.length > 0) {
              result = await this.sendTemplatedPushNotification(`push_${type}`, tokens, data);
            } else {
              result = { success: false, error: 'No active device tokens' };
            }
            break;

          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }

        results.push({ channel, ...result });
      }

      return { success: true, results };

    } catch (error) {
      logger.error('Failed to send notification to user', {
        userId,
        type,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send templated push notification
   * @param {string} templateId Template identifier
   * @param {Array} deviceTokens Device tokens
   * @param {Object} variables Template variables
   */
  async sendTemplatedPushNotification(templateId, deviceTokens, variables = {}) {
    try {
      const template = notificationTemplates.renderTemplate(templateId, variables);

      return await this.sendPushNotification(deviceTokens, {
        title: template.title,
        body: template.body,
        data: { ...template.data, ...variables }
      });
    } catch (error) {
      logger.error('Failed to send templated push notification', {
        templateId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule notification
   * @param {Object} config Notification configuration
   */
  async scheduleNotification(config) {
    try {
      const scheduledNotification = await ScheduledNotification.scheduleNotification(config);

      logger.info('Notification scheduled', {
        id: scheduledNotification._id,
        userId: config.userId,
        type: config.type,
        scheduledFor: config.scheduling.scheduledFor
      });

      return { success: true, scheduledNotification };

    } catch (error) {
      logger.error('Failed to schedule notification', {
        config,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule recurring notification
   * @param {Object} config Notification configuration with recurring settings
   */
  async scheduleRecurringNotification(config) {
    try {
      const scheduledNotification = await ScheduledNotification.scheduleRecurringNotification(config);

      logger.info('Recurring notification scheduled', {
        id: scheduledNotification._id,
        userId: config.userId,
        type: config.type,
        pattern: config.scheduling.recurring.pattern
      });

      return { success: true, scheduledNotification };

    } catch (error) {
      logger.error('Failed to schedule recurring notification', {
        config,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Process due notifications
   */
  async processDueNotifications() {
    try {
      const dueNotifications = await ScheduledNotification.findDueNotifications(50);

      logger.info('Processing due notifications', { count: dueNotifications.length });

      for (const notification of dueNotifications) {
        try {
          const preferences = await NotificationPreference.findByUserId(notification.userId);

          if (!preferences) {
            await notification.markAsFailed(new Error('User preferences not found'));
            continue;
          }

          if (!preferences.shouldReceiveNotification(notification.channel, notification.type)) {
            await notification.markAsFailed(new Error('User opted out of notification'));
            continue;
          }

          const variables = Object.fromEntries(notification.templateVariables);
          let result;

          switch (notification.channel) {
            case 'email':
              result = await this.sendTemplatedEmail(notification.templateId, preferences.email, variables);
              break;

            case 'sms':
              if (!preferences.phoneNumber) {
                throw new Error('No phone number configured');
              }
              result = await this.sendTemplatedSMS(notification.templateId, preferences.phoneNumber, variables);
              break;

            case 'push':
              const tokens = preferences.getActiveDeviceTokens();
              if (tokens.length === 0) {
                throw new Error('No active device tokens');
              }
              result = await this.sendTemplatedPushNotification(notification.templateId, tokens, variables);
              break;

            default:
              throw new Error(`Unknown channel: ${notification.channel}`);
          }

          if (result.success) {
            await notification.markAsSent(result);
          } else {
            await notification.markAsFailed(new Error(result.error));
          }

        } catch (error) {
          await notification.markAsFailed(error);
          logger.error('Failed to process scheduled notification', {
            notificationId: notification._id,
            error: error.message
          });
        }
      }

      return { success: true, processed: dueNotifications.length };

    } catch (error) {
      logger.error('Failed to process due notifications', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create user notification preferences
   * @param {string} userId User ID
   * @param {string} email User email
   * @param {string} phoneNumber User phone number (optional)
   */
  async createUserPreferences(userId, email, phoneNumber = null) {
    try {
      const preferences = await NotificationPreference.createDefaultPreferences(userId, email, phoneNumber);

      logger.info('User notification preferences created', { userId });

      return { success: true, preferences };

    } catch (error) {
      logger.error('Failed to create user preferences', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user notification preferences
   * @param {string} userId User ID
   * @param {Object} updates Preference updates
   */
  async updateUserPreferences(userId, updates) {
    try {
      const preferences = await NotificationPreference.updatePreferences(userId, updates);

      if (!preferences) {
        return { success: false, error: 'User preferences not found' };
      }

      logger.info('User notification preferences updated', { userId });

      return { success: true, preferences };

    } catch (error) {
      logger.error('Failed to update user preferences', {
        userId,
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      emailProvider: this.emailProvider,
      smsProvider: this.smsProvider ? 'twilio' : null,
      pushProvider: this.pushProvider,
      queueLength: this.notificationQueue.length,
      isProcessing: this.isProcessing,
      templates: notificationTemplates.getStats()
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    const issues = [];

    if (!this.isInitialized) {
      issues.push('Service not initialized');
    }

    if (!this.emailProvider) {
      issues.push('Email service not configured');
    }

    if (!this.smsProvider) {
      issues.push('SMS service not configured');
    }

    return {
      healthy: issues.length === 0,
      issues,
      status: this.getStatus()
    };
  }
}

module.exports = new NotificationService();