require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const sgMail = require('@sendgrid/mail');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

const API_BASE_URL = 'https://hellograde.onrender.com';

// Security middleware
app.use(helmet());

// Configure CORS appropriately
app.use(cors({
    origin: ['https://hellograde.onrender.com', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', 'https://4hprojects.github.io'],
    methods: ['GET', 'POST'],
    credentials: true
}));

const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let usersCollection;

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
        maxAge: 30 * 60 * 1000 // 30 minutes session expiry
    }
}));

// Helper Functions
function hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hashSync(password, saltRounds);
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
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again after 30 minutes.',
    handler: function (req, res, next, options) {
        res.status(options.statusCode).json({ success: false, message: options.message });
    }
});

// Connect to MongoDB and initialize the usersCollection
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const database = client.db('myDatabase');
        usersCollection = database.collection('tblUser');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}

// Call the database connection function
connectToDatabase();

// Place all route definitions here

// Sign Up Route
app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password , studentIDNumber} = req.body;

    try {
        // Input validation
        if (!firstName || !lastName || !email || !password || !studentIDNumber) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Validate email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }

        // Validate password criteria
        if (!isValidPassword(password)) {
            return res.status(400).json({ success: false, message: 'Password must meet all criteria.' });
        }

        // Validate studentIDNumber (must be numeric and max 7 digits)
        if (!/^\d{1,7}$/.test(studentIDNumber)) {
            return res.status(400).json({ success: false, message: 'Student ID must be a number with up to 7 digits.' });
        }

        // Check if the student ID is already registered
        const existingStudentID = await usersCollection.findOne({ studentIDNumber });
        if (existingStudentID) {
            return res.status(400).json({ success: false, message: 'Student ID already exists.' });
        }

        // Check if the email is already registered
        const existingUser = await usersCollection.findOne({ emaildb: email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        // Hash the password
        const hashedPassword = hashPassword(password);

        // Create a new user object
        const newUser = {
            firstName: firstName,
            lastName: lastName,
            emaildb: email,
            password: hashedPassword,
            createdAt: new Date(),
            invalidLoginAttempts: 0,
            accountLockedUntil: null,
            invalidResetAttempts: 0,
            accountDisabled: false,
            role: "student",
            studentIDNumber: studentIDNumber
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
    app.post('/login', loginLimiter, async (req, res) => {
        const { email, password } = req.body;

        try {
            if (!email || !password) {
                return res.status(400).json({ success: false, message: 'Email and password are required.' });
            }

            const user = await usersCollection.findOne({ emaildb: email });
            if (!user) {
                return res.status(400).json({ success: false, message: 'Invalid email or password.' });
            }

            
            // Check if account is locked
            if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
                const remainingTime = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
                return res.status(403).json({ success: false, message: `Account is locked. Try again in ${remainingTime} minutes.` });
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
                        <p>Dear User,</p>
                        <p>Your account has been locked due to multiple unsuccessful login attempts. Please wait 30 minutes before trying again or reset your password if you've forgotten it.</p>
                        <p>Best regards,<br/>HelloGrade Student Portal Team</p>
                    `;
                    await sendEmail(user.emaildb, 'Account Locked', emailContent);

                    return res.status(403).json({ success: false, message: 'Account is locked due to multiple failed login attempts. An email has been sent with further instructions.' });
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
            req.session.userId = user._id;
            req.session.email = user.emaildb;
            req.session.role = user.role;
            req.session.studentIDNumber = user.studentIDNumber; // Store studentIDNumber in the session
            console.log('Session user ID set:', req.session.userId); // Debug log
        // Save the session using a Promise
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) return reject(err);
                resolve();
            });
        });


        // After successful authentication
        await usersCollection.updateOne(
            { _id: user._id },
            { $set: { 
                lastlogintime: new Date()
             } }
        );
        
        // Return response with user role
        res.json({ success: true, role: user.role, message: 'Login successful!' });
        
        } catch (error) {
            console.error('Error during login:', error);
            res.status(500).json({ success: false, message: 'Error during login.' });
        }
    });

    // Logout Route
    app.post('/logout', async (req, res) => {
        const userId = req.session.userId; // Store user ID before destroying the session
        if (!userId) {
            return res.status(400).json({ success: false, message: 'No user is logged in.' });
        }

       // console.log('Logging out user ID:', userId);
        
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

            res.json({ success: true, message: 'A reset code has been sent to your email.' });
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
                return res.status(400).json({ success: false, message: 'Email not found in database.' });
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
        const hashedNewPassword = hashPassword(newPassword);
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

// Fetch user details route
app.get('/user-details', isAuthenticated, async (req, res) => {
    console.log("Session in /user-details:", req.session);
    try {
        // Find the user by session ID
        const email = req.session.email;
        
        if (!email) {
            return res.status(401).json({ success: false, message: 'Unauthorized access.' });
        }

        // Fetch user details from the database
        const user = await usersCollection.findOne(
            { emaildb: email }, 
            { projection: { firstName: 1, lastName: 1, studentIDNumber: 1 } }
        );

        if (!user) {
            console.error('User not found in tblUser:', email); // Debug log
            return res.status(404).json({ success: false, message: 'User not found.' });
        }        
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

app.get('/session-check', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, studentIDNumber: req.session.studentIDNumber });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });
  


    // Middleware to check if user is authenticated
    function isAuthenticated(req, res, next) {
        if (req.session && req.session.userId) {
            next();
        } else {
             // Redirect to login page if not authenticated
             res.status(401).json({ success: false, message: 'Unauthorized access.' });
        }
    }


    // Protect the dashboard route
    app.get('/dashboard', isAuthenticated, (req, res) => {
        res.sendFile(__dirname + '/public/dashboard.html');
    });

    // Fetch student grades by studentIDNumber
    app.get('/get-grades/:studentIDNumber', isAuthenticated, async (req, res) => {
        const studentIDNumber = req.params.studentIDNumber;
        console.log('/get-grades/', studentIDNumber);
        try {
            // Query the tblGrades collection for the student
            const grades = await client.db('myDatabase').collection('tblGrades').findOne({ studentIDNumber: studentIDNumber });

            if (!grades) {
                return res.status(404).json({ success: false, message: 'Grades not found for the specified student ID.' });
            }

            // Construct the response with the required grade fields
            const gradeData = {
                midtermAttendance: grades.MA || 'N/A',
                finalsAttendance: grades.FA || 'N/A',
                midtermClassStanding: grades.MCS || 'N/A',
                finalsClassStanding: grades.FCS || 'N/A',
                midtermExam: grades.ME || 'N/A',
                finalExam: grades.FE || 'N/A',
                midtermGrade: grades.MG || 'N/A',
                finalGrade: grades.FG || 'N/A',
                transmutedMidtermGrade: grades.TMG || 'N/A',
                transmutedFinalGrade: grades.TFG || 'N/A',
                courseID: grades.CourseID || 'N/A', // Include CourseID
                courseDescription: grades.CourseDescription || 'N/A' // Include CourseDescription
            };

            // Send the grade data as JSON
            res.json({ success: true, gradeData });
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
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
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
