const express = require('express');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const randomizeActivity = require('../utils/activityRandomizer');

module.exports = function activityRandomRoutes({ activityAssignmentsCollection, sendEmail }) {
  const router = express.Router();

  // Test email exclusions
  const TEST_EMAILS = new Set(['henson.sagorsor@e.ubaguio.edu']);

  const SUBJECTS = ['PROGIT1', 'DSALGO1'];
  const LINKS = {
    PROGIT1: [
      'https://placeholder.progit1/1',
      'https://placeholder.progit1/2',
      'https://placeholder.progit1/3',
    ],
    DSALGO1: [
      'https://placeholder.dsalgo1/1',
      'https://placeholder.dsalgo1/2',
      'https://placeholder.dsalgo1/3',
    ],
  };

  const activityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Try again later.' },
    skip: (req) => TEST_EMAILS.has(String(req.body?.email || '').toLowerCase()),
  });

  router.post('/activity/random', activityLimiter, async (req, res) => {
    try {
      const { email, idNumber, subject, 'g-recaptcha-response': captchaToken } = req.body;
      if (!email || !subject) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
      }

      const lowerEmail = String(email).toLowerCase();
      const isTest = TEST_EMAILS.has(lowerEmail);

      // Validation
      if (!SUBJECTS.includes(subject)) {
        return res.status(400).json({ success: false, message: 'Invalid subject.' });
      }
      if (!isTest) {
        const m = lowerEmail.match(/^(\d+)@s\.ubaguio\.edu$/i);
        if (!m) return res.status(400).json({ success: false, message: 'Email must be idnumber@s.ubaguio.edu.' });
        if (!idNumber || m[1] !== String(idNumber)) {
          return res.status(400).json({ success: false, message: 'ID number must match the email local-part.' });
        }
      }

      // reCAPTCHA for non-test
      if (!isTest) {
        if (!captchaToken) return res.status(400).json({ success: false, message: 'Captcha is required.' });
        const secret = process.env.RECAPTCHA_SECRET_KEY;
        if (!secret) return res.status(500).json({ success: false, message: 'Captcha is not configured.' });

        const verifyResp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: captchaToken, remoteip: req.ip }),
        });
        const verifyJson = await verifyResp.json();
        if (!verifyJson.success) {
          return res.status(400).json({ success: false, message: 'Captcha verification failed.' });
        }
      }

      // Pick random activity link via util
      const activityLink = randomizeActivity(subject);

      // Persist
      await activityAssignmentsCollection.insertOne({
        email: lowerEmail,
        idNumber: String(idNumber || ''),
        subject,
        activityLink,
        createdAt: new Date(),
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
        isTest,
      });

      // Send plain text email
      const mailSubject = `Your randomized activity for ${subject}`;
      const text =
`Hello ${idNumber || 'Student'},

Here is your randomized activity for ${subject}:
${activityLink}

Good luck!
HelloGrade`;

      await sendEmail({ to: email, subject: mailSubject, text });

      return res.json({ success: true, message: 'Activity assigned and emailed.' });
    } catch (err) {
      console.error('POST /api/activity/random error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  return router;
};
