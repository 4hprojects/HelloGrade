const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');

const serviceAccount = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

router.post('/bytefunrun2025', async (req, res) => {
  try {
    const {
      distance, email, firstName, lastName, age, gender,
      emergencyContactName, emergencyContactNumber,
      organization, otherOrganization, signature
    } = req.body;

    let finalOrganization = organization;
    if (organization === 'others' && otherOrganization) {
      finalOrganization = otherOrganization;
    }

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    const SPREADSHEET_ID = '1OKY2K73Ya73o9NWe_Rtr36jO267CWLMhxeuLrde0b80';
    const SHEET_NAME = 'MasterList';

    const now = new Date().toLocaleString();
    const row = [
      distance, email, firstName, lastName, age, gender,
      emergencyContactName, emergencyContactNumber,
      finalOrganization, signature, now
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] }
    });

    if (email && process.env.SENDER_EMAIL) {
      await sgMail.send({
        to: email,
        from: process.env.SENDER_EMAIL,
        subject: 'BYTe Fun Run 2025 Sign-Up Confirmation',
        html: `
          <p>Hi ${firstName},</p>
          <p>Thank you for signing up for the <strong>BYTe Fun Run 2025</strong>.</p>
          <h2>2025 BYTe Fun Run Race Details</h2>
          <ul>
            <li><strong>Event Time:</strong> 28th February 2025 (Friday) - 5:00 am to 7:00 am</li>
            <li><strong>Event Address:</strong> CIS Building - Benguet State University</li>
            <li><strong>Gun Start:</strong> 5:50 am (5k) and 6:00 am (3k)</li>
          </ul>
          <h3>Claiming of Race Bib:</h3>
          <ul>
            <li><strong>Location:</strong> CIS Building - BYTE Office (First Floor)</li>
            <li><strong>(Thu) 27th February:</strong> 3:00 pm to 5:00 pm</li>
            <li><strong>(Fri) 28th February:</strong> 5:00 am to 5:30 am</li>
          </ul>
          <p>More info: <a href="https://www.hellograde.online/events/2025bytefunruninfo" target="_blank">event page</a>.</p>
          <p>Best Regards,<br>BYTe Team</p>
        `
      });
    }

    return res.status(200).json({ success: true, message: 'Fun Run sign-up submitted successfully!' });
  } catch (err) {
    console.error('Error in /api/bytefunrun2025 sign-up:', err);
    return res.status(500).json({ success: false, message: 'An error occurred while submitting your sign-up.' });
  }
});

module.exports = router;
