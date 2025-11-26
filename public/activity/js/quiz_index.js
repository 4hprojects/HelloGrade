const quizFiles = [
  "java-basics",
  "java-intermediate",
  "java-hard-p1",
  "java-hard-p2"
];

async function fetchQuizMeta(filename) {
  const res = await fetch(`/api/activity/json/${filename}`);
  if (!res.ok) return null;
  return await res.json();
}

async function renderQuizActivities() {
  const container = document.getElementById('quizActivities');
  container.innerHTML = '';
  for (const file of quizFiles) {
    const quiz = await fetchQuizMeta(file);
    if (!quiz) continue;
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md p-6 animate hover:shadow-lg transition-shadow flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex items-center mb-4">
          <div class="bg-green-100 p-3 rounded-full mr-4">
            <span class="material-icons text-green-600">quiz</span>
          </div>
          <div>
            <h3 class="font-semibold text-lg">${quiz.title || 'Untitled Quiz'}</h3>
            <p class="text-gray-500 text-sm">${quiz.description || ''}</p>
          </div>
        </div>
        <p class="text-gray-700 mb-4">${quiz.meta?.multipleChoiceCount || quiz.multipleChoice?.length || 0} MCQ, ${quiz.meta?.trueFalseCount || quiz.trueFalse?.length || 0} True/False</p>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-500 mt-4">
        <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold"
          onclick="startQuiz('${file}')">
          Start Quiz
        </button>
      </div>
    `;
    container.appendChild(card);
  }
}

function startQuiz(filename) {
  window.location.href = `/activity/quiz_take.html?quiz=${filename}`;
}

document.addEventListener('DOMContentLoaded', renderQuizActivities);

function renderQuizQuestions(questions) {
  const container = document.getElementById('quizQuestions');
  container.innerHTML = '';
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-question-card mb-6';
    qDiv.innerHTML = `
      <div class="question-header flex justify-between items-center mb-4">
        <h4 class="font-semibold">Question ${i + 1}</h4>
        <div class="question-meta text-sm text-gray-500">
          <span>${question.points || 1} pts</span>
        </div>
      </div>
      <div class="question-body">
        <p class="text-gray-800">${question.text}</p>
      </div>
      <div class="question-options mt-4">
        ${question.options.map((option, index) => `
          <div class="flex items-center mb-2">
            <input type="radio" id="q${i}o${index}" name="question${i}" value="${option.value}" class="mr-2">
            <label for="q${i}o${index}" class="text-gray-700">${option.text}</label>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(qDiv);
  }
}