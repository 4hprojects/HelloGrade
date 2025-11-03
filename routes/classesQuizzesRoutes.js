const express = require('express');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const { utcToZonedTime } = require('date-fns-tz');

const upload = multer({ dest: 'uploads/' });

module.exports = function classesQuizzesRoutes(
  {
    classesCollection,
    quizzesCollection,
    attemptsCollection,
    countersCollection,
    classQuizCollection,
    ObjectId
  },
  { isAuthenticated, isTeacherOrAdmin, isAdmin }
) {
  const router = express.Router();

  // GET /api/classes
  router.get('/classes', isAuthenticated, async (req, res) => {
    try {
      if (req.query.studentEnrolled === 'true' && req.session.role === 'student') {
        const studentIDNumber = req.session.studentIDNumber;
        const classes = await classesCollection.find({ students: { $in: [studentIDNumber] } }).toArray();
        return res.json({ success: true, classes });
      }

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

  // POST /api/quiz-responses
  router.post('/quiz-responses', isAuthenticated, async (req, res) => {
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

  // GET /api/quizzes
  router.get('/quizzes', isAuthenticated, async (req, res) => {
    try {
      const { role, userId } = req.session;
      let filter = {};
      if (role === 'teacher') filter = { createdBy: new ObjectId(userId) };

      const quizzes = await quizzesCollection.find(filter).toArray();
      return res.json({ success: true, quizzes });
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/classes/:classId/enroll
  router.put('/classes/:classId/enroll', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const classId = req.params.classId;
      const studentIDNumber = req.params.studentIDNumber;
      let { studentIDs } = req.body; // array of IDs

      if (!Array.isArray(studentIDs)) {
        return res.status(400).json({ success: false, message: 'studentIDs must be an array.' });
      }

      // Note: following lines are kept as-is from your current code
      if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: 'Answers must be an array.' });
      }
      console.log('Answers Submitted:', answers);
      if (answers.length !== quiz.questions.length) {
        return res.status(400).json({ success: false, message: 'Number of answers does not match the number of questions.' });
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
  router.post('/classes/generate-code', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
    try {
      const MAX_TRIES = 1000;
      let tries = 0;

      while (true) {
        tries++;
        if (tries > MAX_TRIES) {
          return res.status(500).json({ success: false, message: 'Could not generate a unique code after many attempts.' });
        }

        const result = await countersCollection.findOneAndUpdate(
          { _id: 'classCode' },
          { $inc: { nextVal: 1 } },
          { returnDocument: 'after', upsert: true }
        );

        const nextVal = result.value ? result.value.nextVal : 1;
        const padded = String(nextVal).padStart(6, '0');
        const candidateCode = `C${padded}`;

        const existing = await classesCollection.findOne({ classCode: candidateCode });
        if (!existing) {
          return res.json({ success: true, classCode: candidateCode });
        }
      }
    } catch (err) {
      console.error('Error generating class code:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/classes
  router.post('/classes', isAuthenticated, isTeacherOrAdmin, async (req, res) => {
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

      if (!classCode || !className) {
        return res.status(400).json({ success: false, message: 'Missing required fields.' });
      }

      const createdBy = new ObjectId(req.session.userId);

      const newClass = {
        classCode,
        className,
        instructorIDNumber,
        instructorName,
        instructorId: createdBy,
        createdBy,
        schedule: schedule || '',
        time: time || '',
        students: Array.isArray(students) ? [...new Set(students)] : [],
        createdAt: new Date()
      };

      const result = await classesCollection.insertOne(newClass);
      if (result.acknowledged) {
        return res.json({ success: true, classId: result.insertedId });
      }
      return res.status(500).json({ success: false, message: 'Failed to create class.' });
    } catch (err) {
      console.error('Error creating class:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  // POST /api/classes/upload-temp-students
  router.post(
    '/classes/upload-temp-students',
    isAuthenticated,
    isTeacherOrAdmin,
    upload.single('studentFile'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const filePath = req.file.path;
        const studentIDs = [];

        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
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
    }
  );

  // POST /api/quizzes (admin only)
  router.post('/quizzes', isAuthenticated, isAdmin, async (req, res) => {
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

      if (!quizTitle || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ success: false, message: 'Invalid quiz data.' });
      }

      const newQuiz = {
        quizTitle,
        description: description || '',
        questions,
        dueDate: dueDate ? new Date(dueDate) : null,
        latePenaltyPercent: latePenaltyPercent != null ? latePenaltyPercent : 40,
        maxAttempts: maxAttempts || 1,
        duration: duration || 0,
        isActive: true,
        createdBy: req.session.userId,
        createdAt: new Date()
      };

      const result = await quizzesCollection.insertOne(newQuiz);
      if (result.acknowledged) {
        return res
          .status(201)
          .json({ success: true, quizId: result.insertedId, message: 'Quiz created successfully.' });
      }
      return res.status(500).json({ success: false, message: 'Failed to create quiz.' });
    } catch (error) {
      console.error('Error creating quiz:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  // POST /api/quizzes/:quizId/start
  router.post('/quizzes/:quizId/start', isAuthenticated, async (req, res) => {
    try {
      const { quizId } = req.params;
      if (!ObjectId.isValid(quizId)) {
        return res.status(400).json({ success: false, message: 'Invalid quizId.' });
      }

      if (req.session.role === 'teacher' || req.session.role === 'admin') {
        // allow previewing
      } else if (req.session.role === 'student') {
        const pivotDoc = await classQuizCollection.findOne({ quizId: new ObjectId(quizId) });
        if (!pivotDoc) {
          return res.status(403).json({ success: false, message: 'You are not assigned this quiz.' });
        }

        const studentIDNumber = req.session.studentIDNumber;
        let isAssignedToStudent = false;

        if (Array.isArray(pivotDoc.assignedStudents) && pivotDoc.assignedStudents.length > 0) {
          if (pivotDoc.assignedStudents.includes(studentIDNumber)) {
            isAssignedToStudent = true;
          }
        } else {
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

        if (pivotDoc.startDate && pivotDoc.startDate > new Date()) {
          return res.status(403).json({ success: false, message: 'Quiz not yet available.' });
        }
      }

      const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
      if (!quiz) {
        return res.status(404).json({ success: false, message: 'Quiz not found.' });
      }

      // TODO: start attempt doc if needed
      return res.json({ success: true, message: 'Quiz start validated.' });
    } catch (error) {
      console.error('Error starting quiz attempt:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  // PUT /api/quizzes/:quizId/attempts/:attemptId
  router.put('/quizzes/:quizId/attempts/:attemptId', isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      const studentIDNumber = req.session.studentIDNumber;
      const { attemptId } = req.params;
      const { answers } = req.body; // fix: read answers from body

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

      await attemptsCollection.updateOne(
        { _id: attempt._id },
        {
          $set: {
            answers: Array.isArray(answers) ? answers : [],
            partialSaveAt: new Date(),
            studentIDNumber
          }
        }
      );

      res.json({ success: true, message: 'Attempt updated (partial save).' });
    } catch (error) {
      console.error('Error updating attempt:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  // POST /api/quizzes/:quizId/attempts/:attemptId/submit
  router.post('/quizzes/:quizId/attempts/:attemptId/submit', isAuthenticated, async (req, res) => {
    try {
      const { quizId, attemptId } = req.params;
      const { answers } = req.body;
      const userId = req.session.userId;

      if (!ObjectId.isValid(quizId) || !ObjectId.isValid(attemptId)) {
        return res.status(400).json({ success: false, message: 'Invalid IDs.' });
      }
      if (!Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: 'Answers must be an array.' });
      }

      const attempt = await attemptsCollection.findOne({ _id: new ObjectId(attemptId) });
      if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found.' });
      if (attempt.studentId.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      if (attempt.isCompleted) {
        return res.status(400).json({ success: false, message: 'Attempt is already submitted.' });
      }

      const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
      if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

      // Score
      let rawScore = 0;
      const totalQuizPoints = quiz.questions.length;
      if (answers.length !== totalQuizPoints) {
        return res.status(400).json({
          success: false,
          message: 'Number of answers does not match the number of questions.'
        });
      }
      for (let i = 0; i < totalQuizPoints; i++) {
        if (answers[i] === quiz.questions[i].correctAnswer) rawScore++;
      }

      // Late penalty
      let finalScore = rawScore;
      const submittedAt = new Date();
      if (quiz.dueDate) {
        const dueDate = new Date(quiz.dueDate);
        if (submittedAt > dueDate) {
          const penaltyPercent = quiz.latePenaltyPercent || 40;
          const penalty = (penaltyPercent / 100) * totalQuizPoints;
          finalScore = rawScore - penalty;
        }
      }
      finalScore = Math.max(0, finalScore);

      await attemptsCollection.updateOne(
        { _id: attempt._id },
        {
          $set: {
            isCompleted: true,
            submittedAt,
            score: rawScore,
            finalScore,
            studentIDNumber: req.session.studentIDNumber
          }
        }
      );

      // Adjust across attempts if needed
      const allAttempts = await attemptsCollection
        .find({ quizId: quiz._id, studentId: new ObjectId(userId), isCompleted: true })
        .toArray();

      const allFinalScores = allAttempts.map(a => a.finalScore);
      const averageScore = allFinalScores.reduce((a, b) => a + b, 0) / allFinalScores.length;
      const attemptCount = allAttempts.length;

      let multipleAttemptsAdjustedScore = finalScore;
      if (quiz.maxAttempts > 1 && attemptCount > 1) {
        multipleAttemptsAdjustedScore = Math.max(0, averageScore - (attemptCount - 1));
      }

      await attemptsCollection.updateOne(
        { _id: attempt._id },
        { $set: { finalScore: multipleAttemptsAdjustedScore } }
      );

      return res.json({
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

  // GET /api/quizzes/:quizId/export (admin)
  router.get('/quizzes/:quizId/export', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { quizId } = req.params;
      if (!ObjectId.isValid(quizId)) {
        return res.status(400).json({ success: false, message: 'Invalid quizId.' });
      }

      const quiz = await quizzesCollection.findOne({ _id: new ObjectId(quizId) });
      if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found.' });

      const attempts = await attemptsCollection.find({ quizId: quiz._id }).toArray();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Quiz Attempts');

      worksheet.columns = [
        { header: 'Student ID (ObjectId)', key: 'studentId', width: 24 },
        { header: 'StudentIDNumber', key: 'studentIDNumber', width: 16 },
        { header: 'Attempt #', key: 'attemptNumber', width: 12 },
        { header: 'Is Completed?', key: 'isCompleted', width: 14 },
        { header: 'Raw Score', key: 'score', width: 10 },
        { header: 'Final Score', key: 'finalScore', width: 12 },
        { header: 'Submitted At', key: 'submittedAt', width: 22 }
      ];

      attempts.forEach(a => {
        worksheet.addRow({
          studentId: a.studentId?.toString() || '',
          studentIDNumber: a.studentIDNumber || '',
          attemptNumber: a.attemptNumber,
          isCompleted: a.isCompleted,
          score: a.score,
          finalScore: a.finalScore,
          submittedAt: a.submittedAt
            ? utcToZonedTime(a.submittedAt, 'Asia/Manila').toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
            : ''
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="quiz_${quizId}_attempts.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error exporting quiz attempts:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  });

  return router;
};
