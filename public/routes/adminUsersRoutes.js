// adminUsersRoutes.js
const express = require('express');
const { ObjectId } = require('mongodb');

function createAdminUsersRoutes(usersCollection, isAuthenticated, isAdmin) {
  const router = express.Router();

  /**
   * GET /api/admin/users 
   * Fetch all users (with minimal fields).
   */
  router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Only fetch relevant fields
      const projection = {
        studentIDNumber: 1,
        firstName: 1,
        lastName: 1,
        accountDisabled: 1,
        accountLockedUntil: 1,
        resetCode: 1,
        resetCodeLockUntil: 1,
        resetExpires: 1,
        resetCodeVerified: 1
        // Omit password and other sensitive fields here
      };

      const users = await usersCollection.find({}, { projection }).toArray();
      return res.json({ success: true, users });
    } catch (error) {
      console.error('Error fetching admin user list:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * PUT /api/admin/users/reset-fields
   * Reset key fields for an array of userIds
   */
  router.put('/reset-fields', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No user IDs provided.' });
      }

      const objectIds = userIds.map(id => new ObjectId(id));

      // Fields to reset
      const updateDoc = {
        $set: {
          password: null,
          accountDisabled: false,
          accountLockedUntil: null,
          resetCode: null,
          resetCodeLockUntil: null,
          resetExpires: null,
          resetCodeVerified: false,
          invalidLoginAttempts: 0,
          invalidResetAttempts: 0
        }
      };

      const result = await usersCollection.updateMany(
        { _id: { $in: objectIds } },
        updateDoc
      );

      if (!result.acknowledged) {
        return res.status(500).json({ success: false, message: 'Failed to reset fields.' });
      }

      return res.json({ success: true, message: 'Fields reset successfully.' });
    } catch (error) {
      console.error('Error resetting fields for users:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/admin/users
   * (Optional) Completely remove user documents from DB
   */
  router.delete('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userIds } = req.body;
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No user IDs provided.' });
      }

      const objectIds = userIds.map(id => new ObjectId(id));
      const result = await usersCollection.deleteMany({ _id: { $in: objectIds } });

      if (!result.acknowledged) {
        return res.status(500).json({ success: false, message: 'Failed to delete users.' });
      }

      return res.json({ success: true, message: 'User(s) deleted successfully.' });
    } catch (error) {
      console.error('Error deleting users:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  return router;
}

module.exports = createAdminUsersRoutes;
