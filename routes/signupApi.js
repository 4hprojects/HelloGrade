const express = require('express');
const axios = require('axios');
const router = express.Router();

const RECAPTCHA_SECRET_KEY = process.env.SECRET_KEY;

router.post('/', async (req, res) => {
  const recaptchaToken = req.body['g-recaptcha-response'];
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token missing.' });
  }

  try {
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
    const response = await axios.post(verifyUrl);
    if (!response.data.success) {
      return res.status(400).json({ error: 'reCAPTCHA failed. Please try again.' });
    }

    // TODO: Add your signup logic here (e.g., create user, save to DB)

    res.status(200).json({ message: 'Signup successful!' });
  } catch (err) {
    res.status(500).json({ error: 'reCAPTCHA verification error.' });
  }
});

module.exports = router;
