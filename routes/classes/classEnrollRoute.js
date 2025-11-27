const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = function classEnrollRoute(classesCollection, isAuthenticated, isTeacherOrAdmin) {
  const router = express.Router();

  // PUT /api/classes/:classId/enroll
  // Body: { action: "add" | "remove", studentIDs: ["1000001","1000002"] }
  router.put('/classes/:classId/enroll', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const { classId } = req.params;
      const { action, studentIDs } = req.body;

      if (!ObjectId.isValid(classId)) {
        return res.status(400).json({ success:false, message:'Invalid classId.' });
      }
      if (!['add','remove'].includes(action)) {
        return res.status(400).json({ success:false, message:'action must be add or remove.' });
      }
      if (!Array.isArray(studentIDs) || studentIDs.length === 0) {
        return res.status(400).json({ success:false, message:'studentIDs must be a non-empty array.' });
      }

      const cleaned = [...new Set(studentIDs
        .filter(s => typeof s === 'string')
        .map(s => s.trim())
        .filter(Boolean))];

      if (cleaned.length === 0) {
        return res.status(400).json({ success:false, message:'No valid student IDs.' });
      }

      const cls = await classesCollection.findOne({ _id: new ObjectId(classId) });
      if (!cls) {
        return res.status(404).json({ success:false, message:'Class not found.' });
      }

      let updateResult;
      if (action === 'add') {
        updateResult = await classesCollection.updateOne(
          { _id: cls._id },
            { $addToSet: { students: { $each: cleaned } } }
        );
      } else {
        updateResult = await classesCollection.updateOne(
          { _id: cls._id },
          { $pull: { students: { $in: cleaned } } }
        );
      }

      const updated = await classesCollection.findOne(
        { _id: cls._id },
        { projection: { students:1 } }
      );
      const rosterCount = Array.isArray(updated?.students) ? updated.students.length : 0;

      return res.json({
        success:true,
        action,
        affectedCount: updateResult.modifiedCount,
        rosterCount,
        message: action === 'add'
          ? 'Students added (duplicates ignored).'
          : 'Students removed (non-members ignored).'
      });
    } catch (err) {
      console.error('Enroll route error', err);
      return res.status(500).json({ success:false, message:'Internal error.' });
    }
  });

  return router;
};