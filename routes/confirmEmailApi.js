const express = require('express');
const router = express.Router();
const { getUsersCollection } = require('../utils/db');

router.get('/:token', async (req, res) => {
  const { token } = req.params;
  const usersCollection = await getUsersCollection();
  const user = await usersCollection.findOne({ emailConfirmationToken: token });

  if (!user) {
    return res.send(`
      <h2>Invalid or expired link</h2>
      <p>Your confirmation link is invalid or has already been used.</p>
      <a href="/resend-confirmation?email=">Resend verification email</a>
    `);
  }

  if (user.emailConfirmed) {
    return res.send(`
      <h2>Email already confirmed</h2>
      <p>Your email is already confirmed. You can <a href="/login">log in</a>.</p>
    `);
  }

  if (user.emailConfirmationExpires < new Date()) {
    return res.send(`
      <h2>Link expired</h2>
      <p>Your confirmation link has expired.</p>
      <a href="/resend-confirmation?email=${encodeURIComponent(user.emaildb)}">Resend verification email</a>
    `);
  }

  // Mark email as confirmed
  await usersCollection.updateOne(
    { _id: user._id },
    { $set: { emailConfirmed: true }, $unset: { emailConfirmationToken: "", emailConfirmationExpires: "" } }
  );

  return res.send(`
    <h2>Email confirmed!</h2>
    <p>Your email has been confirmed. You can now <a href="/login">log in</a>.</p>
  `);
});

module.exports = router;