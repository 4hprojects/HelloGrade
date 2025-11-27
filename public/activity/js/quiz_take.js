// Game state
let gameState = {
    studentInfo: {},
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    answers: [],
    times: [],
    timer: null,
    timeLeft: 15,
    leaderboard: [],
    quizData: null
};

// DOM Elements
const screens = {
    studentInfo: document.getElementById('studentInfoScreen'),
    question: document.getElementById('questionScreen'),
    feedback: document.getElementById('feedbackScreen'),
    results: document.getElementById('resultsScreen')
};

// Utility functions
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function formatDisplayName(firstName, lastName) {
    const formatPart = (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    return `${formatPart(firstName)} ${formatPart(lastName).charAt(0)}.`;
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function getQuizFilename() {
    const params = new URLSearchParams(window.location.search);
    return params.get('quiz');
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function fetchQuiz(filename) {
    try {
        const res = await fetch(`/api/activity/json/${filename}`);
        if (!res.ok) throw new Error('Quiz not found');
        return await res.json();
    } catch (error) {
        console.error('Error fetching quiz:', error);
        return null;
    }
}

// Check for duplicate attempt
async function checkDuplicateAttempt(quizID, idNumber) {
    try {
        const res = await fetch('/api/activity/check-attempt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quizID, idNumber })
        });
        if (!res.ok) throw new Error('Failed to check duplicate');
        return await res.json();
    } catch (error) {
        console.error('Error checking duplicate:', error);
        return { attempted: false };
    }
}

// Fetch leaderboard data
async function fetchLeaderboard(quizID) {
    try {
        const res = await fetch(`/api/activity/quiz-leaderboard/${quizID}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        const data = await res.json();
        return data.leaderboard || [];
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return []; // Return empty array if fetch fails
    }
}

// Form validation and submission
document.getElementById('studentInfoForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Get form values
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const idNumber = document.getElementById('idNumber').value.trim();
    const email = document.getElementById('email').value.trim();
    const section = document.getElementById('section').value.trim();
    const quizFilename = getQuizFilename();
    
    let isValid = true;
    
    // Reset error states
    document.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));
    document.getElementById('duplicateError').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    
    // Validate fields
    if (!firstName) {
        document.getElementById('firstName').parentElement.classList.add('error');
        isValid = false;
    }
    
    if (!lastName) {
        document.getElementById('lastName').parentElement.classList.add('error');
        isValid = false;
    }
    
    if (!idNumber || idNumber.length > 8) {
        document.getElementById('idNumber').parentElement.classList.add('error');
        isValid = false;
    }
    
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        document.getElementById('email').parentElement.classList.add('error');
        isValid = false;
    }
    
    if (!section) {
        document.getElementById('section').parentElement.classList.add('error');
        isValid = false;
    }
    
    if (!isValid) return;
    
    // Show loading indicator
    document.getElementById('loadingIndicator').style.display = 'flex';
    
    try {
        // Check for duplicate attempt
        // Make sure you have the correct quiz title and idNumber
        const quizData = await fetchQuiz(quizFilename);
        const quizTitle = quizData?.title || quizFilename;
        const duplicateCheck = await checkDuplicateAttempt(quizTitle, idNumber);
        
        if (duplicateCheck.exists) {
            document.getElementById('duplicateError').style.display = 'block';
            document.getElementById('loadingIndicator').style.display = 'none';
            return;
        }
        
        // Store student info
        gameState.studentInfo = {
            firstName: toTitleCase(firstName),
            lastName: toTitleCase(lastName),
            idNumber,
            email,
            section: toTitleCase(section),
            displayName: formatDisplayName(firstName, lastName)
        };
        
        // Start the quiz
        await startQuiz();
        
    } catch (error) {
        console.error('Error during form submission:', error);
        document.getElementById('loadingIndicator').style.display = 'none';
        alert('An error occurred. Please try again.');
    }
});

// Start the quiz
async function startQuiz() {
    const filename = getQuizFilename();
    
    try {
        // Load quiz data
        gameState.quizData = await fetchQuiz(filename);
        
        if (!gameState.quizData) {
            alert('Quiz not found!');
            return;
        }
        
        // Update UI with quiz title
        document.getElementById('quizTitleElement').textContent = gameState.quizData.title || 'Quiz';
        
        // Prepare questions
        gameState.questions = prepareQuestions(gameState.quizData);
        document.getElementById('totalQuestions').textContent = gameState.questions.length;
        
        // Load initial leaderboard
        gameState.leaderboard = await fetchLeaderboard(gameState.quizData.title);
        
        // Show the first question
        showQuestion(0);
        
    } catch (error) {
        console.error('Error starting quiz:', error);
        alert('Failed to load quiz. Please try again.');
    }
}

// Prepare questions from quiz data - HANDLES BOTH FORMATS
function prepareQuestions(quizData) {
    let questions = [];
    
    console.log('Quiz data:', quizData);
    
    // Handle multiple choice questions in BOTH formats
    if (quizData.multipleChoice) {
        quizData.multipleChoice.forEach((q, idx) => {
            // Check which format this question uses
            if (q.choices && typeof q.choices === 'object') {
                // Format 1: {choices: {a: "option1", b: "option2"}, answer: "a"}
                let choices = Object.entries(q.choices);
                questions.push({
                    type: 'mcq',
                    question: q.question,
                    choices: shuffleArray(choices),
                    answer: q.answer,
                    explanation: q.explanation || ''
                });
            } else if (q.options && Array.isArray(q.options)) {
                // Format 2: {options: ["option1", "option2", "option3"], answer: "12"}
                // Convert array format to key-value pairs
                let choices = [];
                q.options.forEach((option, index) => {
                    const key = String.fromCharCode(97 + index); // a, b, c, d
                    choices.push([key, option]);
                });
                questions.push({
                    type: 'mcq',
                    question: q.question,
                    choices: shuffleArray(choices),
                    answer: q.answer,
                    explanation: q.explanation || ''
                });
            } else if (typeof q.answer === 'boolean') {
                // True/false question (boolean answer)
                questions.push({
                    type: 'tf',
                    question: q.question,
                    answer: q.answer,
                    explanation: q.explanation || ''
                });
            }
        });
    }
    
    // Handle separate trueFalse array
    if (quizData.trueFalse) {
        quizData.trueFalse.forEach((q, idx) => {
            questions.push({
                type: 'tf',
                question: q.question,
                answer: q.answer,
                explanation: q.explanation || ''
            });
        });
    }
    
    console.log('Prepared questions:', questions);
    return shuffleArray(questions);
}

// Show a question - FIXED VERSION
function showQuestion(index) {
    if (index >= gameState.questions.length) {
        showFinalResults();
        return;
    }
    
    gameState.currentQuestionIndex = index;
    const question = gameState.questions[index];
    
    console.log('Showing question:', question); // Debug log
    
    // Update UI
    document.getElementById('questionNumber').textContent = index + 1;
    document.getElementById('questionText').textContent = question.question;
    
    // Create answer buttons
    const answersContainer = document.getElementById('answerOptions');
    answersContainer.innerHTML = '';
    
    if (question.type === 'mcq') {
        // For MC questions, create buttons for each choice
        question.choices.forEach(([key, value]) => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.textContent = value;
            button.dataset.key = key;
            button.onclick = () => selectAnswer(key, button);
            answersContainer.appendChild(button);
        });
    } else if (question.type === 'tf') {
        // For True/False questions
        const trueButton = document.createElement('button');
        trueButton.className = 'answer-btn';
        trueButton.textContent = 'True';
        trueButton.dataset.key = 'true';
        trueButton.onclick = () => selectAnswer(true, trueButton);
        answersContainer.appendChild(trueButton);
        
        const falseButton = document.createElement('button');
        falseButton.className = 'answer-btn';
        falseButton.textContent = 'False';
        falseButton.dataset.key = 'false';
        falseButton.onclick = () => selectAnswer(false, falseButton);
        answersContainer.appendChild(falseButton);
    }
    
    // Start the timer
    startTimer();
    
    // Show the quiz screen
    showScreen('question');
}

// Start the question timer
function startTimer() {
    clearInterval(gameState.timer);
    gameState.timeLeft = 15;
    document.getElementById('timerText').textContent = gameState.timeLeft;

    // Reset timer progress
    const timerProgress = document.querySelector('.timer-progress');
    timerProgress.style.strokeDashoffset = '0';

    // Record the start time
    const startTime = Date.now();

    gameState.timer = setInterval(() => {
        // Calculate elapsed time
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        gameState.timeLeft = Math.max(15 - elapsed, 0);
        document.getElementById('timerText').textContent = gameState.timeLeft;

        // Update progress circle
        const progress = (gameState.timeLeft / 15) * 283;
        timerProgress.style.strokeDashoffset = 283 - progress;

        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            timeUp();
        }
    }, 250); // Use a shorter interval for smoother updates
}

// Handle answer selection
function selectAnswer(answer, button) {
    clearInterval(gameState.timer);
    
    // Disable all buttons
    const allButtons = document.querySelectorAll('.answer-btn');
    allButtons.forEach(btn => {
        btn.disabled = true;
    });
    
    // Highlight selected button
    button.classList.add('selected');
    
    // Store the answer and time
    gameState.answers.push(answer);
    gameState.times.push(gameState.timeLeft);
    
    // Show feedback
    showFeedback(answer);
}

// Handle time up
function timeUp() {
    // Disable all buttons
    const allButtons = document.querySelectorAll('.answer-btn');
    allButtons.forEach(btn => {
        btn.disabled = true;
    });
    
    // Store no answer
    gameState.answers.push(null);
    gameState.times.push(0);
    
    // Show feedback
    showFeedback(null);
}

// Enhanced compact showFeedback function
async function showFeedback(selectedAnswer) {
    const question = gameState.questions[gameState.currentQuestionIndex];
    let isCorrect = false;
    let correctAnswerDisplay = '';
    
    // Determine correctness and correct answer display
    if (question.type === 'mcq') {
        isCorrect = selectedAnswer === question.answer;
        correctAnswerDisplay = question.choices.find(([key]) => key === question.answer)?.[1] || question.answer;
    } else if (question.type === 'tf') {
        isCorrect = selectedAnswer === question.answer;
        correctAnswerDisplay = question.answer ? 'True' : 'False';
    }
    
    // Update feedback UI with compact styling
    const feedbackIcon = document.getElementById('feedbackIcon');
    const feedbackResult = document.getElementById('feedbackResult');
    const feedbackText = document.getElementById('feedbackText');
    
    feedbackIcon.textContent = isCorrect ? '✅' : '❌'; // Smaller, simpler icons
    feedbackResult.textContent = isCorrect ? 'Correct!' : 'Incorrect!';
    feedbackResult.className = `feedback-result ${isCorrect ? 'correct' : 'incorrect'}`;
    
    feedbackText.className = 'feedback-text'; // Reset classes
    
    if (selectedAnswer === null) {
        feedbackText.textContent = "⏰ Time's up! No answer selected.";
        feedbackText.classList.add('timeup-feedback');
    } else if (isCorrect) {
        feedbackText.textContent = "Great job! You got it right!";
        feedbackText.classList.add('correct-feedback');
    } else {
        feedbackText.innerHTML = `Incorrect! Correct answer: <span class="correct-answer-display">${correctAnswerDisplay}</span>`;
        feedbackText.classList.add('incorrect-feedback');
    }
    
    // Compact explanation
    document.getElementById('explanationText').textContent = question.explanation || '';
    
    // Calculate points earned
    const pointsEarned = calculatePoints(isCorrect, gameState.timeLeft);
    gameState.score += pointsEarned;

    document.getElementById('pointsEarned').textContent = pointsEarned;
    document.getElementById('currentScore').textContent = gameState.score;

    // Update leaderboard on server and fetch latest leaderboard
    await updateLeaderboardOnServer();
    gameState.leaderboard = await fetchLeaderboard(gameState.quizData.title);
    updateLeaderboard();

    // Show feedback screen
    showScreen('feedback');
    
    // Auto-advance to next question after 5 seconds
    let countdown = 5;
    document.getElementById('nextTimerCount').textContent = countdown;
    
    const countdownInterval = setInterval(() => {
        countdown--;
        document.getElementById('nextTimerCount').textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            showQuestion(gameState.currentQuestionIndex + 1);
        }
    }, 1000);
}

// Calculate points based on Kahoot scoring
function calculatePoints(isCorrect, timeLeft) {
    if (!isCorrect) return 0;
    
    // Kahoot-style scoring: 1000 base + up to 500 speed bonus
    const basePoints = 1000;
    const speedBonus = Math.floor((timeLeft / 15) * 500);
    
    return basePoints + speedBonus;
}

// Update leaderboard with current player
function updateLeaderboard() {
    const formattedLeaderboard = gameState.leaderboard.map(player => ({
        name: (player.firstName && player.lastName)
            ? `${player.firstName} ${player.lastName}`
            : 'Anonymous',
        score: player.score,
        accuracy: player.accuracy !== undefined ? player.accuracy : 0,
        correctItems: player.correctItems !== undefined ? player.correctItems : 0,
        totalItems: player.totalItems !== undefined ? player.totalItems : 0
    }));

    formattedLeaderboard.sort((a, b) => b.score - a.score);

    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = `
        <div class="leaderboard-header" style="display: flex; font-weight: bold; padding: 8px 12px;">
            <div style="width: 40px;">Rank</div>
            <div style="flex: 1;">Name</div>
            <div style="width: 80px;">Score</div>
            <div style="width: 90px;">Accuracy</div>
            <div style="width: 120px;">Correct/Total</div>
        </div>
    `;

    formattedLeaderboard.slice(0, 5).forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.style.display = 'flex';
        item.innerHTML = `
            <div style="width: 40px;">${index + 1}</div>
            <div style="flex: 1;">${player.name}</div>
            <div style="width: 80px;">${player.score}</div>
            <div style="width: 90px;">${player.accuracy}%</div>
            <div style="width: 120px;">${player.correctItems} / ${player.totalItems}</div>
        `;
        leaderboardList.appendChild(item);
    });
}

// Show final results
async function showFinalResults() {
    document.getElementById('finalScore').textContent = gameState.score;

    // Refresh leaderboard with latest data from server
    try {
        const latestLeaderboard = await fetchLeaderboard(gameState.quizData.quizID);
        if (latestLeaderboard.length > 0) {
            gameState.leaderboard = latestLeaderboard;
        }
    } catch (error) {
        console.error('Error fetching final leaderboard:', error);
    }

    // Map leaderboard with all stats
    const displayLeaderboard = gameState.leaderboard.map(player => ({
        name: (player.firstName && player.lastName)
            ? `${player.firstName} ${player.lastName}`
            : 'Anonymous',
        score: player.score,
        accuracy: player.accuracy,
        correctItems: player.correctItems,
        totalItems: player.totalItems
    }));

    // Add current player to leaderboard for display (with all stats)
    const { totalItems, correctItems, accuracy } = calculateQuizStats();
    const currentPlayer = {
        name: `${gameState.studentInfo.firstName} ${gameState.studentInfo.lastName}`,
        score: gameState.score,
        accuracy,
        correctItems,
        totalItems
    };

    const existingIndex = displayLeaderboard.findIndex(p => p.name === currentPlayer.name);

    if (existingIndex !== -1) {
        displayLeaderboard[existingIndex] = currentPlayer;
    } else {
        displayLeaderboard.push(currentPlayer);
    }

    displayLeaderboard.sort((a, b) => b.score - a.score);

    // Update podium with top 3
    const topPlayers = displayLeaderboard.slice(0, 3);

    if (topPlayers[0]) {
        document.getElementById('firstPlace').textContent = topPlayers[0].name;
        document.getElementById('firstScore').textContent = topPlayers[0].score;
    }

    if (topPlayers[1]) {
        document.getElementById('secondPlace').textContent = topPlayers[1].name;
        document.getElementById('secondScore').textContent = topPlayers[1].score;
    }

    if (topPlayers[2]) {
        document.getElementById('thirdPlace').textContent = topPlayers[2].name;
        document.getElementById('thirdScore').textContent = topPlayers[2].score;
    }

    // Update full leaderboard
    const fullLeaderboardList = document.getElementById('fullLeaderboardList');
    fullLeaderboardList.innerHTML = '';

    displayLeaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="rank">${index + 1}</div>
            <div class="name">${player.name}</div>
            <div class="score">Score: ${player.score}</div>
            <div class="accuracy">Accuracy: ${player.accuracy !== undefined ? player.accuracy : 0}%</div>
            <div class="items">Correct: ${player.correctItems !== undefined ? player.correctItems : 0} / ${player.totalItems !== undefined ? player.totalItems : 0}</div>
        `;
        fullLeaderboardList.appendChild(item);
    });

    // Submit results to server
    await submitQuizResults();

    // Always show results screen
    showScreen('results');
}

// Submit quiz results to server
async function submitQuizResults() {
    const { totalItems, correctItems, accuracy } = calculateQuizStats();
    const payload = {
        studentInfo: gameState.studentInfo,
        quizID: gameState.quizData.quizID,
        quiz: gameState.quizData,
        answers: gameState.answers,
        times: gameState.times,
        score: gameState.score,
        totalItems,
        correctItems,
        accuracy
    };
    try {
        const res = await fetch('/api/activity/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to submit results');
        const result = await res.json();
        console.log('Quiz submitted successfully:', result);
    } catch (error) {
        console.error('Error submitting quiz results:', error);
    }
}

// Add this function to quiz_take.js
function calculateQuizStats() {
    const totalItems = gameState.questions.length;
    const correctItems = gameState.answers.filter((ans, idx) => {
        const q = gameState.questions[idx];
        return ans !== null && ans === q.answer;
    }).length;
    const accuracy = totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 0;
    return { totalItems, correctItems, accuracy };
}

async function updateLeaderboardOnServer() {
    const { totalItems, correctItems, accuracy } = calculateQuizStats();
    const payload = {
        studentInfo: gameState.studentInfo,
        quizID: gameState.quizData.quizID,
        score: gameState.score,
        timeTaken: gameState.times.reduce((a, b) => a + b, 0),
        totalItems,
        correctItems,
        accuracy
    };
    try {
        await fetch('/api/activity/update-leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error updating leaderboard on server:', error);
    }
}

// Play again button
document.getElementById('playAgainBtn').addEventListener('click', function() {
    window.location.href = '/activity';
});

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    const quizFilename = getQuizFilename();
    if (!quizFilename) {
        alert('No quiz specified in URL');
        return;
    }
    
    // Load quiz title initially
    fetchQuiz(quizFilename).then(quizData => {
        if (quizData) {
            document.getElementById('quizTitleElement').textContent = quizData.title || 'Quiz';
        }
    });
});

console.log('[DEBUG] submit payload:', req.body);
