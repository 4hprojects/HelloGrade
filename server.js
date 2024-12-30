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
const { format } = require('date-fns-tz');

const fs = require('fs');
const csv = require('csv-parser'); // Ensure csv-parser is installed

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
const { ObjectId } = require('mongodb');



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
let commentsCollection; // Add this line

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
        maxAge: 2 * 60 * 60 * 1000 // 2 hours
    }
}));

app.use((req, res, next) => {
    const host = req.headers.host;
    if (host === 'hellograde.onrender.com') {
        return res.redirect(301, `https://hellograde.online${req.url}`);
    }
    next();
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

        // Initialize SendGrid with API key
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1); // Exit the process if unable to connect
    }
}



app.get('/login.html', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
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
                <p>Dear User,</p>
                <p>Your password reset code is: <strong>${resetCode}</strong>.</p>
                <p>This code will expire in 1 hour.</p>
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

// Serve 404 page for non-existent routes
app.use((req, res) => {
    res.status(404).sendFile(__dirname + '/public/404.html'); // Ensure the file path is correct
});



// Start the server after defining routes and middleware
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
