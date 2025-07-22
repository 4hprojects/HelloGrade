const express = require('express');
const axios = require('axios');
const bcrypt = require('bcrypt');
const validator = require('validator');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailSender');
const router = express.Router();

const RECAPTCHA_SECRET_KEY = process.env.SECRET_KEY;
const { getUsersCollection } = require('../utils/db');

router.post('/', async (req, res) => {
  const isDev = process.env.NODE_ENV === 'development' || process.env.DISABLE_CAPTCHA === 'true';
  const {
    firstName, lastName, email, password, confirmPassword, studentIDNumber, termsCheckbox, 'g-recaptcha-response': recaptchaToken
  } = req.body;

  // 1. reCAPTCHA check (skip in dev)
  if (!isDev) {
    if (!recaptchaToken) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA token missing.' });
    }
    try {
      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
      const response = await axios.post(verifyUrl);
      if (!response.data.success) {
        return res.status(400).json({ success: false, message: 'reCAPTCHA failed. Please try again.' });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: 'reCAPTCHA verification error.' });
    }
  }

  // 2. Input validation
  if (!firstName || !lastName || !email || !password || !confirmPassword || !studentIDNumber || !termsCheckbox) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }
  if (!validator.isEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format.' });
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/.test(password)) {
    return res.status(400).json({ success: false, message: 'Password must meet all criteria.' });
  }
  if (!/^\d{1,7}$/.test(studentIDNumber)) {
    return res.status(400).json({ success: false, message: 'Student ID must be a number with up to 7 digits.' });
  }

  // 3. Check for existing user
  const usersCollection = await getUsersCollection();
  const existingEmail = await usersCollection.findOne({ emaildb: email });
  if (existingEmail) {
    return res.status(400).json({ success: false, message: 'The email is already registered.' });
  }
  const existingStudentID = await usersCollection.findOne({ studentIDNumber });
  if (existingStudentID) {
    return res.status(400).json({ success: false, message: 'Student ID already exists.' });
  }

  // 4. Hash password and create user with confirmation fields
  const hashedPassword = await bcrypt.hash(password, 10);
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const confirmationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const newUser = {
    firstName,
    lastName,
    emaildb: email,
    password: hashedPassword,
    createdAt: new Date(),
    invalidLoginAttempts: 0,
    accountLockedUntil: null,
    invalidResetAttempts: 0,
    accountDisabled: false,
    role: "student",
    studentIDNumber,
    emailConfirmed: false,
    emailConfirmationToken: confirmationToken,
    emailConfirmationExpires: confirmationExpires
  };
  const insertResult = await usersCollection.insertOne(newUser);

  if (insertResult.acknowledged) {
    // Send confirmation email
    const confirmationLink = `https://hellograde.online/confirm-email/${confirmationToken}`;
    const emailHtml = `
      <p>Hi ${firstName},</p>
      <p>Thank you for signing up for <b>HelloGrade</b>!</p>
      <p>Please confirm your email address by clicking the button below:</p>
      <p>
        <a href="${confirmationLink}" style="background:#2563eb;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Confirm Email</a>
      </p>
      <p>This link will expire in 7 days.</p>
      <p>If you did not sign up, you can ignore this email.</p>
      <p>Best regards,<br>The HelloGrade Team</p>
    `;
    try {
      await sendEmail({
        to: email,
        subject: 'Confirm your HelloGrade account',
        html: emailHtml
      });
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
      // Don't block signup, but inform user to contact support if needed
    }
    return res.json({ success: true, message: 'Account created! Please check your email to confirm your account.' });
  } else {
    return res.status(500).json({ success: false, message: 'Failed to create account.' });
  }
});

module.exports = router;