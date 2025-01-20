// Utility function to show notification
function showNotification(message, type = 'error') {
  const notification = document.getElementById('notification');

  // Set the message and style based on the type
  notification.textContent = message;
  notification.className = `p-4 mb-4 rounded ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
  notification.classList.remove('hidden');

  // Hide the notification after 3 seconds
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Function to fetch user details
async function fetchStudentDetails() {
  try {
    const response = await fetch("/user-details", { method: "GET", credentials: "include" });
    if (!response.ok) throw new Error(`Failed to fetch user details. Status: ${response.status}`);

    const data = await response.json();
    if (data.success) {
      const studentName = `${data.user.firstName} ${data.user.lastName}`;
      const studentID = data.user.studentIDNumber;

      // Populate Student Info
      document.getElementById("studentFullName").textContent = studentName || '--';
      document.getElementById("studentIDNumber").textContent = studentID || '--';

      return { studentID, studentName };
    } else {
      throw new Error(data.message || 'Failed to fetch user details.');
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    showNotification(error.message || 'Failed to load user details. Please try again later.', 'error');
    return null;
  }
}

// Main function to fetch and display class records
async function fetchClassRecords(studentID) {
  try {
    // Fetch ClassSection and student info
    const masterListResponse = await fetch(`/api/getClassRecordFromMasterList?studentID=${studentID}`);
    const masterListData = await masterListResponse.json();

    if (!masterListData.success) {
      throw new Error(masterListData.message || 'Failed to fetch ClassSection.');
    }

    const { ClassSection } = masterListData.data;

    // Determine sheet name based on ClassSection
    let sheetName;
    switch (ClassSection) {
      case 'BSND3A':
        sheetName = 'MidCS-ND3A';
        break;
      case 'BSFT3A':
        sheetName = 'MidCS-FT3A';
        break;
      case 'BPA1B':
        sheetName = 'MidCS-PA1B';
        break;
      case 'BPA1D':
        sheetName = 'MidCS-PA1D';
        break;
      default:
        throw new Error(`ClassSection ${ClassSection} is not supported.`);
    }

    console.log('Fetching class record from sheet:', sheetName);

    // Fetch Class Record
    const classRecordResponse = await fetch(
      `/api/getClassRecordFromSheet?studentID=${studentID}&sheetName=${sheetName}`
    );
    const classRecordData = await classRecordResponse.json();

    if (!classRecordData.success) {
      throw new Error(classRecordData.message || 'Failed to fetch class record.');
    }

    const {
      totalScore,
      totalScoreWithBonus,
      percentage,
      lessonScores,
      bonusScores,
      midtermScores,
    } = classRecordData.data;

    // Populate Overall Scores
    document.getElementById('totalScore').textContent = totalScore || '--';
    document.getElementById('totalScoreWithBonus').textContent = totalScoreWithBonus || '--';
    document.getElementById('percentage').textContent = percentage || '--';

    // Populate Lessons
    for (let i = 1; i <= 12; i++) {
      document.getElementById(`lesson${i}Score`).textContent = lessonScores[`lesson${i}`] || '--';
    }

    // Populate Bonus Points
    document.getElementById('preclassSurvey').textContent = bonusScores.preclassSurvey || '--';
    document.getElementById('activity1Bonus').textContent = bonusScores.activity1 || '--';
    document.getElementById('activity2Bonus').textContent = bonusScores.activity2 || '--';

    // Populate Midterm Exam
    document.getElementById('midtermExam').textContent = midtermScores.exam || '--';
    document.getElementById('midtermWithBonus').textContent = midtermScores.examWithBonus || '--';
    document.getElementById('midtermTotal').textContent = midtermScores.total || '--';

    showNotification('Class records loaded successfully!', 'success');
  } catch (error) {
    console.error('Error fetching or displaying class records:', error);
    showNotification(error.message || 'Failed to load class records. Please try again later.', 'error');
  }
}

// Main DOMContentLoaded Listener
document.addEventListener('DOMContentLoaded', async () => {
  const userDetails = await fetchStudentDetails();
  if (userDetails) {
    await fetchClassRecords(userDetails.studentID);
  }
});
