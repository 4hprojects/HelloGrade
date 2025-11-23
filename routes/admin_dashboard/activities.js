// routes/admin_dashboard/activities.js
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const mongoUri = process.env.MONGODB_URI;
let mongoClient;

async function getDb() {
    if (!mongoUri) throw new Error('MONGODB_URI not set');
    if (!mongoClient) mongoClient = new MongoClient(mongoUri);
    if (mongoClient && !mongoClient.topology) {
        await mongoClient.connect();
    }
    return mongoClient.db('myDatabase');
}

// Example admin middleware (replace with your actual implementation)
function isAdmin(req, res, next) {
    // Replace with your real admin check
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
}

/**
 * GET /api/admin_dashboard/activity_reports
 * Query params: groupNumber, activity, startDate, endDate, search
 */
router.get('/activity_reports', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');

        const { groupNumber, activity, startDate, endDate, search } = req.query;
        const query = {};

        // Filter by group number
        if (groupNumber) {
            query.groupNumber = parseInt(groupNumber);
        }

        // Filter by activity (section name in checklistSummary)
        if (activity) {
            query[`checklistSummary.${activity}`] = { $exists: true };
        }

        // Filter by date range
        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }

        // Search by member name, email, or project URL
        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        const submissions = await submissionsCollection
            .find(query)
            .sort({ submittedAt: -1 })
            .toArray();

        res.json({ submissions });
    } catch (error) {
        console.error('Error fetching activity reports:', error);
        res.status(500).json({ error: 'Failed to fetch activity reports' });
    }
});

/**
 * GET /api/admin_dashboard/activity_reports/xlsx
 * Download filtered submissions as XLSX
 */
router.get('/activity_reports/xlsx', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');
        const { groupNumber, activity, startDate, endDate, search } = req.query;
        const query = {};

        // Same filtering logic as above
        if (groupNumber) query.groupNumber = parseInt(groupNumber);
        if (activity) query[`checklistSummary.${activity}`] = { $exists: true };
        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        const submissions = await submissionsCollection.find(query).sort({ submittedAt: -1 }).toArray();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Activity Reports');

        worksheet.columns = [
            { header: 'Submission #', key: 'submissionNumber', width: 20 },
            { header: 'Group #', key: 'groupNumber', width: 10 },
            { header: 'Members', key: 'members', width: 30 },
            { header: 'Project URL', key: 'projectUrl', width: 30 },
            { header: 'Email', key: 'senderEmail', width: 25 },
            { header: 'Submitted At', key: 'submittedAt', width: 20 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Checklist Summary', key: 'checklistSummary', width: 50 }
        ];

        submissions.forEach(sub => {
            worksheet.addRow({
                submissionNumber: sub.submissionNumber,
                groupNumber: sub.groupNumber,
                members: sub.members.join(', '),
                projectUrl: sub.projectUrl,
                senderEmail: sub.senderEmail,
                submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '',
                status: sub.status,
                checklistSummary: JSON.stringify(sub.checklistSummary)
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="activity_reports.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating XLSX:', error);
        res.status(500).json({ error: 'Failed to generate XLSX' });
    }
});

/**
 * GET /api/admin_dashboard/activity_reports/pdf
 * Download filtered submissions as PDF
 */
router.get('/activity_reports/pdf', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');
        const { groupNumber, activity, startDate, endDate, search } = req.query;
        const query = {};

        // Same filtering logic as above
        if (groupNumber) query.groupNumber = parseInt(groupNumber);
        if (activity) query[`checklistSummary.${activity}`] = { $exists: true };
        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        const submissions = await submissionsCollection.find(query).sort({ submittedAt: -1 }).toArray();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="activity_reports.pdf"');

        const doc = new PDFDocument();
        doc.pipe(res);

        doc.fontSize(16).text('Activity Reports', { align: 'center' });
        doc.moveDown();

        submissions.forEach(sub => {
            doc.fontSize(10).text(`Submission #: ${sub.submissionNumber}`);
            doc.text(`Group #: ${sub.groupNumber}`);
            doc.text(`Members: ${sub.members.join(', ')}`);
            doc.text(`Project URL: ${sub.projectUrl}`);
            doc.text(`Email: ${sub.senderEmail}`);
            doc.text(`Submitted At: ${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}`);
            doc.text(`Status: ${sub.status}`);
            doc.text(`Checklist Summary: ${JSON.stringify(sub.checklistSummary)}`);
            doc.moveDown();
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Change this route path to match frontend
router.get('/activity/submissions', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');

        const { search, startDate, endDate } = req.query;
        const query = {};

        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }

        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        console.log('Querying submissions with:', query);
        const submissions = await submissionsCollection
            .find(query)
            .sort({ submittedAt: -1 })
            .toArray();

        console.log(`Found ${submissions.length} submissions`);

        res.json({ success: true, count: submissions.length, submissions: submissions || []});
    } catch (error) {
        console.error('Error fetching activity reports:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch activity reports', submissions: [] });
    }
});

router.get('/activity/submissions/xlsx', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');
        const { search, startDate, endDate } = req.query;
        const query = {};

        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        const submissions = await submissionsCollection.find(query).sort({ submittedAt: -1 }).toArray();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Activity Reports');

        worksheet.columns = [
            { header: 'Submission #', key: 'submissionNumber', width: 20 },
            { header: 'Group #', key: 'groupNumber', width: 10 },
            { header: 'Members', key: 'members', width: 30 },
            { header: 'Project URL', key: 'projectUrl', width: 30 },
            { header: 'Email', key: 'senderEmail', width: 25 },
            { header: 'Submitted At', key: 'submittedAt', width: 20 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        submissions.forEach(sub => {
            worksheet.addRow({
                submissionNumber: sub.submissionNumber,
                groupNumber: sub.groupNumber,
                members: (sub.members || []).join(', '),
                projectUrl: sub.projectUrl,
                senderEmail: sub.senderEmail,
                submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '',
                status: sub.status
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="activity_reports.xlsx"');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating XLSX:', error);
        res.status(500).json({ error: 'Failed to generate XLSX' });
    }
});

router.get('/activity/submissions/pdf', isAdmin, async (req, res) => {
    try {
        const db = await getDb();
        const submissionsCollection = db.collection('tblSubmissions');
        const { search, startDate, endDate } = req.query;
        const query = {};

        if (startDate || endDate) {
            query.submittedAt = {};
            if (startDate) query.submittedAt.$gte = new Date(startDate);
            if (endDate) query.submittedAt.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { members: { $elemMatch: { $regex: search, $options: 'i' } } },
                { senderEmail: { $regex: search, $options: 'i' } },
                { projectUrl: { $regex: search, $options: 'i' } }
            ];
        }

        const submissions = await submissionsCollection.find(query).sort({ submittedAt: -1 }).toArray();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="activity_reports.pdf"');

        const doc = new PDFDocument();
        doc.pipe(res);

        doc.fontSize(16).text('Activity Reports', { align: 'center' });
        doc.moveDown();

        submissions.forEach(sub => {
            doc.fontSize(10).text(`Submission #: ${sub.submissionNumber}`);
            doc.text(`Group #: ${sub.groupNumber}`);
            doc.text(`Members: ${(sub.members || []).join(', ')}`);
            doc.text(`Project URL: ${sub.projectUrl}`);
            doc.text(`Email: ${sub.senderEmail}`);
            doc.text(`Submitted At: ${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : ''}`);
            doc.text(`Status: ${sub.status}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

module.exports = router;