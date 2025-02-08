// sheetsService.js
require('dotenv').config();
const { google } = require("googleapis");
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * Adds a new registration entry to the Google Sheet AND sends a confirmation email.
 * @param {Object} formData - User registration details
 * @returns {Promise<string>}
 */
async function addEntryToSheet(formData) {
  try {
    const { firstName, lastName, yearLevel, email, college, degree, signature } = formData;

    // 1) Append data to Google Sheet
    const values = [[firstName, lastName, yearLevel, email, college, degree, signature, new Date().toLocaleString()]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID_2025BYTeFunRun,
      range: "ITQuizBee2025!A2",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    // 2) Send Confirmation Email
    await sendRegistrationEmail(email, `${firstName} ${lastName}`);

    return "✅ Registration Successful!";

  } catch (error) {
    console.error("Google Sheets Error:", error);
    throw new Error("❌ Failed to save registration data or send email.");
  }
}

/**
 * Sends a confirmation email to the user after registration is successful.
 * @param {string} userEmail
 * @param {string} userName
 */
async function sendRegistrationEmail(userEmail, userName) {
  const message = {
    to: userEmail,
    from: process.env.SENDER_EMAIL, // must be a verified sender in SendGrid
    subject: 'IT Quiz Bee 2025 Registration Confirmation',
    html: `
      <h1 style="color: #007bff;">Hello, ${userName}!</h1>
      <p>We’re excited to confirm your registration for the <strong>IT Quiz Bee 2025</strong>.</p>

      <h2 style="color: #007bff;">Event Details</h2>
      <ul>
        <li><strong>Date & Time:</strong> Thursday, February 20, 2025 | 1:00 PM – 3:00 PM</li>
        <li><strong>Venue:</strong> CIS 303, College of Information Sciences</li>
        <li><strong>Bring:</strong> Valid school ID, a fully charged device, and a readiness to compete!</li>
      </ul>

            <h2>Event Rules & Contingency Plan</h2>

            <h3>General Rules</h3>
            <ul>
                <li>All participants must be currently enrolled students and must bring their school ID for verification.</li>
                <li>Participants must check in before 1:00 PM to confirm their registration and set up their devices.</li>
                <li>The quiz will be conducted using <strong>Kahoot!</strong>. Each participant must ensure their device is ready before the quiz starts.</li>
                <li>Participants should refrain from engaging in any form of cheating or disruptive behavior.</li>
                <li>Decisions made by the quiz marshals and event organizers are final.</li>
            </ul>

            <h3>Technical Requirements</h3>
            <ul>
                <li>Participants must bring their own device (phone, laptop, or tablet).</li>
                <li>Wi-Fi will be provided, but participants may bring a backup internet connection.</li>
                <li>Devices must be fully charged before the event, and participants may bring power banks.</li>
            </ul>

            <h3>Scoring and Ranking</h3>
            <ul>
                <li>Each question in Kahoot! has a corresponding point value.</li>
                <li>Scores are calculated based on accuracy and response speed.</li>
                <li>The participant with the highest total score at the end of the quiz will be declared the winner.</li>
                <li>In case of a tie, a tie-breaker question will be given.</li>
            </ul>

            <h3>Contingency Plan</h3>
            <p>If any technical or connectivity issues arise during the event, the following contingency measures will be applied:</p>

            <table class="contingency-table">
                <thead>
                    <tr>
                        <th>Issue</th>
                        <th>Resolution</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Participant disconnects during the quiz</td>
                        <td>They may reconnect and continue the quiz. Kahoot! will consolidate their score upon rejoining.</td>
                    </tr>
                    <tr>
                        <td>Device failure or battery drain</td>
                        <td>Participants should ensure their devices are fully charged and may bring power banks.</td>
                    </tr>
                    <tr>
                        <td>Wi-Fi or network disruption</td>
                        <td>Wi-Fi is provided, but participants may use their backup internet if needed.</td>
                    </tr>
                    <tr>
                        <td>Unexpected Kahoot! system issue</td>
                        <td>The quiz will pause briefly while the issue is addressed. If needed, a new session will be initiated.</td>
                    </tr>
                </tbody>
            </table>

            <h3>Code of Conduct</h3>
            <ul>
                <li>Participants must maintain professionalism and sportsmanship throughout the event.</li>
                <li>Disruptive behavior, such as shouting or distracting others, will not be tolerated.</li>
                <li>Any form of cheating or misrepresentation will result in immediate disqualification.</li>
            </ul>

            <p class="final-note"><strong>Note:</strong> The event organizers reserve the right to make adjustments to the rules as necessary. Any changes will be communicated before the quiz starts.</p>
        </section>

<p><em>Thank you for registering! Get ready to test your IT knowledge and compete for the top spot.</em></p>
<p>We look forward to seeing you at the <strong>IT Quiz Bee 2025</strong>! 🎓🏆</p>

<br>

<p><strong>Stay Connected with BYTe!</strong></p>
<p>Follow us for updates, event highlights, and more:</p>
<p>📢 <a href="https://www.facebook.com/bsu.iit.byte" target="_blank">BYTe Organization on Facebook</a></p>

<br>

<p><strong>Expand Your Learning with HelloGrade!</strong></p>
<p>📚 Explore helpful academic resources and stay ahead in your studies:</p>
<p>🌐 <a href="https://www.hellograde.online" target="_blank">Visit HelloGrade Online</a></p>

<br>

<p>See you soon, and may the best mind win! 🚀</p>

      `,
  };

  try {
    await sgMail.send(message);
    console.log(`Email sent to ${userEmail}`);
  } catch (err) {
    console.error(`Error sending email:`, err);
    throw new Error(`Failed to send confirmation email to ${userEmail}`);
  }
}

module.exports = { addEntryToSheet };
