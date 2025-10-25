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

const { format, utcToZonedTime } = require('date-fns-tz'); 

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
const userSignInOutApi = require('./routes/userSignInOutApi');
const auditTrailApi = require('./routes/auditTrailApi');
const byteFunRunRoutes = require('./routes/byteFunRunRoutes'); 
const gradesRoutes = require('./routes/gradesRoutes'); // <-- add
const protectHtml = require('./middleware/protectHtml');
const classRecordsRoutes = require('./routes/classRecordsRoutes');
const classRecordsPageRoutes = require('./routes/classRecordsPageRoutes');

app.use('/api', classRecordsRoutes);
app.use('/', classRecordsPageRoutes(__dirname)); 
app.use('/api', require('./routes/reportsApi'));
app.use('/api', auditTrailApi);
app.use('/api', userSignInOutApi);
app.use('/api/payments-report', paymentsReportApi);
app.use('/resend-confirmation', resendConfirmationApi);
app.use('/confirm-email', confirmEmailApi);
app.use('/signup', signupApi);
// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.disable('x-powered-by');

// NOTE: mount protectHtml AFTER auth routes so login POST isn't blocked
// REMOVE or comment out this early mount:
// app.use(protectHtml(__dirname));

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
let activityAssignmentsCollection; // NEW
let classQuizCollection; 

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



app.use('/api', emailApi);
app.use('/api', userRegisterApi);
app.use('/api/bulk-register', bulkRegisterApi);
app.use('/api/events', eventsApi);
app.use('/api', byteFunRunRoutes);



app.use('/api/register', registerApi);  // for POST registration
app.use('/api/attendance', attendanceApi);
app.use('/api', reportsApi);
app.use('/api', paymentReportsApi);
app.use('/api/attendance-summary', attendanceSummaryApi);

//app.use(protectHtml(__dirname));
//app.use('/api/events', require('./routes/eventsApi'));
app.use(express.static(path.join(__dirname, "public")));

// Call the database connection function
connectToDatabase()
  .then(() => {
    console.log('DB connected, now attach routes.');

    const makeAuthRoutes = require('./routes/authRoutes');
    const authRouter = makeAuthRoutes({ usersCollection, logsCollection, bcrypt });
    app.use('/auth', authRouter);

    // Public page route BEFORE protectHtml so it stays public
    app.get('/activity/random', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'activity', 'random.html'));
    });

    // Keep protectHtml AFTER auth
    app.use(protectHtml(__dirname));

    // Attach admin routes
    const adminUsersRoutes = require('./routes/adminUsersRoutes');
    app.use('/api/admin/users', adminUsersRoutes(usersCollection, isAuthenticated, isAdmin));

    const assignmentsRoutes = require('./routes/assignmentsRoutes');
    app.use('/api', assignmentsRoutes(
      { classQuizCollection, quizzesCollection, classesCollection, ObjectId },
      { isAuthenticated, isTeacherOrAdmin }
    ));

    // Re-mount gradesRoutes AFTER auth so it doesn't catch /login
    app.use('/', gradesRoutes(client, isAuthenticated)); // <-- moved here
    const classesQuizzesRoutes = require('./routes/classesQuizzesRoutes');
    app.use('/api', classesQuizzesRoutes(
      {
        classesCollection,
        quizzesCollection,
        attemptsCollection,
        countersCollection,
        classQuizCollection, // <-- pass in
        ObjectId
      },
      {
        isAuthenticated,
        isTeacherOrAdmin,
        isAdmin // <-- pass in
      }
    ));

    const blogsCommentsRoutes = require('./routes/blogsCommentsRoutes');
    app.use('/api', blogsCommentsRoutes({
      usersCollection,
      commentsCollection,
      blogCollection,
      ObjectId
    }));


    const lessonQuizRoutes = require('./routes/lessonQuizRoutes');
    app.use('/api/lesson-quiz', lessonQuizRoutes(client));

    // Mount activity random routes (public)
    const activityRandomRoutes = require('./routes/activityRandomRoutes');
    app.use('/api', activityRandomRoutes({ activityAssignmentsCollection, sendEmail }));

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('DB connect failed:', err);
    process.exit(1);
  });

const { fetchClassSectionFromMasterList, fetchClassRecordFromSheet } = require('./utils/googleSheetsUtils');

// Add near your other page routes, after isAuthenticated/isTeacherOrAdmin are defined
app.get('/teacher/dashboard', isAuthenticated, isTeacherOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher', 'dashboard.html'));
});

app.get('/teacher/quizzes', isAuthenticated, isTeacherOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher', 'quizzes.html'));
});

app.get('/teacher/quizzes/new', isAuthenticated, isTeacherOrAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher', 'quizzes_new.html'));
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

// Connect to MongoDB and initialize collections
async function connectToDatabase() {
  try {
    if (!mongoUri) throw new Error('MONGODB_URI env var is missing');

    await client.connect();

    // Resolve DB name from env or URI path, fallback to 'hellograde'
    const dbNameFromUri = (() => {
      try {
        const u = new URL(mongoUri);
        return u.pathname && u.pathname !== '/' ? decodeURIComponent(u.pathname.slice(1)) : undefined;
      } catch {
        return undefined;
      }
    })();
    const dbName = process.env.MONGODB_DB || dbNameFromUri || 'hellograde';
    const db = client.db(dbName);

    // Initialize needed collections
    activityAssignmentsCollection = db.collection('activityAssignments');
    await activityAssignmentsCollection.createIndex({ email: 1, createdAt: -1 });

    // Initialize others your code expects (only if not set yet)
    usersCollection = usersCollection || db.collection('users');
    logsCollection = logsCollection || db.collection('tblLogs');
    gradesCollection = gradesCollection || db.collection('grades');
    commentsCollection = commentsCollection || db.collection('comments');
    blogCollection = blogCollection || db.collection('blogs');
    quizzesCollection = quizzesCollection || db.collection('quizzes');
    attemptsCollection = attemptsCollection || db.collection('attempts');
    classesCollection = classesCollection || db.collection('classes');
    countersCollection = countersCollection || db.collection('counters');
    activityAssignmentsCollection = activityAssignmentsCollection || db.collection('activityAssignments');
    // ADD this to avoid ReferenceError when mounting routes that need it
    classQuizCollection = classQuizCollection || db.collection('classQuizzes'); // <-- added

    console.log(`Connected to MongoDB (db: ${dbName})`);
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    throw err;
  }
}



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

function convertToTimezone(date, timeZone) {
    return new Date(
        date.toLocaleString('en-US', { timeZone: timeZone })
    );
}

function isValidObjectId(id) {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
}





    
    

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
            { projection: { firstName: 1, lastName: 1, studentIDNumber: 1, role: 1, createdAt: 1 } }
        );

        if (!user) {
            console.error('User not found in tblUser:', studentIDNumber); // Debug log
            return res.status(404).json({ success: false, message: 'Invalid student ID or password.' });
        }     

        // Convert createdAt to Asia/Manila timezone
        const createdAtManila = user.createdAt
            ? format(utcToZonedTime(user.createdAt, 'Asia/Manila'), 'yyyy-MM-dd HH:mm:ssXXX', { timeZone: 'Asia/Manila' })
            : null;
        
        console.log('User Details:', user);
        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                studentIDNumber: user.studentIDNumber,
                role: user.role,
                createdAt: createdAtManila
            }
        });
    } catch (error) {
        console.error('Error fetching user details(server/user-details):', error);
        res.status(500).json({ success: false, message: 'Error fetching user details.' });
    }
});

// Signup route
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Session check route
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



    // Search for students based on different criteria
// Search for students based on different criteria
app.get('/search', async (req, res) => {
    
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

// Serve HTML files from any subfolder depth without .html extension
app.get('/*', (req, res, next) => {
  const pathStr = req.path.toLowerCase();

  // Skip protected pages here so they are not served by this wildcard
  if (pathStr === '/dashboard' || pathStr === '/dashboard.html' || pathStr.startsWith('/teacher/')) {
    return next();
  }

  // Remove leading slash and split path
  const segments = req.path.replace(/^\/+/, '').split('/');
  if (!segments.every(seg => /^[a-zA-Z0-9\-_]+$/.test(seg))) return next();

  const filePath = path.join(__dirname, 'public', ...segments) + '.html';
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) return next();
    res.sendFile(filePath);
  });
});

app.get('/:folder/:page', (req, res, next) => {
  const lower = `${req.params.folder}/${req.params.page}`.toLowerCase();

  // Skip protected pages
  if (lower === 'dashboard' || lower.startsWith('teacher/')) {
    return next();
  }

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
