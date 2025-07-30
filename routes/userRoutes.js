// userRoutes.js
const express = require('express');
const { getUsersCollection } = require('../db');
const { isAuthenticated, isAdmin} = require('../middlewares/authMiddleware');
const { format } = require('date-fns-tz');
const router = express.Router();

// Get user details
router.get('/user-details', isAuthenticated, async (req, res) => {
    console.log("Session in /user-details:", req.session);
    try {
        const studentIDNumber = req.session.studentIDNumber;
        if (!studentIDNumber) {
            return res.status(401).json({ success: false, message: 'Unauthorized access.' });
        }

        const usersCollection = getUsersCollection();
        const user = await usersCollection.findOne(
            { studentIDNumber },
            { projection: { firstName: 1, lastName: 1, studentIDNumber: 1, createdAt: 1 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const createdAtManila = user.createdAt
            ? format(user.createdAt, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone: 'Asia/Manila' })
            : null;

        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                studentIDNumber: user.studentIDNumber,
                createdAt: createdAtManila
            }
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Update user profile (optional)
router.put('/update-profile', isAuthenticated, async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const studentIDNumber = req.session.studentIDNumber;

        if (!firstName || !lastName) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const usersCollection = getUsersCollection();
        const result = await usersCollection.updateOne(
            { studentIDNumber },
            { $set: { firstName, lastName, updatedAt: new Date() } }
        );

        if (result.modifiedCount > 0) {
            res.json({ success: true, message: 'Profile updated successfully.' });
        } else {
            res.status(404).json({ success: false, message: 'User not found.' });
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

// Get all users (Admin only)
router.get('/all-users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const usersCollection = getUsersCollection();
        const users = await usersCollection.find({}, { projection: { firstName: 1, lastName: 1, studentIDNumber: 1 } }).toArray();
        res.json({ success: true, users });
    } catch (error) {
        console.error('Error fetching all users:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

module.exports = router;
