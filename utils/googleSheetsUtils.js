const { google } = require('googleapis');

// Fetch ClassSection from MasterList
async function fetchClassSectionFromMasterList(studentID) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID_CSMST2025,
      range: 'MasterList!A:AB',
    });

    const rows = response.data.values;
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const studentRow = dataRows.find(row => row[headers.indexOf('ID Number')] === studentID);
    if (!studentRow) {
      throw new Error(`No records found for studentID: ${studentID}`);
    }

    return studentRow[headers.indexOf('ClassSection')];
  } catch (error) {
    console.error('Error in fetchClassSectionFromMasterList:', error.message);
    throw error;
  }
}

// Fetch ClassRecord from a specific sheet
async function fetchClassRecordFromSheet(studentID, sheetName) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID_CSMST2025,
      range: `${sheetName}!A:AB`,
    });

    const rows = response.data.values;
    const headers = rows[0];
    const dataRows = rows.slice(1);

    const studentRow = dataRows.find(row => row[headers.indexOf('ID Number')] === studentID);
    if (!studentRow) {
      throw new Error(`No records found in sheet ${sheetName} for studentID: ${studentID}`);
    }

    const record = {
      totalScore: studentRow[headers.indexOf('TLec')] || '--',
      totalScoreWithBonus: studentRow[headers.indexOf('bonus')] || '--',
      percentage: studentRow[headers.indexOf('TCS')] || '--',
      lessonScores: {
        lesson1: studentRow[headers.indexOf('1')] || '--',
        lesson2: studentRow[headers.indexOf('2')] || '--',
        lesson3: studentRow[headers.indexOf('3')] || '--',
        lesson4: studentRow[headers.indexOf('4')] || '--',
        lesson5: studentRow[headers.indexOf('5')] || '--',
        lesson6: studentRow[headers.indexOf('6')] || '--',
        lesson7: studentRow[headers.indexOf('7')] || '--',
        lesson8: studentRow[headers.indexOf('8')] || '--',
        lesson9: studentRow[headers.indexOf('9')] || '--',
        lesson10: studentRow[headers.indexOf('10')] || '--',
        lesson11: studentRow[headers.indexOf('11')] || '--',
        lesson12: studentRow[headers.indexOf('12')] || '--',
      },
      bonusScores: {
        preclassSurvey: studentRow[headers.indexOf('PreclassSurvey')] || '--',
        activity1: studentRow[headers.indexOf('Kt1')] || '--',
        activity2: studentRow[headers.indexOf('Kt2')] || '--',
      },
      midtermScores: {
        exam: studentRow[headers.indexOf('MidExam')] || '--',
        examWithBonus: studentRow[headers.indexOf('MidExamw')] || '--',
        total: studentRow[headers.indexOf('FTotal')] || '--',
      },
    };

    return record;
  } catch (error) {
    console.error('Error in fetchClassRecordFromSheet:', error.message);
    throw error;
  }
}

module.exports = { fetchClassSectionFromMasterList, fetchClassRecordFromSheet };

async function fetchStudentDetailsFromMasterList(studentID) {
  try {
    const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID_CSMST2025,
      range: 'MasterList!A:J',
    });

    const rows = response.data.values;
    const headers = rows[0]; // First row is the header
    const dataRows = rows.slice(1);

    console.log('Headers:', headers); // Log headers for debugging

    const studentRow = dataRows.find(row => row[headers.indexOf('Student ID')] === studentID);

    return {
      fullName: studentRow[headers.indexOf('Name')] || 'Unknown',
      classSection: studentRow[headers.indexOf('ClassSection')] || 'Unknown',
      studentID: studentRow[headers.indexOf('Student ID')],
    };
    
  } catch (error) {
    console.error('Error in fetchStudentDetailsFromMasterList:', error.message);
    throw error;
  }
}
