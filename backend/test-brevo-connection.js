const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

/**
 * Test Brevo SMTP and API connections
 */
async function testBrevoConnections() {
  console.log('🔍 Testing Brevo Connections...\n');

  // Test 1: SMTP Connection
  await testSMTPConnection();

  // Test 2: API Key Validation
  await testAPIConnection();
}

/**
 * Test SMTP connection to Brevo
 */
async function testSMTPConnection() {
  console.log('📧 Testing SMTP Connection...');
  console.log('='.repeat(50));

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.BREVO_SMTP_HOST,
      port: parseInt(process.env.BREVO_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS
      }
    });

    console.log(`Host: ${process.env.BREVO_SMTP_HOST}`);
    console.log(`Port: ${process.env.BREVO_SMTP_PORT}`);
    console.log(`User: ${process.env.BREVO_SMTP_USER}`);
    console.log(`Pass: ${'*'.repeat(process.env.BREVO_SMTP_PASS?.length || 0)}`);

    // Verify connection
    console.log('\n⏳ Verifying SMTP connection...');
    const verified = await transporter.verify();

    if (verified) {
      console.log('✅ SMTP Connection: SUCCESS');
      console.log('   - Server is ready to accept messages');

      // Test sending a real email
      console.log('\n⏳ Testing email send...');
      const testEmail = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: process.env.BREVO_SMTP_USER, // Send to yourself
        subject: 'Brevo SMTP Test - Saiv Platform',
        html: `
          <h2>✅ SMTP Test Successful!</h2>
          <p>This email confirms that your Brevo SMTP configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Test performed by:</strong> Saiv Platform Backend</p>
        `
      };

      const result = await transporter.sendMail(testEmail);
      console.log('✅ Email Send: SUCCESS');
      console.log(`   - Message ID: ${result.messageId}`);
      console.log(`   - Accepted: ${result.accepted.join(', ')}`);
      console.log(`   - Response: ${result.response}`);

    } else {
      console.log('❌ SMTP Connection: FAILED');
    }

  } catch (error) {
    console.log('❌ SMTP Connection: ERROR');
    console.log(`   - Error: ${error.message}`);
    if (error.code) console.log(`   - Code: ${error.code}`);
    if (error.command) console.log(`   - Command: ${error.command}`);
  }

  console.log('\n');
}

/**
 * Test API key connection to Brevo
 */
async function testAPIConnection() {
  console.log('🔑 Testing API Key Connection...');
  console.log('='.repeat(50));

  try {
    const apiKey = process.env.BREVO_API_KEY;
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET'}`);

    if (!apiKey) {
      console.log('❌ API Key: NOT CONFIGURED');
      return;
    }

    // Test 1: Get account info
    console.log('\n⏳ Testing account access...');
    const accountResponse = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Account Access: SUCCESS');
    console.log(`   - Company: ${accountResponse.data.companyName}`);
    console.log(`   - Email: ${accountResponse.data.email}`);
    console.log(`   - Plan: ${accountResponse.data.plan?.type || 'Unknown'}`);

    // Test 2: Get email quota
    console.log('\n⏳ Testing email quota...');
    const quotaResponse = await axios.get('https://api.brevo.com/v3/account', {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const plan = quotaResponse.data.plan;
    if (plan) {
      console.log('✅ Email Quota: AVAILABLE');
      console.log(`   - Type: ${plan.type}`);
      console.log(`   - Credits Used: ${plan.creditsUsed || 0}`);
      console.log(`   - Credits Total: ${plan.creditsTotal || 'Unlimited'}`);
    }

    // Test 3: List senders (verify sending domain)
    console.log('\n⏳ Testing sender verification...');
    const sendersResponse = await axios.get('https://api.brevo.com/v3/senders', {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Senders List: SUCCESS');
    sendersResponse.data.senders.forEach(sender => {
      console.log(`   - ${sender.email} (${sender.active ? 'Active' : 'Inactive'})`);
    });

    // Test 4: Send test email via API
    console.log('\n⏳ Testing email send via API...');
    const emailData = {
      sender: {
        name: process.env.EMAIL_FROM_NAME || 'Saiv Platform',
        email: process.env.EMAIL_FROM_ADDRESS || 'noreply@saiv.platform'
      },
      to: [{
        email: process.env.BREVO_SMTP_USER,
        name: 'Test Recipient'
      }],
      subject: 'Brevo API Test - Saiv Platform',
      htmlContent: `
        <h2>✅ API Test Successful!</h2>
        <p>This email confirms that your Brevo API key is working correctly.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Test performed by:</strong> Saiv Platform Backend</p>
        <p><strong>API Used:</strong> Brevo Transactional Email API v3</p>
      `
    };

    const emailResponse = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ API Email Send: SUCCESS');
    console.log(`   - Message ID: ${emailResponse.data.messageId}`);

  } catch (error) {
    console.log('❌ API Connection: ERROR');
    console.log(`   - Status: ${error.response?.status || 'Unknown'}`);
    console.log(`   - Message: ${error.response?.data?.message || error.message}`);

    if (error.response?.status === 401) {
      console.log('   - Issue: Invalid API key');
    } else if (error.response?.status === 403) {
      console.log('   - Issue: API key lacks required permissions');
    }
  }

  console.log('\n');
}

/**
 * Display summary and recommendations
 */
function displaySummary() {
  console.log('📋 Summary & Recommendations');
  console.log('='.repeat(50));
  console.log('✅ SMTP: Use for transactional emails (current setup)');
  console.log('✅ API: Use for advanced features (templates, analytics)');
  console.log('💡 Both methods work - SMTP is simpler, API is more powerful');
  console.log('\n🔗 Brevo Documentation:');
  console.log('   - SMTP: https://help.brevo.com/hc/en-us/articles/209467485');
  console.log('   - API: https://developers.brevo.com/docs');
  console.log('\n');
}

// Run the tests
if (require.main === module) {
  testBrevoConnections()
    .then(() => {
      displaySummary();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testBrevoConnections, testSMTPConnection, testAPIConnection };