const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'hellograde';

// Check for duplicate attempt
router.post('/check-attempt', async (req, res) => {
  const { quiz, idNumber, email } = req.body;
  
  if (!quiz || !idNumber || !email) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    
    // Check if student already attempted this quiz
    const existingAttempt = await db.collection('quiz_attempts').findOne({
      quiz,
      $or: [
        { 'student.idNumber': idNumber },
        { 'student.email': email }
      ]
    });
    
    client.close();
    
    res.json({ exists: !!existingAttempt });
    
  } catch (err) {
    console.error('Error checking duplicate attempt:', err);
    res.status(500).json({ error: 'Failed to check duplicate attempt.' });
  }
});

// Get leaderboard for a quiz
router.get('/leaderboard/:quiz', async (req, res) => {
  const { quiz } = req.params;
  
  try {
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    
    // Get top 10 scores for this quiz, sorted by score descending
    const leaderboard = await db.collection('quiz_attempts')
      .find({ quiz })
      .sort({ score: -1 })
      .limit(10)
      .project({ 
        'student.firstName': 1,
        'student.lastName': 1,
        'score': 1,
        'submittedAt': 1
      })
      .toArray();
    
    client.close();
    
    // Format leaderboard data
    const formattedLeaderboard = leaderboard.map(attempt => ({
      name: `${attempt.student.firstName} ${attempt.student.lastName.charAt(0)}.`,
      score: Math.round(attempt.score),
      date: attempt.submittedAt
    }));
    
    res.json(formattedLeaderboard);
    
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// Original scoring system (1 point + 0.05 bonus per second)
router.post('/submit', async (req, res) => {
  const { student, quiz, answers, times } = req.body;
  if (!student || !quiz || !answers || !times) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  // Load quiz JSON for scoring
  const path = require('path');
  const fs = require('fs');
  const quizPath = path.join(__dirname, '../public/activity/json', `${quiz}.json`);
  let quizData;
  try {
    quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
  } catch {
    return res.status(404).json({ error: 'Quiz not found.' });
  }

  // Score the quiz with speed bonus (original system)
  let score = 0, maxScore = 0, items = [];
  let timeIdx = 0;
  
  // Process multiple choice questions
  if (quizData.multipleChoice) {
    quizData.multipleChoice.forEach((q, idx) => {
      // Handle both MC and TF questions in multipleChoice array
      let correct;
      if (typeof q.answer === 'boolean') {
        // This is actually a true/false question
        correct = answers[timeIdx] == q.answer;
      } else {
        // Regular multiple choice
        correct = answers[timeIdx] == q.answer;
      }
      
      let base = correct ? 1 : 0;
      let bonus = correct ? Math.max(0, times[timeIdx] * 0.05) : 0;
      score += base + bonus;
      maxScore += 1 + 0.75;
      items.push({
        id: `q_${idx}`,
        correct,
        correctAnswer: q.answer,
        explanation: q.explanation || '',
        timeLeft: times[timeIdx]
      });
      timeIdx++;
    });
  }
  
  // Process true/false questions
  if (quizData.trueFalse) {
    quizData.trueFalse.forEach((q, idx) => {
      const correct = answers[timeIdx] == q.answer;
      let base = correct ? 1 : 0;
      let bonus = correct ? Math.max(0, times[timeIdx] * 0.05) : 0;
      score += base + bonus;
      maxScore += 1 + 0.75;
      items.push({
        id: `tf_${idx}`,
        correct,
        correctAnswer: q.answer,
        explanation: q.explanation || '',
        timeLeft: times[timeIdx]
      });
      timeIdx++;
    });
  }
  
  const percentage = maxScore ? ((score / maxScore) * 100).toFixed(2) : 0;

  // Save to MongoDB
  try {
    const client = await MongoClient.connect(mongoUrl);
    const db = client.db(dbName);
    await db.collection('quiz_attempts').insertOne({
      student,
      quiz,
      answers,
      times,
      score,
      maxScore,
      percentage,
      items,
      submittedAt: new Date()
    });
    client.close();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save attempt.' });
  }

  // Respond with results
  res.json({ 
    score: score.toFixed(2), 
    maxScore: maxScore.toFixed(2), 
    percentage, 
    items, 
    times 
  });
});

module.exports = router;