require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// 1) Set your SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 2) Reusable HTML snippet for the email body
function getEmailBody() {
  return `
    <h2 style="color: #007bff;">Event Details</h2>
    <ul>
      <li><strong>Event Name:</strong> IT Quiz Bee 2025</li>
      <li><strong>Date & Time:</strong> Thursday, February 20, 2025 | 1:00 PM – 3:00 PM</li>
      <li><strong>Venue:</strong> CIS 303, College of Information Sciences</li>
      <li><strong>Eligibility:</strong> Open to all non-IT students currently enrolled in <strong>Benguet State University</strong>.</li>
      <li><strong>Maximum Participants:</strong> 40 Contestants</li>
      <li><strong>Registration:</strong> Online pre-registration is required.</li>
      <li><strong>Prizes & Certificates:</strong> Certificate of Participation for all; top scorers receive awards!</li>
    </ul>

    <h2 style="color: #007bff;">Event Rules & Contingency Plan</h2>
    <h3>General Rules</h3>
    <ul>
      <li>Must bring a valid school ID for verification.</li>
      <li>Arrive before 1:00 PM for check-in.</li>
      <li>Quiz will be conducted on Kahoot!; ensure your device is ready.</li>
      <li>No cheating or disruptive behavior.</li>
      <li>Event organizers’ decisions are final.</li>
    </ul>
    <h3>Contingency Plan</h3>
    <ul>
      <li><strong>Disconnects:</strong> Reconnect and continue the quiz.</li>
      <li><strong>Device failure:</strong> Bring fully charged device + power banks.</li>
      <li><strong>Wi-Fi issues:</strong> Use backup internet if available.</li>
      <li><strong>System hiccups:</strong> Quiz will pause briefly if needed.</li>
    </ul>
    <h3>Code of Conduct</h3>
    <ul>
      <li>Maintain professionalism and sportsmanship.</li>
      <li>No disruptive behavior (e.g., shouting).</li>
      <li>Cheating or misrepresentation leads to disqualification.</li>
    </ul>
    <p><em>Thank you for registering! We look forward to seeing you at the event.</em></p>
  `;
}

// 3) Function to send the registration email
async function sendRegistrationEmail(userEmail, userName) {
  try {
    const message = {
      to: userEmail,
      from: process.env.SENDER_EMAIL, // must be verified in SendGrid
      subject: 'IT Quiz Bee 2025 Registration Confirmation',
      html: `
        <h1 style="color: #007bff;">Hello, ${userName}!</h1>
        <p>We’re excited to confirm your registration for the <strong>IT Quiz Bee 2025</strong>.</p>
        ${getEmailBody()}
      `
    };

    await sgMail.send(message);

    console.log(`Email sent to ${userEmail}`);
  } catch (error) {
    console.error(`Error sending email to ${userEmail}:`, error);
    throw new Error('Failed to send registration email.');
  }
}

module.exports = {
  sendRegistrationEmail
};
