const express = require('express');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailSender');
const { getUsersCollection } = require('../utils/db');
const router = express.Router();

router.get('/', async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.send('<h2>Email required</h2><p>Please provide your email to resend the confirmation link.</p>');
  }

  const usersCollection = await getUsersCollection();
  const user = await usersCollection.findOne({ emaildb: email });

  if (!user) {
    return res.send('<h2>User not found</h2><p>No account found with that email.</p>');
  }
  if (user.emailConfirmed) {
    return res.send('<h2>Email already confirmed</h2><p>Your email is already confirmed. <a href="/login">Log in</a></p>');
  }

  // Generate new token and expiry
  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const confirmationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await usersCollection.updateOne(
    { _id: user._id },
    { $set: { emailConfirmationToken: confirmationToken, emailConfirmationExpires: confirmationExpires } }
  );

  // Send confirmation email
  const confirmationLink = `https://hellograde.online/confirm-email/${confirmationToken}`;
  const emailHtml = `
    <p>Hi ${user.firstName},</p>
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
      to: user.emaildb,
      subject: 'Confirm your HelloGrade account',
      html: emailHtml
    });
  } catch (err) {
    console.error('Failed to send confirmation email:', err);
    return res.send('<h2>Error</h2><p>Failed to send confirmation email. Please try again later.</p>');
  }

  return res.send('<h2>Confirmation Sent</h2><p>A new confirmation email has been sent. Please check your inbox.</p>');
});

module.exports = router;