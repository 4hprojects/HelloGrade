//userRegisterApi.js
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
      email, contactNo, accommodation, accommodationOther, event_id,
      certificateName // <-- add this
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
        event_id,
        certificate_name: certificateName,
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
  <tr><td><strong>Name on Certificate:</strong></td><td>${certificateName}</td></tr>
</table>

<br>

<div style="border:1px solid #e0e6ed;padding:16px 18px;border-radius:8px;background:#f8fafc;margin-bottom:18px;">
  <strong>Please take note of the following reminders to ensure smooth and successful participation:</strong>

  <ul style="margin:12px 0 0 18px;padding:0;">
    <li>Full attendance in all sessions is required to receive a certificate.</li>
    <li>Attendance will be monitored and recorded for each session.</li>
    <li>Participants are expected to comply with all event guidelines and schedules.</li>
    <li><strong>The proximity card must be returned</strong> after the event, along with any other borrowed materials, as applicable. Items should be returned to the designated collection point or by prepaid mail if taken off-site.</li>
  </ul>

  <p>We appreciate your cooperation and look forward to your active participation.</p>

  <div style="margin-top:10px;">
    For full details, please review the 
    <a href="https://hellograde.online/crfv/event-agreement" target="_blank" rel="noopener">Event Participation Agreement</a>.
  </div>
</div>

<p>Keep your confirmation code for reference. You may be asked to present it during event check-in.<br>
If you have any questions, please contact the event organiser directly.</p>

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

<p style="color:#2a5298;">
  <strong>Note:</strong> Certificates are expected to be issued within 7 business days after the event, once all requirements are fulfilled. While we aim to meet this timeline, delays may occur due to factors beyond the organiser's control.
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

//console.log('SENDGRID_FROM_EMAIL:', process.env.SENDER_EMAIL);

module.exports = router;

//address of location and venue should be compelted by the event organiser
