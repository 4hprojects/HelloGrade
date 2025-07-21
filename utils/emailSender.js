//emailSender.js
const { Resend } = require('resend');
const sgMail = require('@sendgrid/mail');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

const resend = new Resend(process.env.RESEND_API_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);

async function sendEmail({ to, subject, html }) {
  console.log('[EMAIL] sendEmail called for:', to);
  await client.connect();
  const db = client.db('myDatabase');
  const quotaCol = db.collection('emailQuota');
  const today = new Date().toISOString().slice(0, 10);

  let quota = await quotaCol.findOne({ _id: today });
  if (!quota) {
    quota = { _id: today, resendCount: 0, elasticCount: 0, mailersendCount: 0, sendgridCount: 0 };
    await quotaCol.insertOne(quota);
  } else {
    let needsUpdate = false;
    if (typeof quota.elasticCount !== 'number') { quota.elasticCount = 0; needsUpdate = true; }
    if (typeof quota.mailersendCount !== 'number') { quota.mailersendCount = 0; needsUpdate = true; }
    if (typeof quota.sendgridCount !== 'number') { quota.sendgridCount = 0; needsUpdate = true; }
    if (typeof quota.resendCount !== 'number') { quota.resendCount = 0; needsUpdate = true; }
    if (needsUpdate) {
      await quotaCol.updateOne(
        { _id: today },
        { $set: { resendCount: quota.resendCount, elasticCount: quota.elasticCount, mailersendCount: quota.mailersendCount, sendgridCount: quota.sendgridCount } }
      );
    }
  }

  console.log('Quota for today:', quota);

  // Reset logic - Uncomment to enable
  /*
  const resetDate = new Date('YYYY-MM-DD');
  if (new Date() >= resetDate) {
    await db.emailQuota.updateOne(
      { _id: 'YYYY-MM-DD' },
      { $set: { resendCount: 50, elasticCount: 0, sendgridCount: 0 } }
    );
    console.log('Quota reset for date:', 'YYYY-MM-DD');
  }
  */

  // 1. Try RESEND
  if (quota.resendCount < 95) {
    console.log('Trying RESEND...');
    try {
      const response = await resend.emails.send({
        from: process.env.SENDER_EMAIL_NOREPLY,
        to,
        subject,
        html,
      });
      console.log('[RESEND API RESPONSE]', response);
      if (response.error) throw new Error(response.error.error);
      await quotaCol.updateOne({ _id: today }, { $inc: { resendCount: 1 } });
      console.log(`[EMAIL] Sent via RESEND to: ${to}`);
      return { success: true, provider: 'RESEND' };
    } catch (err) {
      console.error('RESEND error:', err);
      // Fall through to Elastic Email
    }
  }

  // 2. Try ELASTIC EMAIL
  if (quota.elasticCount < 95) {
    console.log('Trying ELASTIC EMAIL...');
    try {
      const elasticRes = await axios.post(
        'https://api.elasticemail.com/v2/email/send',
        null,
        {
          params: {
            apikey: process.env.ELASTIC_API_KEY,
            from: process.env.SENDER_EMAIL_NOREPLY,
            to,
            subject,
            bodyHtml: html,
            isTransactional: true,
          },
        }
      );
      console.log('[ELASTIC EMAIL RESPONSE]', elasticRes.data);
      if (elasticRes.data.success === false) throw new Error(elasticRes.data.error || 'Elastic Email failed');
      await quotaCol.updateOne({ _id: today }, { $inc: { elasticCount: 1 } });
      console.log(`[EMAIL] Sent via ELASTIC EMAIL to: ${to}`);
      return { success: true, provider: 'ELASTIC' };
    } catch (err) {
      console.error('ELASTIC EMAIL error:', err);
      // Fall through to MailerSend
    }
  }

  // 3. Try MAILERSEND
  if (quota.mailersendCount === undefined) quota.mailersendCount = 0;
  if (quota.mailersendCount < 95) {
    console.log('Trying MAILERSEND...');
    try {
      const mailersend = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY });
      const sentFrom = new Sender(process.env.SENDER_EMAIL_NOREPLY, 'HelloGrade');
      const recipients = [new Recipient(to, '')];
      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setSubject(subject)
        .setHtml(html);

      const response = await mailersend.email.send(emailParams);
      console.log('[MAILERSEND RESPONSE]', response.body ? await response.body.text() : response);

      await quotaCol.updateOne({ _id: today }, { $inc: { mailersendCount: 1 } });
      console.log(`[EMAIL] Sent via MAILERSEND to: ${to}`);
      return { success: true, provider: 'MAILERSEND' };
    } catch (err) {
      console.error('MAILERSEND error:', err);
      // Fall through to SendGrid
    }
  }

  // 4. Try SENDGRID
  if (quota.sendgridCount < 95) {
    console.log('Trying SENDGRID...');
    try {
      await sgMail.send({ to, from: process.env.SENDER_EMAIL, subject, html });
      await quotaCol.updateOne({ _id: today }, { $inc: { sendgridCount: 1 } });
      console.log(`[EMAIL] Sent via SENDGRID to: ${to}`);
      return { success: true, provider: 'SENDGRID' };
    } catch (err) {
      console.error('SendGrid error:', err);
      return { success: false, error: err.message };
    }
  }

  // All quotas reached - reset PH time 8:00 AM - 95 resend, 95 elastic (not working), 95 sendgrid, 95 mailersend (pending verification)
  console.error('Daily email quota reached for all providers. Reset at 8:00 AM PH time.');
  return { success: false, error: 'Daily email quota reached. Please try again tomorrow.' };
}

module.exports = { sendEmail };
