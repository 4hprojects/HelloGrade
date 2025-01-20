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

//const dateFnsTz = require('date-fns-tz');
//const { format, utcToZonedTime } = dateFnsTz;


// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');


// Configure CORS appropriately
//app.use(cors({
//    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000/', 'https://4hprojects.github.io'],
//    methods: ['GET', 'POST'],
//    credentials: true
//}));

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

// Call the database connection function
connectToDatabase();

// Place all route definitions here

// Session management with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: {
        secure: false, // Set to true only if using HTTPS
        httpOnly: true,
        sameSite: 'lax', // Adjust sameSite setting for better compatibility
        maxAge: 1 * 60 * 60 * 1000 // 2 hours
    }
}));

app.get('/api/config', (req, res) => {
    res.json({
        apiKey: process.env.GOOGLE_API_KEY,
        spreadsheetIdAtt: process.env.GOOGLE_SPREADSHEET_ID_ATTENDANCE,
        spreadsheetIdCSMST2025: process.env.GOOGLE_SPREADSHEET_ID_CSMST2025,
    });
});


app.use((req, res, next) => {
    if (req.session && req.session.role) {
        console.log('Session role:', req.session.role); // Debugging
    }
    res.set('Cache-Control', 'no-store');
    next();
});

const { fetchClassSectionFromMasterList, fetchClassRecordFromSheet } = require('./utils/googleSheetsUtils.js');



// Route to fetch ClassRecord from a specific sheet
app.get('/api/getClassRecordFromSheet', async (req, res) => {
  const { studentID, sheetName } = req.query;
  if (!studentID || !sheetName) {
    return res.status(400).json({ success: false, message: 'Student ID and sheet name are required.' });
  }

  try {
    const classRecord = await fetchClassRecordFromSheet(studentID, sheetName);
    res.json({ success: true, data: classRecord });
  } catch (error) {
    console.error('Error fetching class record:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error. Please try again later.' });
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
app.get('/blog', (req, res) => {
    res.sendFile(__dirname + '/public/blogs.html');
  });
app.get('/blogs', (req, res) => {
    res.sendFile(__dirname + '/public/blogs.html');
  });
app.get('/index', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
  });
app.get('/search', (req, res) => {
    res.sendFile(__dirname + '/public/search.html');
  });
app.get('/contact', (req, res) => {
    res.sendFile(__dirname + '/public/contact.html');
  });
app.get('/about', (req, res) => {
    res.sendFile(__dirname + '/public/about.html');
  });
app.get('/help', (req, res) => {
    res.sendFile(__dirname + '/public/help.html');
  });
app.get('/contact', (req, res) => {
    res.sendFile(__dirname + '/public/contact.html');
  });
app.get('/privacy-policy', (req, res) => {
    res.sendFile(__dirname + '/public/privacy-policy.html');
  });
app.get('/terms-and-conditions', (req, res) => {
    res.sendFile(__dirname + '/public/terms-and-conditions.html');
  });
  app.get('/reset-password', (req, res) => {
    res.sendFile(__dirname + '/public/reset-password.html');
  });
  app.get('/classrecords', (req, res) => {
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

async function sendEmail(to, subject, htmlContent) {
    const msg = {
        to: to,
        from: process.env.SENDER_EMAIL,
        subject: subject,
        html: htmlContent
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent to ' + to);
    } catch (error) {
        console.error('Error sending email:', error);
    }
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
                // assignedStudents is empty => means entire class is assigned
                // we must confirm that the classDoc indeed has the student
                const cls = await classesCollection.findOne({ _id: asn.classId, students: studentIDNumber });
                if (cls) {
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


/**
 * Create a new quiz
 * Example of request body:
 * {
 *   "quizTitle": "Sample Quiz",
 *   "description": "This is a sample quiz.",
 *   "questions": [
 *     {
 *       "questionText": "What is 2 + 2?",
 *       "options": ["1", "2", "3", "4"],
 *       "correctAnswer": 3
 *     }
 *   ],
 *   "dueDate": "2025-01-20T23:59:59",  // in ISO (UTC) or your chosen format
 *   "latePenaltyPercent": 40,         // default if not provided
 *   "maxAttempts": 1,                 // default is 1
 *   "duration": 10                    // e.g. 10 minutes (0 if not timed)
 * }
 */
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

//const currentTime = new Date();
//const timeZone = 'Asia/Manila';
//const manilaTime = utcToZonedTime(currentTime, timeZone);
//console.log('Manila Time:', manilaTime);

/**
 * Submit final quiz attempt
 *  We:
 *    1. Confirm ownership
 *    2. Calculate raw score
 *    3. Check if late (submittedAt > dueDate)
 *    4. Apply late penalty
 *    5. Mark isCompleted = true, store finalScore
 *    6. If multiple attempts, compute average - (attempts - 1)
 */

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
        

        // 3. Check late submission
        // convert both times to Asia/Manila before comparing
        // Convert something to Manila time
        //const manilaDateNow = utcToZonedTime(new Date(), 'Asia/Manila');
        //console.log('Manila Date:', manilaDateNow);

        // Use format if needed
        //console.log('Formatted Manila Time:', format(manilaDateNow, 'yyyy-MM-dd HH:mm:ssXXX', {
        //timeZone: 'Asia/Manila',
        //}));

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
/*
        try {
            manilaDateNow = utcToZonedTime(new Date(), 'Asia/Manila');
        } catch (error) {
            console.warn('Timezone conversion failed, using server time as fallback.');
            manilaDateNow = new Date();
        }
        
        
        if (quiz.dueDate) {
            const manilaDueDate = utcToZonedTime(quiz.dueDate, 'Asia/Manila');
            // compare times in ms
            console.log('Due Date:', manilaDueDate);
            if (submittedAt.getTime() > manilaDueDate.getTime()) {
                const penaltyPercent = quiz.latePenaltyPercent || 40;
                const penalty = (penaltyPercent / 100) * totalQuizPoints;
                finalScore = rawScore - penalty;
            }
        }
        console.log('Current time:', new Date());
        console.log('Timezone:', timeZone);
        console.log('Zoned time:', utcToZonedTime(new Date(), timeZone));

*/
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



// Sign Up Route
app.post('/signup', async (req, res) => {
    console.log('Received signup request:', req.body);
    const { firstName, lastName, email, password, confirmPassword, studentIDNumber, termsCheckbox } = req.body;

    // Check if terms are agreed
    if (!termsCheckbox) {
        return res.status(400).json({ success: false, message: 'You must agree to the Terms and Conditions.' });
    }

    try {
        // Input validation
        if (!firstName || !lastName || !email || !password || !confirmPassword || !studentIDNumber) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }
        
        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }
        

        // Validate email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        // Validate password criteria
        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must meet all criteria.' });
        }

        // Validate studentIDNumber
        if (!/^\d{1,7}$/.test(studentIDNumber)) {
            return res.status(400).json({ success: false, message: 'Student ID must be a number with up to 7 digits.' });
        }

        // Check if email already exists
        const existingEmail = await usersCollection.findOne({ emaildb: email });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'The email is already registered. Please log in or reset your password.'
            });
        }

        // Check if student ID already exists
        const existingStudentID = await usersCollection.findOne({ studentIDNumber });
        if (existingStudentID) {
            return res.status(400).json({
                success: false,
                message: 'Student ID already exists. If you think this is a mistake, please contact support.'
            });
        }

        // Hash the password
        const hashedPassword = await hashPassword(password);

        // Create a new user object
        const newUser = {
            firstName,
            lastName,
            emaildb: email,
            password: hashedPassword,
            createdAt: new Date(),
            invalidLoginAttempts: 0,
            accountLockedUntil: null,
            invalidResetAttempts: 0,
            accountDisabled: false,
            role: "student",
            studentIDNumber
        };

        // Insert the new user into the database
        const insertResult = await usersCollection.insertOne(newUser);

        if (insertResult.acknowledged) {
            res.json({ success: true, message: 'Account created successfully!' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create account.' });
        }
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
});



    // Login Route with Rate Limiting
    app.post('/login', async (req, res) => {
        const { studentIDNumber, password } = req.body;

        try {
            if (!studentIDNumber || !password) {
                return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
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


            if (!/^\d{7}$/.test(studentIDNumber)) {
                return res.status(400).json({ success: false, message: 'Student ID must be exactly 7 digits.' });
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
                        <p>Your account has been locked due to multiple unsuccessful login attempts. Please wait 30 minutes before trying again or reset your password if you've forgotten it.</p>
                        <p>Best regards,<br/>HelloGrade Student Portal Team</p>
                    `;
                    await sendEmail(user.emaildb, 'Account Locked', emailContent);
    
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
                // Different response to indicate the email doesn't exist (for testing purposes only)
                return res.status(404).json({ 
                    success: false, 
                    message: 'If that email address is in our database, we will send you an email to reset your password.' 
                });
            }

            // Proceed with sending reset code if email exists
            const resetCode = generateOTP();
            const resetExpires = new Date(Date.now() + 3600000); // Expires in 1 hour

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

            // Send reset code email
            const emailContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your account has been locked due to multiple unsuccessful login attempts. Please wait 30 minutes before trying again or reset your password if you've forgotten it.</p>
            <p>Best regards,<br/>HelloGrade Student Portal Team</p>
        `;
            await sendEmail(email, 'Your Password Reset Code', emailContent);

            res.json({ success: true, message: 'If that email address is in our database, we will send you an email to reset your password.' });
        } catch (error) {
            console.error('Error processing your request:', error);
            res.status(500).json({ success: false, message: 'Error processing your request' });
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

app.post('/upload-attendance', isAuthenticated, isAdmin, upload.single('attendanceFile'), async (req, res) => {
    try {
        const attendanceFile = req.file;
        if (!attendanceFile) {
            console.error("File upload error: No file was uploaded.");
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const attendanceData = await parseCSVFile(attendanceFile.path);

        if (!Array.isArray(attendanceData)) {
            console.error("Parsing error: attendanceData is not an array.");
            fs.unlink(attendanceFile.path, err => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
            return res.status(500).json({ success: false, message: 'Parsing error: attendanceData is not an array' });
        }

        const attendanceCollection = client.db('myDatabase').collection('tblAttendance');

        // Prepare bulk operations
        const bulkOps = attendanceData.map(record => {
            const {
                studentIDNumber,
                courseID,
                courseDescription,
                attDate,
                attTime,
                attStatus,
                attRemarks,
                term
            } = record;

            if (!studentIDNumber || !courseID || !attDate || !attTime || !term) {
                console.error('Invalid record:', record);
                return null; // Skip invalid records
            }

            return {
                updateOne: {
                    filter: {
                        studentIDNumber: studentIDNumber,
                        courseID: courseID,
                        attDate: attDate,
                        attTime: attTime
                    },
                    update: {
                        $set: {
                            courseDescription,
                            attStatus,
                            attRemarks,
                            term
                        }
                    },
                    upsert: true
                }
            };
        }).filter(op => op !== null); // Remove null values

        if (bulkOps.length > 0) {
            await attendanceCollection.bulkWrite(bulkOps);
        } else {
            console.warn('No valid records to process.');
        }

        // Delete the uploaded file
        fs.unlink(attendanceFile.path, err => {
            if (err) console.error('Error deleting uploaded file:', err);
        });

        res.json({ success: true, message: 'Attendance uploaded and stored successfully.' });
    } catch (error) {
        console.error('Error uploading attendance:', error);

        if (req.file) {
            fs.unlink(req.file.path, err => {
                if (err) console.error('Error deleting uploaded file:', err);
            });
        }

        res.status(500).json({ success: false, message: 'An internal server error occurred while uploading attendance.' });
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
            { projection: { firstName: 1, lastName: 1, studentIDNumber: 1, password: 1 } }
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
                studentIDNumber: user.studentIDNumber
            }
        });
    } catch (error) {
        console.error('Error fetching user details(server/user-details):', error);
        res.status(500).json({ success: false, message: 'Error fetching user details.' });
    }
});

app.use((req, res, next) => {
    if (req.session && req.session.role) {
        console.log('Session role:', req.session.role); // Debugging
    }
    res.set('Cache-Control', 'no-store');
    next();
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

// Fetch Attendance Data for a Student and Course
app.get('/get-attendance/:studentIDNumber/:courseID', isAuthenticated, async (req, res) => {
    const studentIDNumber = req.params.studentIDNumber;
    const courseID = req.params.courseID;
    console.log('/get-attendance/ API called with studentIDNumber:', studentIDNumber, 'courseID:', courseID); // Debug log

    try {
        const attendanceRecords = await client.db('myDatabase').collection('tblAttendance')
            .find({ studentIDNumber: studentIDNumber, courseID: courseID })
            .project({ _id: 0, attDate: 1, attTime: 1, attStatus: 1, attRemarks: 1, term: 1 })
            .sort({ attDate: 1, attTime: 1 })
            .toArray();

        if (attendanceRecords.length === 0) {
            return res.json({ success: true, attendanceDataArray: [] });
        }

        res.json({ 
            success: true, 
            attendanceDataArray: attendanceRecords.map(record => ({
                attDate: record.attDate || "", // Default to empty string
                attTime: record.attTime || "", // Default to empty string
                attStatus: record.attStatus || "", // Default to empty string
                attRemarks: record.attRemarks || "", // Default to empty string
                term: record.term || "" // Default to empty string
            }))
        });
        
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ success: false, message: 'An error occurred while fetching attendance.' });
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



  app.get('/blogs/:blogId', (req, res) => {
    const { blogId } = req.params;     // e.g. 'blog6'
    // If you keep the file as blog6.html in /public/blogs:
    res.sendFile(path.join(__dirname, 'public', 'blogs', blogId + '.html'));
  });
  

  
  app.get('/sitemap.xml', async (req, res) => {
    const staticUrls = [
        { loc: '/login', changefreq: 'daily', priority: 0.8 },
        { loc: '/blog', changefreq: 'weekly', priority: 0.9 },
        { loc: '/index', changefreq: 'daily', priority: 1.0 },
        { loc: '/search', changefreq: 'weekly', priority: 0.6 },
        { loc: '/contact', changefreq: 'monthly', priority: 0.5 },
        { loc: '/about', changefreq: 'monthly', priority: 0.5 },
        { loc: '/help', changefreq: 'monthly', priority: 0.5 },
        { loc: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
        { loc: '/terms-and-conditions', changefreq: 'yearly', priority: 0.3 },
        { loc: '/reset-password', changefreq: 'weekly', priority: 0.6 }
    ];

    const baseUrl = 'https://hellograde.online';

    let dynamicUrls = [];

    try {
        // Fetch dynamic URLs for blogs
        const blogs = await blogCollection.find({}).toArray();
        dynamicUrls = blogs.map(blog => ({
            loc: `/blogs/${blog.slug}`,
            changefreq: 'weekly',
            priority: 0.8
        }));
    } catch (error) {
        console.error('Error fetching dynamic URLs:', error);
    }

    const urls = [...staticUrls, ...dynamicUrls];

    const sitemap = `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            ${urls
                .map(url => `
                    <url>
                        <loc>${baseUrl}${url.loc}</loc>
                        <changefreq>${url.changefreq}</changefreq>
                        <priority>${url.priority}</priority>
                    </url>
                `)
                .join('')}
        </urlset>
    `;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap.trim());
});


// Serve 404 page for non-existent routes
app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/public/404.html'); // Ensure the file path is correct
});



// Start the server after defining routes and middleware
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
