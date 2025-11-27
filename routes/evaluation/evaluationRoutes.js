// routes/evaluation/evaluationRoutes.js
// Provides endpoints for storing evaluation forms (solo, peer) and exposing rubric data.
// Uses existing MongoDB connection passed from server.js.

// Added CSRF, rate limit, new fields, JSON response & email copy.
const express = require('express');
const validator = require('validator');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

if (process.env.SENDGRID_API_KEY) {
  try { sgMail.setApiKey(process.env.SENDGRID_API_KEY); } catch {}
}

module.exports = function evaluationRoutes(client) {
  const router = express.Router();
  const collection = () => client.db().collection('evaluations');
  const logsCollection = () => client.db().collection('logs');

  // Indexes
  collection().createIndexes([
    { key: { submissionId: 1 }, name: 'submissionId_unique', unique: true },
    {
      key: { type: 1, email: 1, projectTitle: 1, submissionMode: 1 },
      name: 'final_unique',
      unique: true,
      partialFilterExpression: { submissionMode: 'final' }
    }
  ]).catch(e=>console.error('Index error', e.message));

  // Replace single soloLimiter with dual limiters
  const draftLimiter = rateLimit({
    windowMs: 24*60*60*1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false
  });
  const finalLimiter = rateLimit({
    windowMs: 24*60*60*1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success:false, error:'Final submissions limit reached.' }
  });

  // Dynamic limiter selection
  function dynamicLimiter(req, res, next) {
    // submissionMode may not be parsed yet if body empty; treat missing as draft
    const mode = (req.body && req.body.submissionMode) || 'draft';
    return (mode === 'final' ? finalLimiter : draftLimiter)(req, res, next);
  }

  function validRating(v){
    const n = Number(v);
    return Number.isInteger(n) && n >=1 && n <=5;
  }
  function clean(text, max=500){
    if (typeof text !== 'string') return '';
    return text.trim().slice(0,max);
  }
  function jsonError(res, status, message){
    const payload = { success:false, error:message };
    if (/application\/json/i.test(res.req.headers.accept||'')) {
      return res.status(status).json(payload);
    }
    return res.status(status).send(message);
  }

  // CSRF token
  router.get('/solo/csrf', (req,res)=>{
    if (!req.session) return res.status(500).json({ error:'No session.' });
    const token = crypto.randomBytes(16).toString('hex');
    req.session.soloCsrfToken = token;
    req.session.soloCsrfTime = Date.now();
    res.json({ token });
  });

  // POST solo
  router.post('/solo', dynamicLimiter, async (req, res) => {
    try {
      const {
        name, section, groupNumber, projectTitle, projectLink, email,
        selfRating, hoursSpent, techStack,
        effort, timeManagement, completionOfRequirements, problemSolving, codeQuality, testingHabits, learningAndGrowth,
        proudMoments, hardestPart, bugSolving, teamRole, improveWithMoreTime, brokenFeatures,
        courseLessonsHelped, coursePartsConfused, skillToImprove,
        submissionMode
      } = req.body;

      // Basic required checks
      if (!submissionMode || !['draft','final'].includes(submissionMode)) {
        return jsonError(res,400,'Invalid submissionMode.');
      }
      if (!name || !section || !projectTitle || !email) {
        return jsonError(res,400,'Missing required fields.');
      }
      if (!req.session || !req.session.soloCsrfToken || req.session.soloCsrfToken !== req.body.csrfToken) {
        return jsonError(res,403,'Invalid or missing CSRF token.');
      }

      // Email normalization
      const emailNorm = (email || '').trim().toLowerCase();
      if (!validator.isEmail(emailNorm)) {
        return jsonError(res,400,'Invalid email.');
      }

      // Self rating validation
      if (!validRating(selfRating)) {
        return jsonError(res,400,'Invalid selfRating.');
      }

      // Hours spent validation (optional field)
      let hoursSpentNum = null;
      if (hoursSpent !== undefined && hoursSpent !== '') {
        const parsed = parseFloat(hoursSpent);
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 1000) {
          return jsonError(res,400,'hoursSpent out of range (0–1000).');
        }
        // keep one decimal if provided
        hoursSpentNum = Math.round(parsed * 10) / 10;
      }

      // projectLink normalization
      let normalizedLink = (projectLink || '').trim();
      if (normalizedLink) {
        const hasProtocol = /^https?:\/\//i.test(normalizedLink);
        const domainLike = /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(normalizedLink);
        if (!hasProtocol && domainLike) {
          normalizedLink = 'https://' + normalizedLink;
        }
        // rudimentary URL validation after prefix
        if (!validator.isURL(normalizedLink, { require_protocol:true })) {
          return jsonError(res,400,'Invalid projectLink URL.');
        }
      } else {
        normalizedLink = null;
      }

      // Group number numeric when possible
      let groupNumberVal = null;
      if (groupNumber !== undefined && groupNumber !== '') {
        const gNum = Number(groupNumber);
        groupNumberVal = Number.isFinite(gNum) ? gNum : clean(groupNumber,10);
      }

      // Reflection block (brokenFeatures nested)
      const reflection = {
        proudMoments: clean(proudMoments),
        hardestPart: clean(hardestPart),
        bugSolving: clean(bugSolving),
        teamRole: clean(teamRole),
        improveWithMoreTime: clean(improveWithMoreTime),
        brokenFeatures: clean(brokenFeatures)
      };

      // Statements
      const statements = {
        effort: clean(effort),
        timeManagement: clean(timeManagement),
        completionOfRequirements: clean(completionOfRequirements),
        problemSolving: clean(problemSolving),
        codeQuality: clean(codeQuality),
        testingHabits: clean(testingHabits),
        learningAndGrowth: clean(learningAndGrowth)
      };

      // Feedback
      const feedback = {
        courseLessonsHelped: clean(courseLessonsHelped),
        coursePartsConfused: clean(coursePartsConfused),
        skillToImprove: clean(skillToImprove)
      };

      const submissionId = crypto.randomUUID();
      const doc = {
        submissionId,
        type: 'solo',
        submissionMode,
        email: emailNorm,
        projectTitle: clean(projectTitle,150),
        name: clean(name,120),
        section: clean(section,50),
        groupNumber: groupNumberVal,
        projectLink: normalizedLink,
        selfRating: Number(selfRating),
        hoursSpent: hoursSpentNum,
        techStack: clean(techStack,200),
        statements,
        reflection,
        feedback,
        createdAt: new Date()
      };

      // Prevent duplicate finals via unique index
      try {
        await collection().insertOne(doc);
      } catch (e) {
        if (e.code === 11000 && submissionMode === 'final') {
          return jsonError(res,409,'Final submission already exists for this project/email.');
        }
        console.error('Insert error', e);
        return jsonError(res,500,'Database error.');
      }

      // CSRF rotation after final
      if (submissionMode === 'final') {
        req.session.soloCsrfToken = null;
      }

      async function sendWithRetry(emailDoc, attempt=1){
        const textBody = buildEmailText(emailDoc);
        const htmlBody = buildEmailHtml(emailDoc);
        try {
          await sgMail.send({
            to: emailDoc.email,
            from: process.env.SENDGRID_FROM || 'no-reply@example.com',
            subject: `Solo Evaluation Receipt - ${emailDoc.projectTitle}`,
            text: textBody,
            html: htmlBody
          });
          await logsCollection().insertOne({
            type:'emailSend',
            submissionId: emailDoc.submissionId,
            status:'success',
            attempt,
            createdAt: new Date()
          }).catch(()=>{});
        } catch (err) {
          const transient = err.code === 429 || (err.response && err.response.statusCode >=500);
          await logsCollection().insertOne({
            type:'emailSend',
            submissionId: emailDoc.submissionId,
            status:'failed',
            attempt,
            transient,
            error: err.message,
            createdAt: new Date()
          }).catch(()=>{});
          if (transient && attempt === 1) {
            setTimeout(()=>sendWithRetry(emailDoc, 2), 30000);
          }
        }
      }

      // Email sending only for final
      if (submissionMode === 'final' && sgMail) {
        sendWithRetry(doc).catch(()=>{});
      }

      const createdAtTZ = getCreatedAtTZ(doc.createdAt);
      // Build response summary
      return res.json({
        success:true,
        submissionId,
        createdAtTZ,
        submissionMode,
        name: doc.name,
        email: doc.email,
        projectTitle: doc.projectTitle,
        selfRating: doc.selfRating,
        hoursSpent: doc.hoursSpent,
        techStack: doc.techStack,
        statements: doc.statements,
        reflection: doc.reflection,
        feedback: doc.feedback
      });
    } catch (err) {
      console.error('Unhandled /solo error', err);
      return jsonError(res,500,'Internal error.');
    }
  });

  function getCreatedAtTZ(date){
    return new Date(date).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  }

  function buildEmailText(d){
    const createdAtTZ = getCreatedAtTZ(d.createdAt);
    const lines = [];
    lines.push(`Submission ID: ${d.submissionId}`);
    lines.push(`Timestamp (Asia/Manila): ${createdAtTZ}`);
    lines.push(`Name: ${d.name}`);
    lines.push(`Email: ${d.email}`);
    lines.push(`Project Title: ${d.projectTitle}`);
    lines.push(`Project Link: ${d.projectLink || ''}`);
    lines.push(`Self-Rating: ${d.selfRating}`);
    lines.push(`Hours Spent: ${d.hoursSpent ?? ''}`);
    lines.push(`Tech Stack: ${d.techStack || ''}`);
    lines.push('');
    lines.push('Statements:');
    Object.entries(d.statements || {}).forEach(([k,v])=>lines.push(` - ${k}: ${v}`));
    lines.push('Reflection:');
    const refl = d.reflection || {};
    const broken = refl.brokenFeatures || '';
    lines.push(` - Proud moments: ${refl.proudMoments || ''}`);
    lines.push(` - Hardest part: ${refl.hardestPart || ''}`);
    lines.push(` - Bug solving: ${refl.bugSolving || ''}`);
    lines.push(` - Team role: ${refl.teamRole || ''}`);
    lines.push(` - Improve with more time: ${refl.improveWithMoreTime || ''}`);
    lines.push(` - Broken / partial features: ${broken}`);
    lines.push('Course Feedback:');
    Object.entries(d.feedback || {}).forEach(([k,v])=>lines.push(` - ${k}: ${v}`));
    return lines.join('\n');
  }

  function buildEmailHtml(d){
    const esc = s => (s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
    const createdAtTZ = getCreatedAtTZ(d.createdAt);
    const listSection = (title,obj)=>`<h3 style="margin:12px 0 4px;">${esc(title)}</h3><ul style="margin:0 0 10px;padding-left:18px;">${
      Object.entries(obj || {}).map(([k,v])=>`<li><strong>${esc(k)}:</strong> ${esc(v||'')}`).join('')
    }</ul>`;
    const refl = d.reflection || {};
    const broken = refl.brokenFeatures || '';
    return `
      <h2 style="font-family:system-ui,Arial,sans-serif;">Solo Evaluation Received</h2>
      <p style="font-family:system-ui,Arial,sans-serif;">
        <strong>Submission ID:</strong> ${esc(d.submissionId)}<br>
        <strong>Timestamp (Asia/Manila):</strong> ${esc(createdAtTZ)}<br>
        <strong>Name:</strong> ${esc(d.name)}<br>
        <strong>Email:</strong> ${esc(d.email)}<br>
        <strong>Project Title:</strong> ${esc(d.projectTitle)}<br>
        <strong>Project Link:</strong> ${esc(d.projectLink || '')}<br>
        <strong>Self-Rating:</strong> ${esc(String(d.selfRating))}<br>
        <strong>Hours Spent:</strong> ${esc(d.hoursSpent == null ? '' : String(d.hoursSpent))}<br>
        <strong>Tech Stack:</strong> ${esc(d.techStack || '')}
      </p>
      ${listSection('Statements', d.statements)}
      ${listSection('Reflection', {
        proudMoments: refl.proudMoments,
        hardestPart: refl.hardestPart,
        bugSolving: refl.bugSolving,
        teamRole: refl.teamRole,
        improveWithMoreTime: refl.improveWithMoreTime,
        brokenFeatures: broken
      })}
      ${listSection('Course Feedback', d.feedback)}
    `;
  }

  return router;
};
