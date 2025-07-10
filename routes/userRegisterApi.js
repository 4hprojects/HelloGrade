const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { v4: uuidv4 } = require('uuid');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

router.post('/user-register', async (req, res) => {
  try {
    const {
      firstName, middleName, lastName, gender, designation, organization,
      email, contactNo, accommodation, accommodationOther, event_id
    } = req.body;

    // Generate confirmation code
    const confirmationCode = uuidv4().split('-')[0].toUpperCase();
    const id = uuidv4(); // Generate a unique ID

    // Insert into Supabase
    const { data, error } = await supabase
      .from('attendees')
      .insert([{
        id,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        gender,
        designation,
        organization,
        email,
        contact_no: contactNo,
        accommodation,
        accommodation_other: accommodationOther,
        confirmation_code: confirmationCode,
        event_id
      }])
      .select()
      .maybeSingle();

    if (error) return res.status(400).json({ success: false, message: error.message });

    // Send confirmation email if email is provided
    if (email) {
      const msg = {
        to: email,
        from: {
          email: process.env.SENDER_EMAIL,
          name: "CRFV Events"
        },
        subject: 'CRFV Event Registration Confirmation',
        html: `
          <p>Dear ${firstName} ${lastName},</p>
          <p>Thank you for registering for <strong>CRFV Event</strong>.</p>
          <p>Your registration has been received and is being processed.</p>
          <p>
            <strong>Your confirmation code:</strong>
            <span style="font-size:1.2em;color:#1976d2;">${confirmationCode}</span>
          </p>
          <p>
            Please keep this code for your records. You may be asked to present it during event check-in.<br>
            If you have questions, reply to this email or contact the event organizer.
          </p>
          <hr>
          <p style="font-size:0.95em;color:#888;">
            By registering, you agree to our <a href="https://hellograde.online/crfv/privacy-policy.html" target="_blank">Data Privacy Policy</a>.
          </p>
          <p style="font-size:0.95em;color:#888;">
            This is an automated message. Please do not reply directly to this email.
          </p>
        `
      };
      await sgMail.send(msg);
    }

    res.json({
      success: true,
      confirmationCode,
      message: 'Registration successful! Please check your email for your confirmation code.'
    });
  } catch (err) {
    if (err.response && err.response.body && err.response.body.errors) {
      console.error('SendGrid error:', err.response.body.errors);
    } else {
      console.error('Registration error:', err);
    }
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

console.log('SENDGRID_FROM_EMAIL:', process.env.SENDER_EMAIL);

module.exports = router;