//routes/activity/activityRoutes.js
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const { sendEmail } = require('../../utils/emailSender');

const mongoUri = process.env.MONGODB_URI;
let mongoClient;

async function getDb() {
    if (!mongoUri) throw new Error('MONGODB_URI not set');
    if (!mongoClient) mongoClient = new MongoClient(mongoUri);
    // Check connection
    if (mongoClient && !mongoClient.topology) {
        await mongoClient.connect();
    }
    return mongoClient.db('myDatabase');
}

/**
 * POST /api/activity/submit
 * Handles project submission from ws2checklist.html
 * 
 * Body expects:
 * {
 *   groupNumber: number,
 *   members: string[],
 *   projectUrl: string,
 *   senderEmail: string,
 *   checklistSummary: { sectionName: { taskName: boolean, ... }, ... }
 * }
 */
router.post('/submit', async (req, res) => {
    try {
        const { groupNumber, members, projectUrl, senderEmail, checklistSummary } = req.body;

        // ============ VALIDATION ============
        if (!groupNumber || !members || !Array.isArray(members) || members.length === 0 || !projectUrl || !senderEmail) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required and members must be a non-empty array.'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(senderEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format.'
            });
        }

        // Validate URL format
        try {
            new URL(projectUrl);
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'Invalid project URL.'
            });
        }

        // ============ DATABASE SETUP ============
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');
        const emailQuotaCollection = db.collection('emailQuota');

        // Generate submission reference number
        const submissionNumber = `SUB-${Date.now()}`;

        // ============ SAVE SUBMISSION & CHECKLIST TO DATABASE ============
        const submissionDoc = {
            submissionNumber,
            groupNumber: parseInt(groupNumber),
            members,
            projectUrl,
            senderEmail,
            checklistSummary: checklistSummary || {},
            submittedAt: new Date(),
            status: 'submitted'
        };

        await submissionsCollection.insertOne(submissionDoc);

        // Enhanced console log with collection name
        console.log(`✅ Submission saved to database`);
        console.log(`   Collection: tblSubmissions`);
        console.log(`   Reference: ${submissionNumber}`);
        console.log(`   Group: ${groupNumber}`);
        console.log(`   Members: ${members.join(', ')}`);

        // ============ SEND EMAIL TO STUDENT ============
        try {
            const studentEmailContent = `
                <p>Dear Group ${groupNumber},</p>
                <p>Thank you for submitting your WebSys2 Mini E-Commerce final project!</p>
                
                <h3>Submission Details:</h3>
                <ul>
                    <li><strong>Group Number:</strong> ${groupNumber}</li>
                    <li><strong>Members:</strong> ${members.join(', ')}</li>
                    <li><strong>Project URL:</strong> <a href="${projectUrl}" target="_blank">${projectUrl}</a></li>
                    <li><strong>Submission Reference:</strong> ${submissionNumber}</li>
                    <li><strong>Submitted At:</strong> ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</li>
                </ul>

                <h3>Checklist Summary:</h3>
                <p>Your completed checklist items will be reviewed by instructors.</p>

                <p><strong>Keep this reference number for your records:</strong> ${submissionNumber}</p>
                <p>Your project submission has been received and will be reviewed by the instructors.</p>

                <p>Best regards,<br/>HelloGrade Team</p>
            `;

            const studentEmailResult = await sendEmail({
                to: senderEmail,  // ← EMAIL SENT TO STUDENT
                subject: `[${submissionNumber}] WebSys2 Project Submission Confirmation`,
                html: studentEmailContent
            });

            if (studentEmailResult.success) {
                console.log(`✅ Confirmation email sent to student: ${senderEmail}`);
                // Track email in quota
                await trackEmailQuota(emailQuotaCollection, studentEmailResult.provider);
            } else {
                console.error('⚠️ Student email sending failed:', studentEmailResult.error);
                // Don't fail the submission if email fails
            }
        } catch (emailError) {
            console.error('⚠️ Error sending student email:', emailError);
            // Don't fail the submission if email fails
        }

        // ============ SEND NOTIFICATION EMAIL TO ADMIN ============
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'henson.sagorsor@e.ubaguio.edu';
            
            // Calculate completed tasks
            const checklistStats = calculateChecklistStats(checklistSummary);

            const adminEmailContent = `
                <p>A new WebSys2 project submission has been received:</p>
                
                <h3>Submission Information:</h3>
                <ul>
                    <li><strong>Reference Number:</strong> ${submissionNumber}</li>
                    <li><strong>Group Number:</strong> ${groupNumber}</li>
                    <li><strong>Members:</strong> ${members.join(', ')}</li>
                    <li><strong>Project URL:</strong> <a href="${projectUrl}" target="_blank">${projectUrl}</a></li>
                    <li><strong>Student Email:</strong> ${senderEmail}</li>
                    <li><strong>Submitted At:</strong> ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</li>
                </ul>

                <h3>Checklist Completion:</h3>
                <ul>
                    <li><strong>Core Tasks Completed:</strong> ${checklistStats.coreCompleted} / ${checklistStats.coreTotal}</li>
                    <li><strong>Bonus Tasks Completed:</strong> ${checklistStats.bonusCompleted} / ${checklistStats.bonusTotal}</li>
                    <li><strong>Overall Progress:</strong> ${checklistStats.overallPercent}%</li>
                </ul>

                <p><a href="${projectUrl}" target="_blank">View Project</a></p>
            `;

            const adminEmailResult = await sendEmail({
                to: adminEmail,  // ← EMAIL SENT TO ADMIN
                subject: `[${submissionNumber}] New WebSys2 Submission - Group ${groupNumber}`,
                html: adminEmailContent
            });

            if (adminEmailResult.success) {
                console.log(`✅ Notification email sent to admin: ${adminEmail}`);
                // Track email in quota
                await trackEmailQuota(emailQuotaCollection, adminEmailResult.provider);
            } else {
                console.error('⚠️ Admin email sending failed:', adminEmailResult.error);
            }
        } catch (emailError) {
            console.error('⚠️ Error sending admin email:', emailError);
        }

        // ============ RESPONSE ============
        return res.status(200).json({
            success: true,
            submissionNumber,
            message: 'Project submission received successfully!'
        });

    } catch (error) {
        console.error('Error in /api/activity/submit:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during submission.'
        });
    }
});

/**
 * Helper function to calculate checklist statistics
 */
function calculateChecklistStats(checklistSummary) {
    let coreTotal = 0;
    let coreCompleted = 0;
    let bonusTotal = 0;
    let bonusCompleted = 0;

    if (!checklistSummary || typeof checklistSummary !== 'object') {
        return {
            coreTotal: 0,
            coreCompleted: 0,
            bonusTotal: 0,
            bonusCompleted: 0,
            overallPercent: 0
        };
    }

    // Iterate through all sections
    for (const [sectionName, tasks] of Object.entries(checklistSummary)) {
        if (typeof tasks === 'object' && tasks !== null) {
            // Iterate through tasks in this section
            for (const [taskName, isCompleted] of Object.entries(tasks)) {
                // Determine if bonus or core based on naming convention
                // You can adjust this logic based on your checklist structure
                if (sectionName.toLowerCase().includes('bonus') || taskName.toLowerCase().includes('bonus')) {
                    bonusTotal++;
                    if (isCompleted) bonusCompleted++;
                } else {
                    coreTotal++;
                    if (isCompleted) coreCompleted++;
                }
            }
        }
    }

    const totalTasks = coreTotal + bonusTotal;
    const totalCompleted = coreCompleted + bonusCompleted;
    const overallPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    return {
        coreTotal,
        coreCompleted,
        bonusTotal,
        bonusCompleted,
        overallPercent
    };
}

/**
 * Helper function to track email quota
 */
async function trackEmailQuota(emailQuotaCollection, provider) {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dayKey = `email_quota_${today}`;

        await emailQuotaCollection.updateOne(
            { _id: dayKey },
            {
                $inc: {
                    [provider.toLowerCase()]: 1,
                    total: 1
                },
                $set: {
                    date: today,
                    lastUpdated: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`✅ Email quota tracked for ${provider}`);
    } catch (err) {
        console.error('⚠️ Error tracking email quota:', err);
        // Don't throw - this is non-critical
    }
}

/**
 * GET /api/activity/submissions
 * Admin only - view all submissions
 */
router.get('/submissions', async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');

        const submissions = await submissionsCollection
            .find({})
            .sort({ submittedAt: -1 })
            .toArray();

        return res.json({
            success: true,
            count: submissions.length,
            submissions
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch submissions.'
        });
    }
});

/**
 * GET /api/activity/submissions/:submissionNumber
 * View specific submission details
 */
router.get('/submissions/:submissionNumber', async (req, res) => {
    try {
        const { submissionNumber } = req.params;
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');

        const submission = await submissionsCollection.findOne({ submissionNumber });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found.'
            });
        }

        return res.json({
            success: true,
            submission
        });
    } catch (error) {
        console.error('Error fetching submission:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch submission.'
        });
    }
});

module.exports = router;
