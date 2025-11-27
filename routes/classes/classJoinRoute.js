const express = require('express');

module.exports = function classJoinRoute(classesCollection, isAuthenticated) {
  const router = express.Router();

  router.post('/classes/join', isAuthenticated, async (req, res) => {
    try {
      if (!req.session || req.session.role !== 'student') {
        return res.status(403).json({ success:false, message:'Forbidden. Only students can join classes.' });
      }
      const { classCode } = req.body;
      if (!classCode || typeof classCode !== 'string') {
        return res.status(400).json({ success:false, message:'classCode required.' });
      }
      const codeTrim = classCode.trim();
      const cls = await classesCollection.findOne({ classCode: codeTrim });
      if (!cls) {
        return res.status(404).json({ success:false, message:'Class not found.' });
      }
      const studentIDNumber = req.session.studentIDNumber;
      if (!studentIDNumber) {
        return res.status(400).json({ success:false, message:'Missing studentIDNumber in session.' });
      }
      const upd = await classesCollection.updateOne(
        { _id: cls._id },
        { $addToSet: { students: studentIDNumber } }
      );
      if (!upd.modifiedCount) {
        return res.json({ success:true, message:'Already joined.' });
      }
      return res.json({ success:true, message:`Joined class ${codeTrim} successfully.` });
    } catch (err) {
      console.error('Join error', err);
      return res.status(500).json({ success:false, message:'Internal error.' });
    }
  });

  return router;
};