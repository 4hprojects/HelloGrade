//gradesRoute.js
const express = require('express');
const { format } = require('date-fns-tz');

// Export a factory so we can inject client and isAuthenticated from server.js
module.exports = function gradesRoutes(client, isAuthenticated) {
  const router = express.Router();

  // GET /get-grades/:studentIDNumber
  router.get('/get-grades/:studentIDNumber', isAuthenticated, async (req, res) => {
    const { studentIDNumber } = req.params;
    console.log('/get-grades/ API called with studentIDNumber:', studentIDNumber);

    try {
      const grades = await client
        .db('myDatabase')
        .collection('tblGrades')
        .find({ studentIDNumber })
        .toArray();

      console.log('Fetched grades:', grades);

      if (!grades || grades.length === 0) {
        return res.status(404).json({ success: false, message: 'No grades found for this student ID.' });
      }

      const gradeDataArray = grades.map(grade => ({
        midtermAttendance: grade.MA ?? 'N/A',
        finalsAttendance: grade.FA ?? 'N/A',
        midtermClassStanding: grade.MCS ?? 'N/A',
        finalsClassStanding: grade.FCS ?? 'N/A',
        midtermExam: grade.ME ?? 'N/A',
        finalExam: grade.FE ?? 'N/A',
        midtermGrade: grade.MG ?? 'N/A',
        finalGrade: grade.FG ?? 'N/A',
        transmutedMidtermGrade: grade.TMG ?? 'N/A',
        transmutedFinalGrade: grade.MFG ?? 'N/A',
        totalFinalGrade: grade.TFG ?? 'N/A',
        courseID: grade.CourseID ?? 'N/A',
        courseDescription: grade.CourseDescription ?? 'N/A',
        createdAt: grade.createdAt
          ? format(grade.createdAt, 'yyyy-MM-dd HH:mm:ssXXX', { timeZone: 'Asia/Manila' })
          : null
      }));

      return res.json({ success: true, gradeDataArray });
    } catch (error) {
      console.error('Error fetching grades:', error);
      return res.status(500).json({ success: false, message: 'An error occurred while fetching grades.' });
    }
  });

  return router;
};
