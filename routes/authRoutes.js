//authRoutes.js
const express = require('express');

module.exports = ({ usersCollection, logsCollection, bcrypt }) => {
  const router = express.Router();

  // Verify mount
  router.get('/ping', (req, res) => res.json({ ok: true }));

  // POST /auth/login
  router.post('/login', async (req, res) => {
    try {
      const { studentIDNumber, password } = req.body || {};
      if (!studentIDNumber || !password) {
        return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
      }

      const id = String(studentIDNumber).trim();
      const user = await usersCollection.findOne({ studentIDNumber: id });
      if (!user || !user.password) {
        return res.status(401).json({ success: false, message: 'Invalid student ID or password.' });
      }

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) {
        return res.status(401).json({ success: false, message: 'Invalid student ID or password.' });
      }

      // Session
      req.session.userId = String(user._id);
      req.session.studentIDNumber = user.studentIDNumber;
      req.session.role = user.role || 'student';

      // Optional log
      try {
        await logsCollection.insertOne({
          type: 'login',
          studentIDNumber: user.studentIDNumber,
          role: req.session.role,
          at: new Date()
        });
      } catch (_) {}

      res.json({ success: true, role: req.session.role });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  // POST /auth/logout
  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  return router;
};
