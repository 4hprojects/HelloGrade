// routes/studentEthnicityRoutes.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch'); // For reCAPTCHA verification
const { google } = require('googleapis');

// 1) Prepare Google service account from .env
const serviceAccount = {
  type: process.env.GOOGLE_TYPE,
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: process.env.GOOGLE_AUTH_URI,
  token_uri: process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID_SURVEYS || '1PPTDh5s0uRZu0p4ov-jea9zEzwfjHMvlrZyblMRtdvw';
const SHEET_NAME = 'StudentEthnicGroups'; // The target tab name in your Google Sheet

/**
 * POST /api/student-ethnicity/submit-survey
 * 
 * Expects fields from the form, plus g-recaptcha-response.
 * Validates reCAPTCHA, then appends row in Google Sheets.
 */
router.post('/submit-survey', async (req, res) => {
  try {
    // 1) Validate reCAPTCHA
    const token = req.body['g-recaptcha-response'];
    if (!token) {
      return res.status(400).json({ success: false, message: 'No reCAPTCHA token provided.' });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

    // POST to Google reCAPTCHA server
    const captchaRes = await fetch(verifyURL, { method: 'POST' }).then((r) => r.json());
    if (!captchaRes.success) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA verification failed.' });
    }

    // 2) Parse form fields
    // (Same names as from your HTML form)
    const {
      firstName,
      lastName,
      studentID,
      yearLevel,
      yearLevelOther,
      section,
      sectionOther,
      degree,
      degreeOther,
      nationality,
      otherNationality,

      // If Filipino
      ethnicity,           // array of strings (checkboxes)
      ethnicityOtherLuzon,
      ethnicityOtherVisayas,
      ethnicityOtherMindanao,

      // If not Filipino
      nonFilipino,

      // If multiple ethnicities
      primaryEthnicity
    } = req.body;

    // 3) Finalize data (handle "Others")
    const finalYearLevel = (yearLevel === 'Others') ? yearLevelOther : yearLevel;
    const finalSection   = (section === 'Others') ? sectionOther : section;
    const finalDegree    = (degree === 'Others') ? degreeOther : degree;
    const finalNationality = (nationality === 'Other') ? otherNationality : nationality;

    // Combine user-chosen ethnic groups into a single string
    // ethnicity might be undefined if user is not Filipino
    let ethnicityJoined = Array.isArray(ethnicity) ? ethnicity.join(', ') : '';
    if (ethnicityOtherLuzon) {
      ethnicityJoined += `, Other(Luzon): ${ethnicityOtherLuzon}`;
    }
    if (ethnicityOtherVisayas) {
      ethnicityJoined += `, Other(Visayas): ${ethnicityOtherVisayas}`;
    }
    if (ethnicityOtherMindanao) {
      ethnicityJoined += `, Other(Mindanao): ${ethnicityOtherMindanao}`;
    }

    // 4) Prepare row for Google Sheets
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }); 
    // Columns (example):
    // [Timestamp, FirstName, LastName, StudentID, YearLevel, Section, Degree, Nationality, Ethnicity, NonFilipino, PrimaryEthnicity]

    const row = [
      now,
      firstName || '',
      lastName || '',
      studentID || '',
      finalYearLevel || '',
      finalSection   || '',
      finalDegree    || '',
      finalNationality || '',
      ethnicityJoined.trim(),
      nonFilipino || '',
      primaryEthnicity || ''
    ];

    // 5) Append row to Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheetsApi = google.sheets({ version: 'v4', auth: await auth.getClient() });

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET_NAME, 
      valueInputOption: 'USER_ENTERED',
      resource: { values: [ row ] },
    });

    // 6) (Optional) Save to MongoDB if you'd like (not shown here)

    // 7) Send success response
    return res.json({ success: true, message: 'Survey submitted successfully!' });
  } catch (err) {
    console.error('Error in /submit-survey:', err);
    return res.status(500).json({ success: false, message: 'Internal server error while submitting survey.' });
  }
});

module.exports = router;
