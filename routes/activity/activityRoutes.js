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
        const {
            studentInfo, quizID, quiz, answers, times, score,
            totalItems, correctItems, accuracy
        } = req.body;
        if (!studentInfo || !quizID || !quiz || !answers || !times || typeof score !== 'number') {
            return res.status(400).json({ success: false, message: 'Missing required quiz fields.' });
        }
        const db = await getDb();
        const quizResultsCollection = db.collection('tblQuizResults');
        const resultDoc = {
            studentInfo,
            quizID,
            quiz,
            answers,
            times,
            score,
            totalItems,
            correctItems,
            accuracy,
            submittedAt: new Date()
        };
        await quizResultsCollection.insertOne(resultDoc);
        res.json({ success: true, message: 'Quiz results saved.' });
    } catch (error) {
        console.error('Error saving quiz results:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
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

/**
 * POST /api/activity/quiz-submit
 * Saves quiz results from quiz_take.js
 * Expects:
 * {
 *   studentInfo: { ... },
 *   quiz: { ... },
 *   answers: [ ... ],
 *   times: [ ... ],
 *   score: Number
 * }
 */
router.post('/quiz-submit', async (req, res) => {
    console.log('[DEBUG] /quiz-submit called');
    console.log('[DEBUG] Request body:', req.body);

    try {
        const { studentInfo, quiz, answers, times, score } = req.body;
        if (!studentInfo || !quiz || !Array.isArray(answers) || !Array.isArray(times) || typeof score !== 'number') {
            console.log('[DEBUG] Missing required quiz fields');
            return res.status(400).json({ success: false, message: 'Missing required quiz fields.' });
        }

        const db = await getDb();
        const quizResultsCollection = db.collection('tblQuizResults');

        const resultDoc = {
            studentInfo,
            quiz,
            answers,
            times,
            score,
            submittedAt: new Date()
        };

        console.log('[DEBUG] Inserting quiz result:', resultDoc);
        await quizResultsCollection.insertOne(resultDoc);

        const leaderboardCollection = db.collection('tblQuizLeaderboard');
        const totalTime = times.reduce((a, b) => a + b, 0);

        console.log('[DEBUG] Upserting leaderboard for:', studentInfo.idNumber, quiz.title);
        await leaderboardCollection.updateOne(
            {
                quizTitle: quiz.title,
                idNumber: studentInfo.idNumber
            },
            {
                $set: {
                    firstName: studentInfo.firstName,
                    lastName: studentInfo.lastName,
                    email: studentInfo.email,
                    score,
                    timeTaken: totalTime,
                    submittedAt: new Date()
                }
            },
            { upsert: true }
        );

        console.log('[DEBUG] Quiz results and leaderboard updated.');
        res.json({ success: true, message: 'Quiz results saved.' });
    } catch (error) {
        console.error('[ERROR] Error saving quiz results:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/**
 * GET /api/activity/quiz-leaderboard/:quizID
 * View quiz leaderboard for a specific quiz
 */
router.get('/quiz-leaderboard/:quizID', async (req, res) => {
    console.log('[DEBUG] /quiz-leaderboard called for:', req.params.quizID);

    try {
        const db = await getDb();
        const leaderboardCollection = db.collection('tblQuizLeaderboard');
        const { quizID } = req.params;

        const leaderboard = await leaderboardCollection
            .find({ quizID })
            .sort({ score: -1, timeTaken: 1 })
            .toArray();

        console.log('[DEBUG] Leaderboard data:', leaderboard);
        res.json({ success: true, leaderboard });
    } catch (error) {
        console.error('[ERROR] Error fetching leaderboard:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/**
 * POST /api/activity/check-attempt
 * Checks if a student has already attempted a quiz
 * Expects: { idNumber: String, quizTitle: String }
 */
router.post('/check-attempt', async (req, res) => {
    try {
        const { idNumber, quizID } = req.body;
        if (!idNumber || !quizID) {
            return res.status(400).json({ success: false, message: 'Missing idNumber or quizID.' });
        }
        const db = await getDb();
        const quizResultsCollection = db.collection('tblQuizResults');
        const attempt = await quizResultsCollection.findOne({
            'studentInfo.idNumber': idNumber,
            quizID
        });
        res.json({ success: true, attempted: !!attempt });
    } catch (error) {
        console.error('[ERROR] Error checking attempt:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/**
 * POST /api/activity/update-leaderboard
 * Updates or inserts a leaderboard entry for a quiz
 * Expects:
 * {
 *   studentInfo: { ... },
 *   quizTitle: String,
 *   score: Number,
 *   timeTaken: Number
 * }
 */
router.post('/update-leaderboard', async (req, res) => {
    try {
        const {
            studentInfo, quizID, score, timeTaken,
            totalItems, correctItems, accuracy
        } = req.body;
        if (!studentInfo || !quizID || typeof score !== 'number') {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        const db = await getDb();
        const leaderboardCollection = db.collection('tblQuizLeaderboard');
        await leaderboardCollection.updateOne(
            {
                quizID,
                idNumber: studentInfo.idNumber
            },
            {
                $set: {
                    firstName: studentInfo.firstName,
                    lastName: studentInfo.lastName,
                    email: studentInfo.email,
                    score,
                    timeTaken,
                    totalItems,
                    correctItems,
                    accuracy,
                    submittedAt: new Date()
                }
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/**
 * POST /api/activity/save-results
 * Saves the results of a quiz attempt, including item-level details
 * Expects:
 * {
 *   studentInfo: { ... },
 *   quiz: { ... },
 *   answers: [ ... ],
 *   times: [ ... ],
 *   score: Number,
 *   totalItems: Number,
 *   correctItems: Number,
 *   accuracy: Number
 * }
 */
router.post('/save-results', async (req, res) => {
    console.log('[DEBUG] /save-results called');
    console.log('[DEBUG] Request body:', req.body);

    try {
        const { studentInfo, quiz, answers, times, score, totalItems, correctItems, accuracy } = req.body;
        if (!studentInfo || !quiz || !Array.isArray(answers) || !Array.isArray(times) || typeof score !== 'number') {
            console.log('[DEBUG] Missing required fields for results saving');
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const db = await getDb();
        const resultsCollection = db.collection('tblResults');

        const resultDoc = {
            studentInfo,
            quiz,
            answers,
            times,
            score,
            totalItems,
            correctItems,
            accuracy,
            submittedAt: new Date()
        };

        console.log('[DEBUG] Inserting results document:', resultDoc);
        await resultsCollection.insertOne(resultDoc);

        res.json({ success: true, message: 'Results saved successfully.' });
    } catch (error) {
        console.error('[ERROR] Error saving results:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
