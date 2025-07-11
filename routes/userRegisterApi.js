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
    const id = uuidv4();

    // Fetch event date and name
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('event_date, event_name')
      .eq('id', event_id)
      .maybeSingle();

    if (eventError || !eventData) {
      return res.status(400).json({ success: false, message: 'Invalid event.' });
    }

    const eventDate = eventData.event_date;
    const eventName = eventData.event_name;
    const yymmdd = eventDate.replace(/-/g, '').slice(2, 8);

    // Get the MAX attendee_no for this event
    const { data: maxData, error: maxError } = await supabase
      .from('attendees')
      .select('attendee_no')
      .eq('event_id', event_id)
      .like('attendee_no', `${yymmdd}%`)
      .order('attendee_no', { ascending: false })
      .limit(1)
      .single();

    let nextSeq = 1;
    if (!maxError && maxData?.attendee_no) {
      const lastSeq = parseInt(maxData.attendee_no.slice(-3), 10);
      nextSeq = lastSeq + 1;
    }

    // Directly use the next sequence number without duplicate checks
    const attendee_no = `${yymmdd}${String(nextSeq).padStart(3, '0')}`;

    // Insert with conflict handling
    const { data, error: insertError } = await supabase
      .from('attendees')
      .insert([{
        id,
        attendee_no,
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
      }]);

    if (insertError) {
      // Handle unique violation specifically
      if (insertError.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Duplicate registration detected. Please try again.'
        });
      }
      return res.status(400).json({ success: false, message: insertError.message });
    }

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
        <p>Thank you for registering for <strong>${eventName}</strong>.</p>
        
        <h3>Registration Details:</h3>
        <table>
            <tr><td><strong>Event:</strong></td><td>${eventName}</td></tr>
            <tr><td><strong>Date:</strong></td><td>${eventDate}</td></tr>
            <tr><td><strong>Attendee #:</strong></td><td>${attendee_no}</td></tr>
            <tr><td><strong>Confirmation Code:</strong></td><td>${confirmationCode}</td></tr>
            <tr><td><strong>Accommodation:</strong></td><td>${accommodation}${accommodationOther ? ' (' + accommodationOther + ')' : ''}</td></tr>
        </table>
        <br>
      <p>Please keep this code for your records. You may be asked to present it during event check-in.<br>
      If you have questions, contact the event organizer directly.</p>

<p>
  Sincerely,<br>
  The CRFV Event Registration Team<br>
  Event Host – <a href="https://crfv-cpu.org" target="_blank">crfv-cpu.org</a><br>
  Registration System Host – <a href="https://hellograde.online" target="_blank">hellograde.online</a>
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
