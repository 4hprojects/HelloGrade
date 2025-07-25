//server.js
require('dotenv').config();
const express = require('express');

const { MongoClient } = require('mongodb');
const sgMail = require('@sendgrid/mail');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch'); 
const Filter = require('bad-words');
const filter = new Filter();

const helmet = require('helmet');
const validator = require('validator');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 


const fs = require('fs');
const csv = require('csv-parser'); // Ensure csv-parser is installed

const path = require('path');
const ExcelJS = require('exceljs');



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
const { ObjectId } = require('mongodb');

const { google } = require('googleapis');



const attendanceApi = require('./routes/attendanceApi');
const registerApi = require('./routes/registerApi');
const eventsApi = require('./routes/eventsApi');
const bulkRegisterApi = require('./routes/bulkRegisterApi');
const userRegisterApi = require('./routes/userRegisterApi');
const reportsApi = require('./routes/reportsApi');
const paymentReportsApi = require('./routes/paymentsReportsApi');
const attendanceSummaryApi = require('./routes/attendanceSummaryApi');
const emailApi = require('./routes/emailApi');
const { sendEmail } = require('./utils/emailSender');
const signupApi = require('./routes/signupApi');
const confirmEmailApi = require('./routes/confirmEmailApi');
const resendConfirmationApi = require('./routes/resendConfirmationApi');
const paymentsReportApi = require('./routes/paymentsReportsApi');

app.use('/api/payments-report', paymentsReportApi);
app.use('/resend-confirmation', resendConfirmationApi);
app.use('/confirm-email', confirmEmailApi);
app.use('/signup', signupApi);
// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');
//app.use(eventsApi);

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
// Initialize tblLogs collection
let usersCollection;
let gradesCollection;
let logsCollection;
let commentsCollection;
let blogCollection;
let quizzesCollection;
let attemptsCollection;
let classesCollection;
let countersCollection;

// Session management with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: {
        secure: false, // update to true for production Set to true only if using HTTPS
        httpOnly: true,
       // domain: '.hellograde.online', // add on production
        sameSite: 'lax', // update to 'None' for production Adjust sameSite setting for better compatibility
        maxAge: 1 * 60 * 60 * 1000 // 2 hours
    },
   // store: new (require('connect-pg-simple')(session))() // include in production
}));

app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    req.user = {
      userId: req.session.userId,
      role: req.session.role
    };
  }
  next();
});

app.use('/api', emailApi);
app.use('/api', userRegisterApi);
app.use('/api/bulk-register', bulkRegisterApi);
app.use('/api/events', eventsApi);
app.use('/api/attendees', registerApi); // for check-rfid and latest
app.use('/api/register', registerApi);  // for POST registration
app.use('/api/attendance', attendanceApi);
app.use('/api', reportsApi);
app.use('/api', paymentReportsApi);
app.use('/api/attendance-summary', attendanceSummaryApi);

app.use(express.static(path.join(__dirname, "public")));

// Call the database connection function
connectToDatabase()
  .then(() => {
    console.log("DB connected, now attach routes.");

    // Attach admin routes
    const adminUsersRoutes = require('./routes/adminUsersRoutes');
    app.use('/api/admin/users', adminUsersRoutes(usersCollection, isAuthenticated, isAdmin));

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  });


// Place all route definitions here



app.get('/api/config', (req, res) => {
    res.json({
        apiKey: process.env.GOOGLE_API_KEY,
        spreadsheetIdAtt: process.env.GOOGLE_SPREADSHEET_ID_ATTENDANCE,
        spreadsheetIdCSMST2025: process.env.GOOGLE_SPREADSHEET_ID_ATTENDANCE,
    });
});

const serviceAccount = {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_UNIVERSE_DOMAIN
};



// Import the new route file
const studentEthnicityRoutes = require('./routes/studentEthnicityRoutes');
// Mount it
app.use('/api/student-ethnicity', studentEthnicityRoutes);




//-----------------------------------------------------------------
// BYTe Fun Run 2025: Sign-Up POST Route
//-----------------------------------------------------------------
app.post('/api/bytefunrun2025', async (req, res) => {
    try {
        // 1) Collect the fields from request body:
        const {
            distance,                  // "3k" or "5k"
            email,                     // email
            firstName,
            lastName,
            age,
            gender,
            emergencyContactName,
            emergencyContactNumber,
            organization,             // "BYTe", "Guest", or "others"
            otherOrganization,        // if org === "others"
            signature                 // digital signature
        } = req.body;

        // 2) Handle "others"
        let finalOrganization = organization;
        if (organization === 'others' && otherOrganization) {
            finalOrganization = otherOrganization;
        }

        // 3) Append to Google Sheets
        //    You need a valid auth client with write permission:
        const path = require('path');
        // ...
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
          });
        
        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        // The tab name is "MasterList" in your .env details.
        // The Sheet ID is "1OKY2K73Ya73o9NWe_Rtr36jO267CWLMhxeuLrde0b80".
        const SPREADSHEET_ID = '1OKY2K73Ya73o9NWe_Rtr36jO267CWLMhxeuLrde0b80';
        const SHEET_NAME      = 'MasterList';

        // Prepare row data
        const now = new Date().toLocaleString(); // or store as ISO
        const row = [
            distance,
            email,
            firstName,
            lastName,
            age,
            gender,
            emergencyContactName,
            emergencyContactNumber,
            finalOrganization,
            signature,      // digital signature
            now             // submission time
        ];

        // Append data
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'MasterList',            // e.g. "MasterList"
            valueInputOption: 'USER_ENTERED',
            resource: { values: [ row ] },
        });

        // 4) (Optional) Send a SendGrid Confirmation Email
        if (email && process.env.SENDER_EMAIL) {
            const msg = {
                to: email,
                from: process.env.SENDER_EMAIL,
                subject: 'BYTe Fun Run 2025 Sign-Up Confirmation',
                html: `
                    <p>Hi ${firstName},</p>
                    <p>Thank you for signing up for the <strong>BYTe Fun Run 2025</strong>. 
                    We have received your registration!</p>

                    <p>We look forward to seeing you at the event!</p>

                    <h2>2025 BYTe Fun Run Race Details</h2>
                    <ul>
                        <li><strong>Event Time:</strong> 28th February 2025 (Friday) - 5:00 am to 7:00 am</li>
                        <li><strong>Event Address:</strong> CIS Building - Benguet State University</li>
                        <li><strong>Gun Start:</strong> 5:50 am (5k) and 6:00 am (3k)</li>
                    </ul>

                    <h3>Claiming of Race Bib:</h3>
                    <ul>
                        <li><strong>Location:</strong> CIS Building - BYTE Office (First Floor)</li>
                        <li><strong>(Thu) 27th February:</strong> 3:00 pm to 5:00 pm</li>
                        <li><strong>(Fri) 28th February:</strong> 5:00 am to 5:30 am</li>
                    </ul>

                    <p>Check <a href="https://www.hellograde.online/events/2025bytefunruninfo" target="_blank">this page</a> for additional details.</p>

                    <p>Best Regards,<br>BYTe Team</p>


                `,
            };
            await sgMail.send(msg);
        }

        // 5) Respond back to the frontend
        return res.status(200).json({
            success: true,
            message: 'Fun Run sign-up submitted successfully!',
        });
    } catch (err) {
        console.error('Error in /api/bytefunrun2025 sign-up:', err);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while submitting your sign-up.',
        });
    }
});

// Middleware for parsing JSON
app.use(express.json());

//-----register IT Quiz----
        const { addEntryToSheet } = require("./routes/sheetsService");
        // Serve static files from public directory
        app.use(express.static(path.join(__dirname, "public")));

        // Route for handling registration
        app.post("/submit", async (req, res) => {
            try {
                const response = await addEntryToSheet(req.body);
                res.json({ message: response });
            } catch (error) {
                console.error("Error:", error);
                res.status(500).json({ message: "❌ Registration failed. Please try again." });
            }
        });
///---until here--



const { fetchClassSectionFromMasterList, fetchClassRecordFromSheet } = require('./utils/googleSheetsUtils');



// Route to fetch class records (for both Midterm & Final)
app.get('/api/getClassRecordFromSheet', async (req, res) => {
    try {
      const { studentID, sheetName } = req.query;
  
      // Validate required parameters
      if (!studentID || !sheetName) {
        return res.status(400).json({ success: false, message: "Missing studentID or sheetName parameter." });
      }
  
      // Fetch data from Google Sheets
      const record = await fetchClassRecordFromSheet(studentID, sheetName);
  
      // Respond with the fetched data
      return res.json({ success: true, data: record });
  
    } catch (err) {
      console.error(`Error in /api/getClassRecordFromSheet: ${err.message}`);
      return res.status(500).json({ success: false, message: err.message });
    }
  });



// Route to fetch ClassSection from MasterList
app.get('/api/getClassRecordFromMasterList', async (req, res) => {
    const { studentID } = req.query;
    if (!studentID) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }
  
    try {
      const classSection = await fetchClassSectionFromMasterList(studentID);
      res.json({ success: true, data: { ClassSection: classSection } });
    } catch (error) {
      console.error('Error fetching ClassSection:', error.message);
      res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
    }
  });

//routes
app.get('/login', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard'); // or wherever you want to send them
    }
    res.sendFile(__dirname + '/public/login.html');
  });

app.post('/api/register', async (req, res) => {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbz8rsTh7FsEUbpq1FR33VMQ_2auDYpjuq6SJTbOmgzHqHSRThylSkpEe7ZTExBo8099jQ/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...req.body, register: "1" })
    });
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.toString() });
  }
});


// 1) Redirect "/classrecords.html" => "/classrecords"
app.get('/classrecords.html', (req, res) => {
    if (!req.session || !req.session.userId) {
      // Not logged in, go to login
      return res.redirect('/login');
    }
    // Otherwise, redirect to /classrecords
    return res.redirect('/classrecords');
  });
  
  // 2) Serve "/classrecords" only if logged in
  app.get('/classrecords', (req, res) => {
    // Check if user is logged in
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    // If logged in, send the classrecords HTML
    res.sendFile(__dirname + '/public/classrecords.html');
  });
  

app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Process or save the data, then respond
    console.log(`Contact request from ${name}: ${message} (Email: ${email})`);
    res.status(200).send('Your message has been received. Thank you!');
});

// Helper Functions
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}


// Password validation function
function isValidPassword(password) {
    // Requires at least one uppercase letter, one lowercase letter, one number, and at least 8 characters
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return passwordRegex.test(password);
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Rate limiting middleware for login route
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many login attempts, please try again after 30 minutes.',
    handler: function (req, res, next, options) {
        res.status(options.statusCode).json({ success: false, message: options.message });
    }
});

// Connect to MongoDB and initialize the usersCollection
async function connectToDatabase() {
    try {
        // Initialize MongoDB connection monitoring
        client.on('topologyClosed', () => console.error('MongoDB connection closed.'));
        client.on('reconnect', () => console.log('MongoDB reconnected.'));

        await client.connect();
        console.log('Connected to MongoDB');
        const database = client.db('myDatabase');

        // Initialize collections
        usersCollection = database.collection('tblUser');
        gradesCollection = database.collection('tblGrades');
        logsCollection = database.collection('tblLogs');
        commentsCollection = database.collection('tblComments'); 
        blogCollection = database.collection('tblBlogs');
        quizzesCollection = database.collection('tblQuizzes');
        attemptsCollection = database.collection('tblAttempts');       
        classesCollection = database.collection('tblClasses');
        countersCollection = database.collection('tblCounters');
        classQuizCollection = database.collection('tblClassQuizzes');

        // Initialize SendGrid with API key
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1); // Exit the process if unable to connect
    }
}

/**
 * POST /api/quizzes/assign
 * Body example:
 * {
 *   "quizId": "64fa8d5eca7772318bcb82a1",
 *   "classId": "64fa8d5eca7772318bcb82b2",
 *   "assignedStudents": ["1000001","1000002"],  // optional
 *   "startDate": "2025-02-01T08:00:00Z",        // optional
 *   "dueDate": "2025-02-05T23:59:59Z"           // optional
 * }
 */


app.post('/api/quizzes/assign', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const {
        quizId,
        classId,
        assignedStudents, // optional array
        startDate,
        dueDate
      } = req.body;
  
      if (!quizId || !classId) {
        return res.status(400).json({ success: false, message: 'quizId and classId are required.' });
      }
  
      const quizObjId = new ObjectId(quizId);
      const classObjId = new ObjectId(classId);
  
      // Who is assigning (teacher or admin)
      const assignedByUserId = req.session.userId;
      const assignedByStudentID = req.session.studentIDNumber;
      const assignedByRole = req.session.role;
  
      // Check the class doc
      const classDoc = await classesCollection.findOne({ _id: classObjId });
      if (!classDoc) {
        return res.status(404).json({ success: false, message: 'Class not found.' });
      }
  
      // If assignedStudents is provided, ensure each is actually in classDoc.students
      let validAssignedStudents = null;
      if (Array.isArray(assignedStudents) && assignedStudents.length > 0) {
        validAssignedStudents = assignedStudents.filter(sid =>
          classDoc.students.includes(sid)
        );
        if (validAssignedStudents.length === 0) {
          // none are valid => might want to warn or block, up to you
          return res.status(400).json({
            success: false,
            message: 'None of the specified students are in this class.'
          });
        }
      }
  
      const newAssignment = {
        quizId: quizObjId,
        classId: classObjId,
        // If validAssignedStudents is null => user didn’t specify any => entire class
        // If validAssignedStudents is an empty array => no valid match => block or handle as needed
        assignedStudents: validAssignedStudents || [],
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedAt: new Date(),
        assignedBy: assignedByUserId,
        assignedByStudentID,
        assignedByRole
      };
  
      const result = await classQuizCollection.insertOne(newAssignment);
      if (result.acknowledged) {
        return res.status(201).json({
          success: true,
          message: 'Quiz assigned successfully.',
          assignmentId: result.insertedId
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to assign quiz.'
        });
      }
    } catch (error) {
      console.error('Error assigning quiz:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });


/**
 * GET /api/assignments/class/:classId
 * For teachers or admins: returns all quiz assignments in tblClassQuizzes
 * for a specific class, along with quiz details if needed.
 */
app.get('/api/assignments/class/:classId', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
        const { classId } = req.params;
        const classObjId = new ObjectId(classId);

        // 1) Find all assignments for this class
        const assignments = await classQuizCollection.find({ classId: classObjId }).toArray();

        // 2) Optionally, fetch quiz details for each quizId
        //    if you want to return quiz title/description, etc.
        //    We'll do a quick "lookup" in quizzesCollection.

        const quizIds = assignments.map(a => a.quizId);
        const uniqueQuizIds = [...new Set(quizIds.map(id => id.toString()))]
            .map(str => new ObjectId(str)); // convert to ObjectId again

        const quizzes = await quizzesCollection.find({ _id: { $in: uniqueQuizIds } }).toArray();
        const quizMap = new Map();
        quizzes.forEach(q => quizMap.set(q._id.toString(), q));

        // 3) Merge assignment data with quiz info
        const enrichedAssignments = assignments.map(asn => {
            const quizData = quizMap.get(asn.quizId.toString());
            return {
                assignmentId: asn._id,
                quizId: asn.quizId,
                classId: asn.classId,
                assignedStudents: asn.assignedStudents,
                startDate: asn.startDate,
                dueDate: asn.dueDate,
                assignedAt: asn.assignedAt,
                assignedBy: asn.assignedBy,
                assignedByStudentID: asn.assignedByStudentID,
                assignedByRole: asn.assignedByRole,
                // Optional quiz info
                quizTitle: quizData ? quizData.quizTitle : null,
                quizDescription: quizData ? quizData.description : null
            };
        });

        return res.json({ success: true, assignments: enrichedAssignments });
    } catch (error) {
        console.error('Error fetching class assignments:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

/**
 * GET /api/assignments/student
 * For the currently logged-in student: returns only the quizzes assigned to them.
 *
 * Logic:
 * 1) We find all pivot docs. 
 * 2) Filter to only those where:
 *    - The student's ID is in assignedStudents, OR assignedStudents is empty (means the whole class).
 * 3) We confirm the class doc actually includes this student in classDoc.students.
 * 4) Check if current date >= assignment.startDate (if it exists).
 */
app.get('/api/assignments/student', isAuthenticated, async (req, res) => {
    try {
        if (req.session.role !== 'student') {
            return res.status(403).json({ success: false, message: 'Forbidden. Only students can use this endpoint.' });
        }

        const studentIDNumber = req.session.studentIDNumber;

        // 1) Find all pivot docs in tblClassQuizzes
        const allAssignments = await classQuizCollection.find({}).toArray();

        // 2) We'll gather only those assignments that apply to this student
        let studentAssignments = [];

        for (let asn of allAssignments) {
            // If assignedStudents array is empty => entire class
            // If assignedStudents array includes this student => assigned
            let isAssignedToStudent = false;

            if (Array.isArray(asn.assignedStudents) && asn.assignedStudents.length > 0) {
                if (asn.assignedStudents.includes(studentIDNumber)) {
                    isAssignedToStudent = true;
                }
            } else {
                // assigned to entire class
                const classDoc = await classesCollection.findOne({ _id: asn.classId, students: studentIDNumber });
                if (classDoc) {
                    isAssignedToStudent = true;
                }
            }

            // If assigned, also check if startDate is not in the future
            if (isAssignedToStudent) {
                if (asn.startDate && asn.startDate > new Date()) {
                    // Not visible yet
                    continue;
                }
                studentAssignments.push(asn);
            }
        }

        // 3) Optional: fetch quiz details
        const quizIds = studentAssignments.map(a => a.quizId);
        const uniqueQuizIds = [...new Set(quizIds.map(id => id.toString()))]
            .map(str => new ObjectId(str));

        const quizzes = await quizzesCollection.find({ _id: { $in: uniqueQuizIds } }).toArray();
        const quizMap = new Map();
        quizzes.forEach(q => quizMap.set(q._id.toString(), q));

        // 4) Merge with quiz info
        const enrichedAssignments = studentAssignments.map(asn => {
            const quizData = quizMap.get(asn.quizId.toString());
            return {
                assignmentId: asn._id,
                quizId: asn.quizId,
                startDate: asn.startDate,
                dueDate: asn.dueDate,
                quizTitle: quizData ? quizData.quizTitle : null,
                quizDescription: quizData ? quizData.description : null
            };
        });

        return res.json({ success: true, assignments: enrichedAssignments });
    } catch (error) {
        console.error('Error fetching student assignments:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

/**
 * DELETE /api/assignments/:assignmentId
 * Teachers/Admin only. Removes the assignment pivot doc from tblClassQuizzes.
 */
app.delete('/api/assignments/:assignmentId', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const { assignmentId } = req.params;
  
      // Validate ObjectId
      if (!ObjectId.isValid(assignmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid assignmentId.' });
      }
      const assignmentObjId = new ObjectId(assignmentId);
  
      // Attempt to delete
      const deleteResult = await classQuizCollection.deleteOne({ _id: assignmentObjId });
      
      if (deleteResult.deletedCount === 1) {
        return res.json({ success: true, message: 'Assignment removed successfully.' });
      } else {
        return res.status(404).json({ success: false, message: 'Assignment not found.' });
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
  
  /**
 * PUT /api/assignments/:assignmentId
 * Teachers/Admin only. Updates certain fields in the assignment pivot doc.
 * Example body:
 * {
 *   "startDate": "2025-03-01T08:00:00Z",
 *   "dueDate":   "2025-03-05T23:59:59Z",
 *   "assignedStudents": ["1000001", "1000002"] // optional
 * }
 */
app.put('/api/assignments/:assignmentId', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { startDate, dueDate, assignedStudents } = req.body;
  
      if (!ObjectId.isValid(assignmentId)) {
        return res.status(400).json({ success: false, message: 'Invalid assignmentId.' });
      }
      const assignmentObjId = new ObjectId(assignmentId);
  
      // Build update object
      const updateFields = {};
      if (startDate !== undefined) updateFields.startDate = startDate ? new Date(startDate) : null;
      if (dueDate !== undefined) updateFields.dueDate = dueDate ? new Date(dueDate) : null;
      if (Array.isArray(assignedStudents)) updateFields.assignedStudents = assignedStudents;
  
      const updateResult = await classQuizCollection.updateOne(
        { _id: assignmentObjId },
        { $set: updateFields }
      );
  
      if (updateResult.modifiedCount === 1) {
        return res.json({ success: true, message: 'Assignment updated successfully.' });
      } else if (updateResult.matchedCount === 0) {
        return res.status(404).json({ success: false, message: 'Assignment not found.' });
      } else {
        // matchedCount = 1 but modifiedCount = 0 => no changes
        return res.json({ success: true, message: 'No changes made to the assignment.' });
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });
  


app.get('/api/classes', isAuthenticated, async (req, res) => {
    try {
      // If ?studentEnrolled=true
      if (req.query.studentEnrolled === 'true' && req.session.role === 'student') {
        const studentIDNumber = req.session.studentIDNumber;
        const classes = await classesCollection.find({
          students: { $in: [studentIDNumber] }
        }).toArray();
        return res.json({ success: true, classes });
      }
      
  
      // Otherwise, handle teacher/admin logic (existing code)
      if (req.session.role === 'teacher') {
        const teacherClasses = await classesCollection.find({ instructorId: new ObjectId(req.session.userId) }).toArray();
        return res.json({ success: true, classes: teacherClasses });
      } else if (req.session.role === 'admin') {
        const allClasses = await classesCollection.find({}).toArray();
        return res.json({ success: true, classes: allClasses });
      } else {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  app.post('/api/quiz-responses', isAuthenticated, async (req, res) => {
    try {
        const { quizId, responses, score, totalQuestions } = req.body;
        const studentId = req.session.userId;

        if (!quizId || !responses || !Array.isArray(responses)) {
            return res.status(400).json({ success: false, message: 'Invalid data format.' });
        }

        const responseDoc = {
            quizId: new ObjectId(quizId),
            studentId: new ObjectId(studentId),
            responses,
            score,
            totalQuestions,
            submittedAt: new Date(),
        };

        const result = await attemptsCollection.insertOne(responseDoc);

        if (result.acknowledged) {
            res.json({ success: true, message: 'Responses saved successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to save responses.' });
        }
    } catch (error) {
        console.error('Error saving quiz responses:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


  app.get('/api/quizzes', isAuthenticated, async (req, res) => {
    console.log("/api/quizzes route hit"); // Debug log
    try {
        console.log("Test2")
        const { role, userId, studentIDNumber } = req.session;
        let filter = {};

        // If teacher => only show quizzes the teacher created
        if (role === 'teacher') {
            filter = { createdBy: new ObjectId(userId) };
        }
    /*
        if (role === 'student') {
            console.log("Test3")
            // Fetch active quizzes assigned to the student
            const assignedQuizzes = await attemptsCollection
                .find({ studentIDNumber })
                .project({ quizId: 1 })
                .toArray();

            const assignedQuizIds = assignedQuizzes.map(q => q.quizId);
            filter._id = { $in: assignedQuizIds }; // Filter only assigned quizzes
            filter.isActive = true; // Ensure only active quizzes are returned
        } else if (role === 'teacher') {
            // Fetch quizzes created by the teacher
            filter.createdBy = new ObjectId(userId);
        }*/
        // For admin, no additional filter (returns all quizzes)

        // Fetch quizzes based on the filter
        const quizzes = await quizzesCollection.find(filter).toArray();
        return res.json({ success: true, quizzes });
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


  
  

// PUT /api/classes/:classId/enroll
app.put('/api/classes/:classId/enroll', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
        const classId = req.params.classId;
        const studentIDNumber = req.params.studentIDNumber;
        let { studentIDs } = req.body; // array of IDs

        if (!Array.isArray(studentIDs)) {
            return res.status(400).json({ success: false, message: 'studentIDs must be an array.' });
        }
        
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ success: false, message: 'Answers must be an array.' });
        }
        
        console.log('Answers Submitted:', answers);
        
        // Ensure submitted answers match the number of questions
        if (answers.length !== quiz.questions.length) {
            return res.status(400).json({
                success: false,
                message: 'Number of answers does not match the number of questions.'
            });
        }
        

        // remove duplicates
        studentIDs = [...new Set(studentIDs)];

        // update the class doc
        const result = await classesCollection.updateOne(
            { _id: new ObjectId(classId) },
            { $pull: { students: studentIDNumber } }
        );
        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Class not found or student not in class.' });
        }
        res.json({ success: true, message: 'Student removed from class.' });
    } catch (err) {
        console.error('Error enrolling students:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// POST /api/classes/generate-code
app.post('/api/classes/generate-code', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {

            // We'll only try up to X times to avoid an infinite loop.
        const MAX_TRIES = 1000;
        let tries = 0;

        while (true) {
        tries++;
        if (tries > MAX_TRIES) {
            return res.status(500).json({
            success: false,
            message: 'Could not generate a unique code after many attempts.'
            });
        }

        // findOneAndUpdate with an upsert or just findOne first
        const result = await countersCollection.findOneAndUpdate(
            { _id: "classCode" },
            { $inc: { nextVal: 1 } },
            { returnDocument: "after", upsert: true }
        );
        
        const nextVal = result.value ? result.value.nextVal : 1;
      // 2. Format it
      const padded = String(nextVal).padStart(6, '0');
      const candidateCode = `C${padded}`;

      // 3. Check if this code already exists
      const existing = await classesCollection.findOne({ classCode: candidateCode });
      if (!existing) {
        // We found a fresh code
        return res.json({ success: true, classCode: candidateCode });
      }
      // else loop again to get the next increment
    }
  } catch (err) {
    console.error('Error generating class code:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// isTeacherOrAdmin middleware (example)
function isTeacherOrAdmin(req, res, next) {
    if (!req.session || !req.session.role) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (req.session.role === 'teacher' || req.session.role === 'admin') {
      return next();
    }
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

// POST /api/classes
app.post('/api/classes', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
        const {
            classCode,
            className,
            schedule,
            time,
            instructorIDNumber,
            instructorName,
            students
        } = req.body;

        // You can do validation checks here
        if (!classCode || !className) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        // The user in session is the one creating
        const createdBy = new ObjectId(req.session.userId);

        // Build the class doc
        const newClass = {
            classCode,
            className,
            instructorIDNumber,
            instructorName,
            instructorId: createdBy,
            createdBy,
            schedule: schedule || "",
            time: time || "",
            students: Array.isArray(students) ? [...new Set(students)] : [],
            createdAt: new Date()
        };

        // Insert
        const result = await classesCollection.insertOne(newClass);
        if (result.acknowledged) {
            return res.json({ success: true, classId: result.insertedId });
        } else {
            return res.status(500).json({ success: false, message: "Failed to create class." });
        }
    } catch (err) {
        console.error("Error creating class:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

app.post('/api/classes/upload-temp-students', isAuthenticated, isTeacherOrAdmin, upload.single('studentFile'), async (req, res) => {
    try {
        // read the file
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        // parse CSV lines (like your existing parseCSVFile usage)
        const filePath = req.file.path;
        const studentIDs = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Suppose each row has { studentIDNumber: '1000001' }
                if (row.studentIDNumber) {
                    studentIDs.push(row.studentIDNumber.trim());
                }
            })
            .on('end', () => {
                fs.unlink(filePath, () => {});
                return res.json({ success: true, studentIDs });
            })
            .on('error', (err) => {
                fs.unlink(filePath, () => {});
                console.error('Error parsing CSV:', err);
                return res.status(500).json({ success: false, message: 'Error parsing CSV file.' });
            });
    } catch (err) {
        console.error('Error uploading student file:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.post('/api/quizzes', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const {
            quizTitle,
            description,
            questions,
            dueDate,
            latePenaltyPercent,
            maxAttempts,
            duration
        } = req.body;

        // Basic validation
        if (!quizTitle || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ success: false, message: 'Invalid quiz data.' });
        }

        const newQuiz = {
            quizTitle,
            description: description || '',
            questions,
            dueDate: dueDate ? new Date(dueDate) : null,  // store as Date
            latePenaltyPercent: (latePenaltyPercent != null) ? latePenaltyPercent : 40,
            maxAttempts: maxAttempts || 1,
            duration: duration || 0,   // in minutes
            isActive: true,           // default open
            createdBy: req.session.userId, // or admin ID
            createdAt: new Date()
        };

        const result = await quizzesCollection.insertOne(newQuiz);
        if (result.acknowledged) {
            return res.status(201).json({ success: true, quizId: result.insertedId, message: 'Quiz created successfully.' });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to create quiz.' });
        }
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

/**
 * Student starts a quiz
 *  - Creates a new doc in tblAttempts with isCompleted = false
 */
app.post('/api/quizzes/:quizId/start', isAuthenticated, async (req, res) => {
    try {
        const quizId = req.params.quizId;
        if (!ObjectId.isValid(quizId)) {
            return res.status(400).json({ success: false, message: 'Invalid quizId.' });
        }

        // If admin or teacher is "starting" (maybe to test?), skip assignment check
        // Or if you want to block them, you can. Usually teachers might want to preview the quiz, so let's let them do so.
        if (req.session.role === 'teacher' || req.session.role === 'admin') {
            // continue the normal logic
        } else if (req.session.role === 'student') {
            // 1. Check pivot doc
            const pivotDoc = await classQuizCollection.findOne({ quizId: new ObjectId(quizId) });
            if (!pivotDoc) {
                return res.status(403).json({ success: false, message: 'You are not assigned this quiz.' });
            }

            // 2. Check assignedStudents or entire class
            const studentIDNumber = req.session.studentIDNumber;
            let isAssignedToStudent = false;
            if (Array.isArray(pivotDoc.assignedStudents) && pivotDoc.assignedStudents.length > 0) {
                if (pivotDoc.assignedStudents.includes(studentIDNumber)) {
                    isAssignedToStudent = true;
                }
            } else {
                // assigned to entire class
                const classDoc = await classesCollection.findOne({
                    _id: pivotDoc.classId,
                    students: studentIDNumber
                });
                if (classDoc) {
                    isAssignedToStudent = true;
                }
            }
            if (!isAssignedToStudent) {
                return res.status(403).json({ success: false, message: 'You are not assigned this quiz.' });
            }

            // 3. Check startDate
            if (pivotDoc.startDate && pivotDoc.startDate > new Date()) {
                return res.status(403).json({ success: false, message: 'Quiz not yet available.' });
            }

            // 4. Check dueDate if you want to block attempts after it. 
            //    Alternatively, you keep the penalty logic as is. 
            //    If you do want to block, then:
            // if (pivotDoc.dueDate && new Date() > pivotDoc.dueDate) {
            //     return res.status(403).json({ success: false, message: 'The due date for this quiz has passed.' });
            // }
        }

        // From here, proceed with your normal "start quiz" logic:
        // 1. Find the quiz by quizId
        const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found.' });
        }

        // 2. Check if user has exceeded maxAttempts ...
        // 3. Insert attempt doc ...
        // ...
    } catch (error) {
        console.error('Error starting quiz attempt:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


/**
 * Update partial attempt answers
 *  Body example:
 *  {
 *    "answers": [0, 3, null, 2]
 *  }
 */
app.put('/api/quizzes/:quizId/attempts/:attemptId', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const studentIDNumber = req.session.studentIDNumber;
        const attemptId = req.params.attemptId;

        // Find the attempt
        const attempt = await attemptsCollection.findOne({ _id: new ObjectId(attemptId) });
        console.log('Attempt:', attempt);
        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found.' });
        }

        // Verify ownership
        if (attempt.studentId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }

        // If already completed, can't update answers
        if (attempt.isCompleted) {
            return res.status(400).json({ success: false, message: 'Attempt is already submitted.' });
        }

        // Update answers, partialSaveAt
        await attemptsCollection.updateOne(
            { _id: attempt._id },
            {
                $set: {
                    answers: answers || [],
                    partialSaveAt: new Date(),
                    studentIDNumber: studentIDNumber
                }
            }
        );

        res.json({ success: true, message: 'Attempt updated (partial save).' });
    } catch (error) {
        console.error('Error updating attempt:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

function convertToTimezone(date, timeZone) {
    return new Date(
        date.toLocaleString('en-US', { timeZone: timeZone })
    );
}

function isValidObjectId(id) {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}

app.post('/api/quizzes/:quizId/attempts/:attemptId/submit', isAuthenticated, async (req, res) => {
    try {
        const { quizId, attemptId } = req.params;
        const { answers } = req.body;
        const userId = req.session.userId;


        // 1. Find attempt & quiz
        const attempt = await attemptsCollection.findOne({ _id: new ObjectId(attemptId) });
        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found.' });
        }
        if (attempt.studentId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }
        if (attempt.isCompleted) {
            return res.status(400).json({ success: false, message: 'Attempt is already submitted.' });
        }

        const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated.' });
        }
        if (!isValidObjectId(quizId) || !isValidObjectId(attemptId)) {
            return res.status(400).json({ success: false, message: 'Invalid IDs.' });
        }
        

        console.log('Quiz Submission Endpoint Hit');
        console.log('Quiz ID:', quizId);
        console.log('Attempt ID:', attemptId);
        console.log('User ID:', userId);
        console.log('Submitted Answers:', answers);


        // 2. Calculate raw score
        // quiz.questions[i].correctAnswer is the correct index
        let rawScore = 0;
        for (let i = 0; i < quiz.questions.length; i++) {
            const studentAnswer = answers[i];
            const correctAnswer = quiz.questions[i].correctAnswer;
            if (studentAnswer === correctAnswer) {
                rawScore++;
            }
            console.log('Attempt Answers:', attempt.answers);
        }

        // Let's define totalQuizPoints as the number of questions for simplicity
        const totalQuizPoints = quiz.questions.length;
        

        let finalScore = rawScore;
        
        // Remove timezone conversion logic: we simply use the current server time for submission
        const submittedAt = new Date();
        if (quiz.dueDate) {
        const dueDate = new Date(quiz.dueDate); // Assuming dueDate is stored as Date
        // If submitted later than due date, apply penalty
        if (submittedAt > dueDate) {
            const penaltyPercent = quiz.latePenaltyPercent || 40;
            const penalty = (penaltyPercent / 100) * totalQuizPoints;
            finalScore = rawScore - penalty;
        }
        }

        // clamp finalScore to a minimum of 0
        finalScore = Math.max(0, finalScore);

        // Mark attempt as completed
        await attemptsCollection.updateOne(
            { _id: attempt._id },
            {
                $set: {
                    isCompleted: true,
                    submittedAt: submittedAt,
                    score: rawScore,
                    finalScore: finalScore,
                    studentIDNumber: req.session.studentIDNumber // optional 
                }
            }
        );

        // 4. If multiple attempts, compute final grade across all attempts
        const allAttempts = await attemptsCollection
            .find({
                quizId: quiz._id,
                studentId: new ObjectId(userId),
                isCompleted: true
            })
            .toArray();

        // Build array of finalScores
        const allFinalScores = allAttempts.map(a => a.finalScore);
        const averageScore = allFinalScores.reduce((a, b) => a + b, 0) / allFinalScores.length;
        const attemptCount = allAttempts.length;

        // Formula: finalGrade = average(finalScores) - (attemptCount - 1)
        // But only if quiz.maxAttempts > 1
        let multipleAttemptsAdjustedScore = finalScore;
        if (quiz.maxAttempts > 1 && attemptCount > 1) {
            multipleAttemptsAdjustedScore = averageScore - (attemptCount - 1);
            // clamp to 0
            multipleAttemptsAdjustedScore = Math.max(0, multipleAttemptsAdjustedScore);
        }

        // Optionally store a "computedFinalScore" somewhere if you want:
        // For demonstration, let's just update the last attempt doc with this final computed score
        await attemptsCollection.updateOne(
            { _id: attempt._id },
            { $set: { finalScore: multipleAttemptsAdjustedScore } }
        );

        // Return final result
        res.json({
            success: true,
            rawScore,
            finalScore: multipleAttemptsAdjustedScore,
            totalQuizPoints,
            message: 'Quiz submitted successfully.'
        });
    } catch (error) {
        console.error('Error submitting final quiz attempt:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});



app.get('/api/quizzes/:quizId/export', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const quizId = req.params.quizId;

        // 1. Fetch the quiz
        const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found.' });
        }

        // 2. Fetch all attempts
        const attempts = await attemptsCollection.find({ quizId: quiz._id }).toArray();

        // 3. Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Quiz Attempts');

        // 4. Add headers
        worksheet.columns = [
            { header: 'Student ID (ObjectId)', key: 'studentId', width: 24 },
            { header: 'StudentIDNumber', key: 'studentIDNumber', width: 12 },
            { header: 'Attempt #', key: 'attemptNumber', width: 10 },
            { header: 'Is Completed?', key: 'isCompleted', width: 15 },
            { header: 'Raw Score', key: 'score', width: 10 },
            { header: 'Final Score', key: 'finalScore', width: 12 },
            { header: 'Submitted At', key: 'submittedAt', width: 20 }
        ];

        // 5. Populate rows
        attempts.forEach(attempt => {
            worksheet.addRow({
                studentId: attempt.studentId.toString(),
                studentIDNumber: attempt.studentIDNumber || '',
                attemptNumber: attempt.attemptNumber,
                isCompleted: attempt.isCompleted,
                score: attempt.score,
                finalScore: attempt.finalScore,
                submittedAt: attempt.submittedAt
                    ? utcToZonedTime(attempt.submittedAt, 'Asia/Manila').toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
                    : ''
            });
        });

        // 6. Write file to buffer
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="quiz_${quizId}_attempts.xlsx"`);

        await workbook.xlsx.write(res); // write directly to response
        res.end();
    } catch (error) {
        console.error('Error exporting quiz attempts:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

/**
 * GET /api/quizzes
 * Admin: returns all quizzes
 * Student: returns only isActive quizzes
 */

  
  app.get('/api/class-quiz/:classId', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const classId = req.params.classId;
      const pivotDocs = await classQuizCollection.find({ classId: new ObjectId(classId) }).toArray();
      // pivotDocs e.g.: [ { _id, classId, quizId }, ... ]
      const quizIds = pivotDocs.map(doc => doc.quizId.toString()); // array of quizId strings
      res.json({ success: true, quizIds });
    } catch (error) {
      console.error('Error getting pivot docs:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  app.post('/api/class-quiz', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const { classId, quizIds, action } = req.body;
      if (!classId || !Array.isArray(quizIds)) {
        return res.status(400).json({ success: false, message: 'Invalid data' });
      }
  
      if (action === 'assign') {
        // Insert pivot docs for each quizId if they don't exist
        const bulkOps = quizIds.map(qid => ({
          updateOne: {
            filter: { classId: new ObjectId(classId), quizId: new ObjectId(qid) },
            update: {
              $setOnInsert: {
                assignedAt: new Date(),
                assignedBy: new ObjectId(req.session.userId)
              }
            },
            upsert: true
          }
        }));
        await classQuizCollection.bulkWrite(bulkOps);
        return res.json({ success: true, message: 'Assigned quizzes to class.' });
      } else if (action === 'remove') {
        // Remove pivot docs
        const bulkOps = quizIds.map(qid => ({
          deleteOne: {
            filter: { classId: new ObjectId(classId), quizId: new ObjectId(qid) }
          }
        }));
        await classQuizCollection.bulkWrite(bulkOps);
        return res.json({ success: true, message: 'Removed quizzes from class.' });
      } else {
        return res.status(400).json({ success: false, message: 'Invalid action.' });
      }
    } catch (error) {
      console.error('Error updating class-quiz pivot:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  app.put('/api/classes/:classId/students', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const classId = req.params.classId;
      const { studentIDs, action } = req.body; // e.g. [ '1000001', '1000002' ]
  
      if (!Array.isArray(studentIDs)) {
        return res.status(400).json({ success: false, message: 'studentIDs must be an array.' });
      }
  
      if (action === 'add') {
        // Add new students
        await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $addToSet: { students: { $each: studentIDs } } }
        );
        return res.json({ success: true, message: 'Students added to class.' });
      } else if (action === 'remove') {
        // Remove students
        await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $pull: { students: { $in: studentIDs } } }
        );
        return res.json({ success: true, message: 'Students removed from class.' });
      } else {
        return res.status(400).json({ success: false, message: 'Invalid action.' });
      }
    } catch (error) {
      console.error('Error updating students for class:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
  /**
 * POST /api/classes/join
 * Body: { "classCode": "CLS-000123" }
 * The student wants to join a class by code.
 */
app.post('/api/classes/join', isAuthenticated, async (req, res) => {
    try {
      if (req.session.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Forbidden. Only students can join classes.' });
      }
  
      const { classCode } = req.body;
      if (!classCode) {
        return res.status(400).json({ success: false, message: 'No classCode provided.' });
      }
  
      // Find the class by its code
      const cls = await classesCollection.findOne({ classCode: classCode.trim() });
      if (!cls) {
        return res.status(404).json({ success: false, message: 'Class not found or invalid code.' });
      }
  
      // We'll store the student's IDNumber in the class's "students" array
      const studentIDNumber = req.session.studentIDNumber;
      if (!studentIDNumber) {
        return res.status(400).json({
          success: false,
          message: 'Student ID not found in session.'
        });
      }
  
      // Add the student's IDNumber to the class doc, if not already present
      const updateResult = await attemptsCollection.updateOne(
        { _id: attempt._id },
        { $set: { isCompleted: true, submittedAt, score: rawScore, finalScore } }
    );
    if (updateResult.modifiedCount === 0) {
        console.error('Attempt update failed:', updateResult);
        return res.status(500).json({ success: false, message: 'Failed to update attempt.' });
    }
    
  
        return res.json({ success: true, message: `Joined class ${classCode} successfully!` });
    } catch (err) {
    console.error('Error joining class:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    });
  

app.put('/api/quizzes/:quizId/active', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { quizId } = req.params;
        const { isActive } = req.body;

        console.log('Toggling quiz:', quizId, 'to', isActive);

        const result = await quizzesCollection.updateOne(
            { _id: new ObjectId(quizId) },
            { $set: { isActive: !!isActive } }
        );

        if (result.modifiedCount === 0) {
            return res
                .status(404)
                .json({ success: false, message: 'Quiz not found or no change.' });
        }

        res.json({
            success: true,
            message: `Quiz set to isActive=${isActive}`
        });
    } catch (error) {
        console.error('Error toggling quiz active state:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
});


app.get('/api/quizzes/:quizId', isAuthenticated, async (req, res) => {
    try {
        const quizId = req.params.quizId;
        // Check if quizId is valid
        if (!ObjectId.isValid(quizId)) {
            return res.status(400).json({ success: false, message: 'Invalid quizId.' });
        }

        // Fetch quiz
        const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
        if (!quiz) {
            return res.status(404).json({ success: false, message: 'Quiz not found.' });
        }

        // If admin/teacher, allow direct access
        if (req.session.role === 'admin' || req.session.role === 'teacher') {
            return res.json({ success: true, quiz });
        }

        // If student, we must confirm they have an assignment pivot doc
        if (req.session.role === 'student') {
            const studentIDNumber = req.session.studentIDNumber;

            // Find any assignment doc in tblClassQuizzes for this quiz
            // that includes this student or the entire class
            // AND check if startDate <= now
            const pivotDoc = await classQuizCollection.findOne({
                quizId: new ObjectId(quizId)
            });

            // If no pivot doc at all => not assigned
            if (!pivotDoc) {
                return res.status(403).json({ success: false, message: 'You are not assigned this quiz.' });
            }

            // Check assignedStudents array (if not empty)
            let isAssignedToStudent = false;
            if (Array.isArray(pivotDoc.assignedStudents) && pivotDoc.assignedStudents.length > 0) {
                if (pivotDoc.assignedStudents.includes(studentIDNumber)) {
                    isAssignedToStudent = true;
                }
            } else {
                // means entire class—verify the student is in pivotDoc.classId’s doc
                const classDoc = await classesCollection.findOne({ 
                    _id: pivotDoc.classId,
                    students: studentIDNumber 
                });
                if (classDoc) {
                    isAssignedToStudent = true;
                }
            }

            if (!isAssignedToStudent) {
                return res.status(403).json({ success: false, message: 'You are not assigned this quiz.' });
            }

            // Check startDate
            if (pivotDoc.startDate && pivotDoc.startDate > new Date()) {
                return res.status(403).json({ success: false, message: 'Quiz not yet available.' });
            }

            // If we pass all checks
            return res.json({ success: true, quiz });
        }

        // If some other role or missing data
        return res.status(403).json({ success: false, message: 'Forbidden.' });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});


    // Login Route with Rate Limiting
    app.post('/login', async (req, res) => {
        const { studentIDNumber, password } = req.body;

        try {
            if (!studentIDNumber || !password) {
                return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
            }

            if (
                studentIDNumber !== "crfvadmin" &&
                studentIDNumber !== "crfvuser" &&
                !/^\d{7}$/.test(studentIDNumber)
            ) {
                return res.status(400).json({ success: false, message: 'Student ID must be exactly 7 digits or a valid admin/user username.' });
            }

            const user = await usersCollection.findOne(
                { studentIDNumber: studentIDNumber },
                { projection: { firstName: 1, lastName: 1, studentIDNumber: 1, password: 1, role: 1, invalidLoginAttempts: 1, accountLockedUntil: 1, emaildb: 1 } }
            );

            // Debug user password
            console.log('User password from DB:', user.password);
            if (typeof user.password !== 'string') {
                console.error('Password in DB is not a string');
                return res.status(500).json({ success: false, message: 'Internal server error.' });
            }
            
            // Check if the account is locked
            if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
                const remainingTime = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
                return res.status(403).json({ 
                    success: false, 
                    message: `Account is locked. Try again in ${remainingTime} minutes.` 
                });
            }

            const sanitizedStudentIDNumber = validator.trim(studentIDNumber);


            if (
                studentIDNumber !== "crfvadmin" &&
                studentIDNumber !== "crfvuser" &&
                !/^\d{7}$/.test(studentIDNumber)
            ) {
                return res.status(400).json({ success: false, message: 'Student ID must be exactly 7 digits or a valid admin/user username.' });
            }
            

            const passwordMatch = await bcrypt.compare(password, user.password);

            if (!passwordMatch) {
                // Increment invalid login attempts
                let invalidAttempts = (user.invalidLoginAttempts || 0) + 1;
                let updateFields = { invalidLoginAttempts: invalidAttempts };
    
                if (invalidAttempts >= 3) {
                    // Lock the account for 30 minutes
                    updateFields.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
                    updateFields.invalidLoginAttempts = 0; // Reset attempts after locking
    
                    await usersCollection.updateOne({ _id: user._id }, { $set: updateFields });
    
                    // Send account lock email
                    const emailContent = `
                        <p>Dear ${user.firstName},</p>
                        <p>You are locked out from logging in for 30 minutes, but you can reset your password immediately if you need.</p>
                        <p>Best regards,<br/>HelloGrade Student Portal Team</p>
                    `;
                    await sendEmail({ to: user.emaildb, subject: 'Account Locked', html: emailContent });
    
                    return res.status(403).json({ 
                        success: false, 
                        message: 'Account is locked due to multiple failed login attempts. An email has been sent with further instructions.' 
                    });
                } else {
                    await usersCollection.updateOne({ _id: user._id }, { $set: updateFields });
                    return res.status(400).json({ success: false, message: 'Invalid email or password.' });
                }
            }

            // Reset invalid login attempts on successful login
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { invalidLoginAttempts: 0, accountLockedUntil: null } }
            );

            // Set up session
            req.session.userId = user._id.toString();
            req.session.studentIDNumber = user.studentIDNumber;
            req.session.role = user.role;
            

                // Update last login time
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { lastLoginTime: new Date() } }
                );
                 // Log the login activity
                 await logsCollection.insertOne({
                    studentIDNumber,
                    name: `${user.firstName} ${user.lastName}`,
                    timestamp: new Date(),
                });

                res.json({ success: true, role: user.role, message: 'Login successful!' });
            } catch (error) {
                console.error('Error during login:', error);
                res.status(500).json({ success: false, message: 'Error during login.' });
            }
        });

    // Logout Route
    app.post('/logout', (req, res) => {
        console.log('Logout route called');
        console.log('Session data before destroying:', req.session);
    
        const userId = req.session?.userId;

        if (!userId) {
        console.error('No userId in session during logout');
        return res.status(400).json({ success: false, message: 'No user is logged in.' });
        }

        console.log('Logging out user ID:', userId);
        
        try {
            
            req.session.destroy(err => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.status(500).json({ success: false, message: 'Logout failed.' });
                }
    
                res.clearCookie('connect.sid');
    
                // Set headers to prevent caching
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.setHeader('Surrogate-Control', 'no-store');
    
                // Redirect to index.html after logout
                return res.redirect('/index.html');
            });
        } catch (error) {
            console.error('Error during logout:', error);
            return res.status(500).json({ success: false, message: 'Failed to update loginstatus.' });
        }
        console.log('Logging out user ID:', userId);
    });
    
    

    // Send Password Reset Email with Lockout Check
    app.post('/send-password-reset', async (req, res) => {
        const { email } = req.body;
      
        try {
          const user = await usersCollection.findOne({ emaildb: email });
          if (!user) {
            return res.status(404).json({
              success: false,
              message: 'If that email address is in our database, we will send you an email to reset your password.'
            });
          }
      
          // Generate OTP, set expires, etc.
          const resetCode = generateOTP();
          const resetExpires = new Date(Date.now() + 3600000);
          await usersCollection.updateOne(
            { emaildb: email },
            { 
              $set: {
                resetCode,
                resetExpires,
                invalidResetAttempts: 0,
                resetCodeLockUntil: null
              }
            }
          );
      
          // Decide which email text to use
          const isLocked = (user.accountLockedUntil && user.accountLockedUntil > new Date());
          let emailContent = ''; // Declare once here, outside the if/else
      
          if (isLocked) {
            emailContent = `
              <p>Dear ${user.firstName},</p>
              <p>We see you’re locked out for multiple login attempts.
                 You may still reset your password right now, or wait 
                 ${/* time left calculation if you want */''} 
                 to try logging in again.</p>
              <p>Reset code: ${resetCode}</p>
              <p>Best regards,<br/>HelloGrade Student Portal Team</p>
            `;
          } else {
            emailContent = `
              <p>Dear ${user.firstName},</p>
              <p>You requested a password reset. Here is your reset code:</p>
              <p><b>${resetCode}</b></p>
              <p>Best regards,<br/>HelloGrade Student Portal Team</p>
            `;
          }
      
          // Now we can call sendEmail, referencing the same `emailContent` variable
          await sendEmail({ to: email, subject: 'Your Password Reset Code', html: emailContent });
      
          return res.json({
            success: true, 
            message: 'If that email address is in our database, we will send you an email to reset your password.'
          });
        } catch (error) {
          console.error('Error processing your request:', error);
          return res.status(500).json({ success: false, message: 'Error processing your request' });
        }
      });
      


    app.post('/verify-reset-code', async (req, res) => {
        const { email, resetCode } = req.body;
    
        try {
            const user = await usersCollection.findOne({ emaildb: email });
    
            if (!user) {
                return res.status(400).json({ success: false, message: 'Invalid credentials.' });
            }
    
            // Check if the reset code matches and is not expired
            if (user.resetCode !== resetCode || user.resetExpires <= new Date()) {
                let invalidAttempts = (user.invalidResetAttempts || 0) + 1;
                let attemptsLeft = 3 - invalidAttempts;
    
                let updateFields = { invalidResetAttempts: invalidAttempts };
    
                if (invalidAttempts >= 3) {
                    updateFields.resetCodeLockUntil = new Date(Date.now() + 60 * 1000); // Lock for 60 seconds
                    updateFields.invalidResetAttempts = 0; // Reset attempts after lock
                    updateFields.resetCode = null; // Clear reset code
                    updateFields.resetExpires = null; // Clear expiration
    
                    await usersCollection.updateOne({ _id: user._id }, { $set: updateFields });
                    return res.status(429).json({ 
                        success: false, 
                        message: 'Too many invalid attempts. Please request a new reset code after 60 seconds.', 
                        attemptsLeft: 0 
                    });
                } else {
                    await usersCollection.updateOne({ _id: user._id }, { $set: updateFields });
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Invalid or expired reset code.', 
                        attemptsLeft: attemptsLeft 
                    });
                }
            }
    
            // Mark the reset code as verified
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { resetCodeVerified: true, invalidResetAttempts: 0, resetCodeLockUntil: null } }
            );
    
            res.json({ success: true, message: 'Reset code verified.' });
        } catch (error) {
            console.error('Error verifying reset code:', error);
            res.status(500).json({ success: false, message: 'An internal error occurred.' });
        }
    });
    



// Reset Password Endpoint
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        // Find the user by email and ensure reset code is verified
        const user = await usersCollection.findOne({
            emaildb: email,
            resetCodeVerified: true, // Ensure the reset code was verified
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request or account is disabled.',
            });
        }

        // Hash the new password before saving
        const hashedNewPassword = await hashPassword(newPassword);
        // Update the user's password
        
        await usersCollection.updateOne(
            { _id: user._id },
            {
                $set: {
                    password: hashedNewPassword,
                    resetCode: null,           // Clear the reset code
                    resetExpires: null,        // Clear the expiration
                    resetCodeVerified: false,  // Reset verification status
                    accountLockedUntil: null,
                    invalidLoginAttempts: 0
                },
            }
        );

        res.json({ success: true, message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password.',
        });
    }
});

app.get('/admin_dashboard', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(__dirname + '/public/admin_dashboard.html');
});


app.post('/upload-grades', isAuthenticated, isAdmin, upload.single('gradesFile'), async (req, res) => {
    try {
        const gradesFile = req.file; // Check if file was uploaded
        if (!gradesFile) {
            console.error("File upload error: No file was uploaded.");
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Ensure that parsing is awaited and errors are logged if they occur
        const gradesData = await parseCSVFile(gradesFile.path);

        if (!Array.isArray(gradesData)) {
            console.error("Parsing error: gradesData is not an array.");
            fs.unlink(gradesFile.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
            return res.status(500).json({ success: false, message: 'Parsing error: gradesData is not an array' });
        }

        const gradesCollection = client.db('myDatabase').collection('tblGrades');

        for (const grade of gradesData) {
            const { studentIDNumber, CourseID, midtermGrade, finalGrade, ...otherFields } = grade;

            await gradesCollection.updateOne(
                { studentIDNumber: studentIDNumber, CourseID: CourseID },
                { $set: { midtermGrade, finalGrade, ...otherFields } },
                { upsert: true }
            );
        }

        // Delete the uploaded file after successful processing
        fs.unlink(gradesFile.path, (err) => {
            if (err) console.error('Error deleting uploaded file:', err);
        });

        res.json({ success: true, message: 'Grades uploaded and stored successfully.' });
    } catch (error) {
        console.error('Error uploading grades:', error);

        // Ensure the file is deleted even if an error occurs
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }

        res.status(500).json({ success: false, message: 'An internal server error occurred while uploading grades.' });
    }
});

// Fetch user details route
app.get('/user-details', isAuthenticated, async (req, res) => {
    console.log("Session in /user-details:", req.session);
    try {
        // Find the user by session ID
        const studentIDNumber = req.session.studentIDNumber;
        
        if (!studentIDNumber) {
            return res.status(401).json({ success: false, message: 'Unauthorized access.' });
        }

        // Fetch user details from the database
        const user = await usersCollection.findOne(
            { studentIDNumber: studentIDNumber }, 
            { projection: { firstName: 1, lastName: 1, studentIDNumber: 1, role: 1 } }
        );

        if (!user) {
            console.error('User not found in tblUser:', studentIDNumber); // Debug log
            return res.status(404).json({ success: false, message: 'Invalid student ID or password.' });
        }     
        

        // Convert createdAt to Asia/Manila timezone
        const createdAtManila = user.createdAt
            ? format(user.createdAt, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone: 'Asia/Manila' })
            : null;
        
        console.log('User Details:', user);
        // Return only necessary details (e.g., firstName and lastName)
        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                studentIDNumber: user.studentIDNumber,
                role: user.role // <-- include role here
            }
        });
    } catch (error) {
        console.error('Error fetching user details(server/user-details):', error);
        res.status(500).json({ success: false, message: 'Error fetching user details.' });
    }
});

app.get('/signup', (req, res) => {
    res.redirect('/signup.html'); // Replace with your actual signup page
});





app.get('/session-check', (req, res) => {
    console.log('Session data:', req.session); // Log session data for debugging
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, role: req.session.role });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

  
function isAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') {
        next();
    } else {
        res.status(403).sendFile(__dirname + '/public/403.html');
    }
}

function parseCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                console.log('Parsed Row:', data); // Log each parsed row
                results.push(data);
            })
            .on('end', () => {
                console.log('All Parsed Results:', results); // Log entire array after parsing
                resolve(results);
            })
            .on('error', (error) => {
                console.error('Error parsing CSV:', error);
                reject(error);
            });
    });
}





    // Middleware to check if user is authenticated
    function isAuthenticated(req, res, next) {
        if (req.session && req.session.userId) {
            next();
        } else {
            res.status(401).sendFile(__dirname + '/public/login.html');
        }
    }


    // Protect the dashboard route
    app.get('/dashboard', isAuthenticated, (req, res) => {
        res.sendFile(__dirname + '/public/dashboard.html');
    });
    app.get('/attendance', isAuthenticated, (req, res) => {
        res.sendFile(__dirname + '/public/attendance.html');
    });
    app.get('/activities', isAuthenticated, (req, res) => {
        res.sendFile(__dirname + '/public/activities.html');
    }); 


    app.get('/get-grades/:studentIDNumber', isAuthenticated, async (req, res) => {
        const studentIDNumber = req.params.studentIDNumber;
        console.log('/get-grades/ API called with studentIDNumber:', studentIDNumber); // Debug log
    
        try {
            const grades = await client.db('myDatabase').collection('tblGrades')
                .find({ studentIDNumber: studentIDNumber }).toArray();
    
            console.log('Fetched grades:', grades); // Debug log
    
            if (grades.length === 0) {
                return res.status(404).json({ success: false, message: 'No grades found for this student ID.' });
            }
    
            // Map the results to a standardized array format
            const gradeDataArray = grades.map(grade => ({
                midtermAttendance: grade.MA || 'N/A',
                finalsAttendance: grade.FA || 'N/A',
                midtermClassStanding: grade.MCS || 'N/A',
                finalsClassStanding: grade.FCS || 'N/A',
                midtermExam: grade.ME || 'N/A',
                finalExam: grade.FE || 'N/A',
                midtermGrade: grade.MG || 'N/A',
                finalGrade: grade.FG || 'N/A',
                transmutedMidtermGrade: grade.TMG || 'N/A',
                transmutedFinalGrade: grade.MFG || 'N/A',
                totalFinalGrade: grade.TFG || 'N/A',
                courseID: grade.CourseID || 'N/A',
                courseDescription: grade.CourseDescription || 'N/A',
                createdAt: grade.createdAt
                    ? format(grade.createdAt, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone: 'Asia/Manila' })
                    : null, // Convert to Asia/Manila timezone                
            }));
    
            // Return the array of grade data for each course
            res.json({ success: true, gradeDataArray });
        } catch (error) {
            console.error('Error fetching grades:', error);
            res.status(500).json({ success: false, message: 'An error occurred while fetching grades.' });
        }
    });
    
    

    // Search for students based on different criteria
// Search for students based on different criteria
app.get('/search', isAuthenticated, async (req, res) => {
    
    try {
        const { query } = req.query; // Get search query from request


            // Ensure query is provided
        if (!query) {
            return res.status(400).json({ success: false, message: 'Search query is required.' });
        }


        let userCriteria = {};
        let gradeCriteria = {};

        // If query is '*', fetch all records
        if (query === '*') {
            userCriteria = {}; // Match all documents
            gradeCriteria = {}; // Match all grades
        } else {
            // Define search criteria to check multiple fields
            userCriteria = {
                $or: [
                    { studentIDNumber: { $regex: query, $options: 'i' } },
                    { emaildb: { $regex: query, $options: 'i' } },
                    { firstName: { $regex: query, $options: 'i' } },
                    { lastName: { $regex: query, $options: 'i' } }
                ]
            };

            gradeCriteria = {
                $or: [
                    { studentIDNumber: { $regex: query, $options: 'i' } },
                    { CourseID: { $regex: query, $options: 'i' } },
                    { CourseDescription: { $regex: query, $options: 'i' } }
                ]
            };
        }
    
          // Fetch matching users
        const users = await client.db('myDatabase').collection('tblUser').find(userCriteria).toArray();

          // Fetch matching grades
        const grades = await client.db('myDatabase').collection('tblGrades').find(gradeCriteria).toArray();
/*
          if (query === '*') {
              gradeCriteria = {}; // Match all grades
          } else {
              gradeCriteria = {
                  $or: [
                      { studentIDNumber: { $regex: query, $options: 'i' } },
                      { CourseID: { $regex: query, $options: 'i' } },
                      { CourseDescription: { $regex: query, $options: 'i' } }
                  ]
              };
          }
 */ 
  
          // Associate users with grades
          const results = users.map(user => {
              const userGrades = grades.filter(g => g.studentIDNumber === user.studentIDNumber);
              return userGrades.length > 0 ? userGrades.map(grade => ({
                  studentIDNumber: user.studentIDNumber,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  CourseID: grade.CourseID || 'N/A',
                  CourseDescription: grade.CourseDescription || 'N/A',
                  MG: grade.MG || 'N/A',
                  FG: grade.FG || 'N/A'
              })) : [{
                  studentIDNumber: user.studentIDNumber,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  CourseID: 'N/A',
                  CourseDescription: 'N/A',
                  MG: 'N/A',
                  FG: 'N/A'
              }];
          }).flat(); // Flatten the array of arrays
  
          if (results.length === 0) {
              return res.json({ success: false, message: 'No matching records found.' });
          }
        
          //const users = await client.db('myDatabase').collection('tblUser').find(userCriteria).toArray();
          // Send the results
          res.json({ success: true, results });
      } catch (error) {
          console.error('Error performing search:', error);
          res.status(500).json({ success: false, message: 'An error occurred while searching.' });
      }
  });



// Error handler should be placed after all routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// Fetch Courses for a Student
app.get('/get-courses/:studentIDNumber', isAuthenticated, async (req, res) => {
    const studentIDNumber = req.params.studentIDNumber;
    console.log('/get-courses/ API called with studentIDNumber:', studentIDNumber); // Debug log

    try {
        // Fetch distinct course IDs and descriptions from tblGrades or tblAttendance
        const coursesFromGrades = await client.db('myDatabase').collection('tblGrades')
            .find({ studentIDNumber: studentIDNumber })
            .project({ courseID: 1, courseDescription: 1 })
            .toArray();

        const coursesFromAttendance = await client.db('myDatabase').collection('tblAttendance')
            .find({ studentIDNumber: studentIDNumber })
            .project({ courseID: 1, courseDescription: 1 })
            .toArray();

        // Combine and remove duplicates
        const courses = [...coursesFromGrades, ...coursesFromAttendance];
        const uniqueCourses = [];
        const courseMap = new Map();

        courses.forEach(course => {
            if (!courseMap.has(course.courseID)) {
                courseMap.set(course.courseID, true);
                uniqueCourses.push({
                    courseID: course.courseID,
                    courseDescription: course.courseDescription
                });
            }
        });

        if (uniqueCourses.length === 0) {
            return res.status(404).json({ success: false, message: 'No courses found for this student ID.' });
        }

        res.json({ 
            success: true, 
            courseDataArray: uniqueCourses.map(course => ({
                courseID: course.courseID || "", // Default to empty string
                courseDescription: course.courseDescription || "" // Default to empty string
            }))
        });
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching courses.' });
    }
});




// Log user activity
app.post('/api/log-user', isAuthenticated, async (req, res) => {
    const { studentIDNumber } = req.session; // Retrieve logged-in user's ID from session

    try {
        if (!studentIDNumber) {
            return res.status(400).json({ success: false, message: 'Student ID is required to log user activity.' });
        }

        const user = await usersCollection.findOne(
            { studentIDNumber },
            { projection: { firstName: 1, lastName: 1 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Create the log object
        const log = {
            studentIDNumber,
            name: `${user.firstName} ${user.lastName}`,
            timestamp: new Date(),
        };

        // Insert the log into tblLogs
        const result = await logsCollection.insertOne(log);

        if (result.acknowledged) {
            res.json({ success: true, message: 'User activity logged successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to log user activity.' });
        }
    } catch (error) {
        console.error('Error logging user activity:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Rate limiter for comment posting
const commentLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { success: false, message: 'Too many comments submitted. Please try again later.' }
});

// POST route to submit comments
app.post('/api/comments/:blogId', commentLimiter, async (req, res) => {
    const { blogId } = req.params;
    const { comment, isAnonymous } = req.body;
    const userId = req.session ? req.session.userId : null;
    const studentIDNumber = req.session ? req.session.studentIDNumber : null;

        // Log incoming data for debugging
        console.log('Received POST request to /api/comments/:blogId');
        console.log('blogId:', blogId);
        console.log('comment:', comment);
        console.log('isAnonymous:', isAnonymous);
        console.log('userId:', userId, 'type:', typeof userId);
        console.log('studentIDNumber:', studentIDNumber);

    try {
        if (!comment || comment.trim() === '') {
            return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
        }
        // Ensure isAnonymous is a boolean
        const isAnonymousBool = isAnonymous === true || isAnonymous === 'true';

        // Sanitize the comment
        const sanitizedComment = filter.clean(comment);

        let username = 'Anonymous';

        if (userId && !isAnonymousBool && ObjectId.isValid(userId)) {
            // Fetch user details
            const user = await usersCollection.findOne(
                { _id: new ObjectId(userId) },
                { projection: { firstName: 1 } }
            );

            if (user) {
                username = user.firstName;
            } else {
                // User not found, handle accordingly
                username = 'Unknown User';
            }
        } else if (userId && !isAnonymousBool) {
            // Handle invalid userId, possibly return an error or set username to 'Unknown User'
            console.error('Invalid userId:', userId);
            return res.status(400).json({ success: false, message: 'Invalid user ID.' });
        
        }

        const newComment = {
            blogId,
            userId: isAnonymousBool ? null : userId,
            studentIDNumber: isAnonymousBool ? null : studentIDNumber, // Include studentIDNumber
            username: validator.escape(username),
            comment: validator.escape(sanitizedComment),
            isAnonymous: isAnonymousBool,
            createdAt: new Date()
        };

        const result = await commentsCollection.insertOne(newComment);

        if (result.acknowledged) {
            res.json({ success: true, message: 'Comment posted successfully.' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to post comment.' });
        }
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ success: false, message: 'An error occurred while posting your comment.' });
    }
});

// GET route to fetch comments
app.get('/api/comments/:blogId', async (req, res) => {
    const { blogId } = req.params;

    try {
        // Fetch comments from the database
        const comments = await commentsCollection.find({ blogId }).sort({ createdAt: -1 }).toArray();

        res.json({ success: true, comments });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching comments.' });
    }
});

// POST /api/blogs - Create a new blog post
app.post('/api/blogs', async (req, res) => {
    try {
      const { title, slug, content, author } = req.body;
  
      // Basic validation
      if (!title || !slug || !content) {
        return res.status(400).json({
          success: false,
          message: 'title, slug, and content are required.'
        });
      }
  
      // Check if slug already exists
      const existing = await blogCollection.findOne({ slug });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'A blog with this slug already exists.'
        });
      }
  
      const newPost = {
        title,
        slug,
        content,
        author: author || 'Anonymous',
        createdAt: new Date(),
        updatedAt: new Date()
      };
  
      const result = await blogCollection.insertOne(newPost);
      if (result.acknowledged) {
        return res.status(201).json({ success: true, blogPost: newPost });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to create blog post.' });
      }
    } catch (error) {
      console.error('Error creating blog post:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

// Add near your other API routes
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.userId) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

  app.get('/blogs/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'blogs', blogId + '.html'));
  });
  app.get('/lessons/mst24/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'lessons','mst24', blogId + '.html'));
  });
    app.get('/lessons/tailwind/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'lessons','tailwind', blogId + '.html'));
  });
  app.get('/events/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'events', blogId + '.html'));
  });
  app.get('/books/the-way-of-the-shepherd/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'books','the-way-of-the-shepherd', blogId + '.html'));
  });
app.get('/blogs/tech-comparison/:slug', (req, res, next) => {
    const slug = req.params.slug;
    const filePath = path.join(__dirname, 'public', 'blogs', 'tech-comparison', `${slug}.html`);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return next(); // File doesn't exist, continue to 404
        res.sendFile(filePath);
    });
});
  // Serve ads.txt file dynamically
app.get("/ads.txt", (req, res) => {
    res.type("text/plain");
    res.send("google.com, pub-4537208011192461, DIRECT, f08c47fec0942fa0");
});

// Serve HTML files without .html extension
app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    // Prevent directory traversal
    if (!/^[a-zA-Z0-9\-_]+$/.test(page)) return next();
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return next(); // File doesn't exist, continue to 404
        res.sendFile(filePath);
    });
});
app.get('/:folder/:page', (req, res, next) => {
    const { folder, page } = req.params;
    if (!/^[a-zA-Z0-9\-_]+$/.test(folder) || !/^[a-zA-Z0-9\-_]+$/.test(page)) return next();
    const filePath = path.join(__dirname, 'public', folder, `${page}.html`);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return next();
        res.sendFile(filePath);
    });
});
// Serve 404 page for non-existent routes
app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/public/404.html'); // Ensure the file path is correct
});
//app.use(eventsApi);
