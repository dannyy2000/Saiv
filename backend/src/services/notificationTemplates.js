const logger = require('../utils/logger');

/**
 * Notification Templates Service
 * Manages customizable notification templates for different types of notifications
 */
class NotificationTemplates {
  constructor() {
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  /**
   * Load default notification templates
   */
  loadDefaultTemplates() {
    // EMAIL TEMPLATES
    this.templates.set('email_welcome', {
      subject: 'Welcome to Saiv Platform! Your Web3 Savings Journey Begins 🚀',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Welcome to Saiv Platform! 🎉</h1>

          <p>Hi {{userName}},</p>

          <p>Welcome to <strong>Saiv</strong> - your new Web3 savings platform! We're excited to have you join our community.</p>

          <h2 style="color: #1f2937;">What you can do with Saiv:</h2>
          <ul>
            <li>✅ <strong>100% Gasless</strong> - No transaction fees ever!</li>
            <li>✅ <strong>Personal Savings</strong> - Earn yield on your individual savings</li>
            <li>✅ <strong>Group Savings</strong> - Save together with friends and family</li>
            <li>✅ <strong>Automatic Withdrawals</strong> - Set it and forget it</li>
            <li>✅ <strong>Smart Analytics</strong> - Track your financial progress</li>
          </ul>

          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #059669; margin-top: 0;">🚀 Get Started:</h3>
            <p>Your wallets have been automatically created and are ready to use!</p>
            <ul>
              <li><strong>Main Wallet:</strong> For general transactions</li>
              <li><strong>Savings Wallet:</strong> For earning yield via Aave</li>
            </ul>
          </div>

          <p>If you have any questions, our support team is here to help!</p>

          <p>Happy saving! 💰</p>

          <p>
            Best regards,<br>
            The Saiv Team
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #6b7280;">
            This email was sent to {{userEmail}}. If you didn't create a Saiv account, please ignore this email.
          </p>
        </div>
      `,
      variables: ['userName', 'userEmail']
    });

    this.templates.set('email_transaction_confirmation', {
      subject: 'Transaction Confirmed: {{amount}} {{asset}} {{type}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Transaction Confirmed ✅</h1>

          <div style="background: #f0f9f0; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
            <h2 style="color: #059669; margin-top: 0;">Transaction Details</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Type:</strong> {{type}}</li>
              <li><strong>Amount:</strong> {{amount}} {{asset}}</li>
              <li><strong>Time:</strong> {{timestamp}}</li>
              <li><strong>Transaction Hash:</strong> <code style="background: #e5e7eb; padding: 2px 4px; border-radius: 4px;">{{txHash}}</code></li>
            </ul>
          </div>

          <p>Your transaction has been successfully processed on the blockchain.</p>

          <p style="font-size: 14px; color: #6b7280;">
            You can view this transaction on the blockchain explorer using the transaction hash above.
          </p>

          <p>
            Best regards,<br>
            The Saiv Team
          </p>
        </div>
      `,
      variables: ['type', 'amount', 'asset', 'timestamp', 'txHash']
    });

    this.templates.set('email_group_invitation', {
      subject: 'Join {{groupName}} - Group Savings Invitation from {{inviterName}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">You're Invited to Join a Savings Group! 🤝</h1>

          <p><strong>{{inviterName}}</strong> has invited you to join their savings group on Saiv!</p>

          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h2 style="color: #d97706; margin-top: 0;">Group Details</h2>
            <ul style="list-style: none; padding: 0;">
              <li><strong>Group Name:</strong> {{groupName}}</li>
              <li><strong>Description:</strong> {{description}}</li>
              <li><strong>Target Amount:</strong> {{targetAmount}}</li>
              <li><strong>Lock Period:</strong> {{lockPeriod}}</li>
            </ul>
          </div>

          <h3>How Group Savings Work:</h3>
          <ul>
            <li>💰 <strong>Contribute Together:</strong> Everyone saves toward a common goal</li>
            <li>📈 <strong>Earn Interest:</strong> Funds earn yield via Aave protocol</li>
            <li>⚖️ <strong>Fair Distribution:</strong> You get back your contribution + proportional interest</li>
            <li>🔒 <strong>Secure & Transparent:</strong> Smart contracts manage everything automatically</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="{{joinUrl}}"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Join Group
            </a>
          </div>

          <p>Start saving together today!</p>

          <p>
            Best regards,<br>
            The Saiv Team
          </p>
        </div>
      `,
      variables: ['inviterName', 'groupName', 'description', 'targetAmount', 'lockPeriod', 'joinUrl']
    });

    this.templates.set('email_milestone', {
      subject: '🎯 Milestone Reached: {{milestone}} - {{amount}} {{asset}} Saved!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Congratulations! Milestone Reached 🎯</h1>

          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <h2 style="color: #059669; margin-top: 0;">🎉 {{milestone}} Achievement</h2>
            <p><strong>You've successfully saved {{amount}} {{asset}}!</strong></p>
          </div>

          <h3>Your Savings Summary:</h3>
          <ul style="background: #f9fafb; padding: 20px; border-radius: 8px;">
            <li><strong>Total Saved:</strong> {{totalSaved}} {{asset}}</li>
            <li><strong>Interest Earned:</strong> {{interestEarned}} {{asset}}</li>
            <li><strong>Current Milestone:</strong> {{milestone}}</li>
          </ul>

          <p>Keep up the excellent work! Every step brings you closer to your financial goals.</p>

          <p>
            Best regards,<br>
            The Saiv Team
          </p>
        </div>
      `,
      variables: ['milestone', 'amount', 'asset', 'totalSaved', 'interestEarned']
    });

    // SMS TEMPLATES
    this.templates.set('sms_welcome', {
      message: '🎉 Welcome to Saiv, {{userName}}! Your gasless Web3 savings account is ready. Start saving today with 0 fees!',
      variables: ['userName']
    });

    this.templates.set('sms_transaction_alert', {
      message: '✅ SAIV: {{type}} of {{amount}} {{asset}} confirmed. Check your app for details.',
      variables: ['type', 'amount', 'asset']
    });

    this.templates.set('sms_security_alert', {
      message: '🔒 SAIV Security Alert: {{alertType}}. {{details}}. If this wasn\'t you, contact support immediately.',
      variables: ['alertType', 'details']
    });

    this.templates.set('sms_payment_reminder', {
      message: '⏰ SAIV Reminder: {{groupName}} payment of {{amount}} due in {{daysLeft}} day(s). Don\'t miss this round\'s interest!',
      variables: ['groupName', 'amount', 'daysLeft']
    });

    this.templates.set('sms_milestone', {
      message: '🎯 SAIV: Milestone reached! You\'ve saved {{amount}} {{asset}} - {{milestone}} achieved! Keep it up!',
      variables: ['amount', 'asset', 'milestone']
    });

    this.templates.set('sms_low_balance', {
      message: '⚠️ SAIV: Low balance alert! Your {{asset}} balance ({{balance}}) is below {{threshold}}. Consider topping up.',
      variables: ['asset', 'balance', 'threshold']
    });

    this.templates.set('sms_auto_withdrawal', {
      message: '💰 SAIV: Auto-withdrawal of {{amount}} {{asset}} to {{destination}} completed successfully.',
      variables: ['amount', 'asset', 'destination']
    });

    // PUSH NOTIFICATION TEMPLATES
    this.templates.set('push_welcome', {
      title: 'Welcome to Saiv! 🎉',
      body: 'Hi {{userName}}! Your gasless Web3 savings journey starts now. Tap to explore!',
      data: {
        type: 'welcome',
        action: 'open_dashboard'
      },
      variables: ['userName']
    });

    this.templates.set('push_transaction', {
      title: 'Transaction Confirmed ✅',
      body: 'Your {{type}} of {{amount}} {{asset}} was successful!',
      data: {
        type: 'transaction',
        action: 'view_transaction'
      },
      variables: ['type', 'amount', 'asset']
    });

    this.templates.set('push_payment_reminder', {
      title: 'Payment Reminder ⏰',
      body: '{{groupName}} payment of {{amount}} due in {{daysLeft}} day(s)!',
      data: {
        type: 'payment_reminder',
        action: 'make_payment'
      },
      variables: ['groupName', 'amount', 'daysLeft']
    });

    this.templates.set('push_milestone', {
      title: 'Milestone Reached! 🎯',
      body: 'Congratulations! You\'ve achieved {{milestone}} with {{amount}} {{asset}} saved!',
      data: {
        type: 'milestone',
        action: 'view_savings'
      },
      variables: ['milestone', 'amount', 'asset']
    });

    logger.info('Default notification templates loaded', {
      templateCount: this.templates.size
    });
  }

  /**
   * Get template by ID
   * @param {string} templateId Template identifier
   * @returns {Object|null} Template object or null if not found
   */
  getTemplate(templateId) {
    return this.templates.get(templateId) || null;
  }

  /**
   * Render template with variables
   * @param {string} templateId Template identifier
   * @param {Object} variables Variables to substitute in template
   * @returns {Object} Rendered template
   */
  renderTemplate(templateId, variables = {}) {
    const template = this.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate required variables
    const missingVars = template.variables.filter(varName =>
      variables[varName] === undefined || variables[varName] === null
    );

    if (missingVars.length > 0) {
      logger.warn('Missing template variables', {
        templateId,
        missingVars,
        providedVars: Object.keys(variables)
      });
    }

    // Render template
    const rendered = {};

    // Render each field in template
    Object.keys(template).forEach(key => {
      if (key === 'variables') return; // Skip metadata

      const value = template[key];

      if (typeof value === 'string') {
        rendered[key] = this.substituteVariables(value, variables);
      } else if (typeof value === 'object' && value !== null) {
        rendered[key] = this.substituteVariablesInObject(value, variables);
      } else {
        rendered[key] = value;
      }
    });

    return rendered;
  }

  /**
   * Substitute variables in string
   * @param {string} text Text with {{variable}} placeholders
   * @param {Object} variables Variable values
   * @returns {string} Text with variables substituted
   */
  substituteVariables(text, variables) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName];

      if (value === undefined || value === null) {
        logger.warn(`Variable not provided: ${varName}`);
        return match; // Return original placeholder
      }

      return String(value);
    });
  }

  /**
   * Substitute variables in object recursively
   * @param {Object} obj Object with string values containing variables
   * @param {Object} variables Variable values
   * @returns {Object} Object with variables substituted
   */
  substituteVariablesInObject(obj, variables) {
    const result = {};

    Object.keys(obj).forEach(key => {
      const value = obj[key];

      if (typeof value === 'string') {
        result[key] = this.substituteVariables(value, variables);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteVariablesInObject(value, variables);
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Add custom template
   * @param {string} templateId Template identifier
   * @param {Object} template Template object
   */
  addTemplate(templateId, template) {
    if (!template.variables || !Array.isArray(template.variables)) {
      throw new Error('Template must include variables array');
    }

    this.templates.set(templateId, template);

    logger.info('Custom template added', {
      templateId,
      variables: template.variables
    });
  }

  /**
   * Update existing template
   * @param {string} templateId Template identifier
   * @param {Object} updates Template updates
   */
  updateTemplate(templateId, updates) {
    const existing = this.templates.get(templateId);

    if (!existing) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const updated = { ...existing, ...updates };
    this.templates.set(templateId, updated);

    logger.info('Template updated', { templateId });
  }

  /**
   * Remove template
   * @param {string} templateId Template identifier
   */
  removeTemplate(templateId) {
    const removed = this.templates.delete(templateId);

    if (removed) {
      logger.info('Template removed', { templateId });
    }

    return removed;
  }

  /**
   * List all templates
   * @returns {Array} Array of template IDs and metadata
   */
  listTemplates() {
    const templates = [];

    this.templates.forEach((template, id) => {
      templates.push({
        id,
        variables: template.variables,
        hasSubject: Boolean(template.subject),
        hasTitle: Boolean(template.title),
        hasBody: Boolean(template.body || template.message || template.html)
      });
    });

    return templates;
  }

  /**
   * Get template usage statistics
   * @returns {Object} Usage statistics
   */
  getStats() {
    const stats = {
      totalTemplates: this.templates.size,
      emailTemplates: 0,
      smsTemplates: 0,
      pushTemplates: 0
    };

    this.templates.forEach((template, id) => {
      if (id.startsWith('email_')) stats.emailTemplates++;
      else if (id.startsWith('sms_')) stats.smsTemplates++;
      else if (id.startsWith('push_')) stats.pushTemplates++;
    });

    return stats;
  }
}

module.exports = new NotificationTemplates();