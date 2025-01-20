document.addEventListener("DOMContentLoaded", async () => {
    try {
        const sessionResponse = await fetch("/session-check", { method: "GET", credentials: "include" });
        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok || !sessionData.authenticated) {
            window.location.href = "/login";
            return;
        }

        if (sessionData.role === "admin") {
            window.location.href = "/admin_dashboard";
            return;
        } else if (sessionData.role !== "student") {
            window.location.href = "/403";
            return;
        }

        await fetchStudentDetails();
    } catch (error) {
        console.error("Error during session validation:", error);
        window.location.href = "/login";
    }
});

async function fetchStudentDetails() {
    try {
        const response = await fetch("/user-details", { method: "GET", credentials: "include" });
        if (!response.ok) throw new Error(`Failed to fetch user details. Status: ${response.status}`);

        const data = await response.json();
        if (data.success) {
            const studentName = `${data.user.firstName} ${data.user.lastName}`;
            const studentID = data.user.studentIDNumber;

            document.getElementById("studentName").textContent = studentName;
            document.getElementById("studentID").textContent = studentID;

            await fetchAttendanceForCourse("FullAttendance", studentID); // Replace with default course logic
        } else {
            console.error("Failed to fetch user details:", data.message);
        }
    } catch (error) {
        console.error("Error fetching user details:", error);
    }
}

async function fetchAttendanceForCourse(courseID, studentID) {
    // Fetch API config
    const response = await fetch('/api/config');
    const config = await response.json();

    // Use fetched keys
    const apiKey = config.apiKey;
    const spreadsheetId = config.spreadsheetIdAtt;

    const range = `${courseID}!A:Z`; // Adjust range if needed
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch attendance data. Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.values || data.values.length === 0) {
            throw new Error("No attendance data found in the Google Sheet.");
        }

        // Extract headers and data
        const headers = data.values[0]; // Assuming the first row contains headers
        const rows = data.values.slice(1); // Data rows start from the second row

        // Filter rows by student ID
        const attendanceRecords = rows.filter(row => row[0] === studentID); // Column A is studentIDNumber

        // Map the filtered data to match the frontend table
        const attendanceDataArray = attendanceRecords.map(record => ({
            attDate: record[1] || "",    // Column B: Date
            attTime: record[2] || "",    // Column C: Time
            term: record[3] || "",       // Column D: Term
            attRemarks: record[4] || "", // Column E: Remarks/Status
            subject: record[5] || "",    // Column F: Subject
        }));

        // Display attendance data in the table
        displayAttendance(attendanceDataArray);
    } catch (error) {
        console.error("Error fetching attendance from Google Sheets:", error);
        document.getElementById("attendanceError").textContent = "Failed to load attendance data. Please try again.";
    }
}



function displayAttendance(attendanceDataArray) {
    const tableBody = document.getElementById("data-table-body");
    tableBody.innerHTML = "";

    if (attendanceDataArray.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No attendance records found.</td></tr>';
        return;
    }

    attendanceDataArray.forEach(record => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${record.attDate || ""}</td>
            <td>${record.attTime || ""}</td>
            <td>${record.term || ""}</td>
            <td>${record.attRemarks || ""}</td>
            <td>${record.subject || ""}</td>
        `;
        tableBody.appendChild(row);
    });
}


// Export attendance as PDF
document.getElementById("exportPdf").addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const studentName = document.getElementById("studentName").textContent;
    const studentID = document.getElementById("studentID").textContent;
    const timestamp = new Date().toLocaleString();

    const table = document.querySelector("table");
    const rows = [...table.querySelectorAll("tr")].map(row =>
        [...row.querySelectorAll("th, td")].map(cell => cell.innerText)
    );

    doc.text("Attendance Summary", 10, 10);
    doc.text(`Name: ${studentName}`, 10, 20);
    doc.text(`Student ID: ${studentID}`, 10, 30);
    doc.text(`Downloaded on: ${timestamp}`, 10, 40);

    doc.autoTable({
        startY: 50,
        head: [rows[0]],
        body: rows.slice(1),
    });

    const filename = `${studentID}_${studentName.replace(/\s+/g, "_")}.pdf`;
    doc.save(filename);
});

// Export attendance as Excel
document.getElementById("exportExcel").addEventListener("click", () => {
    const studentName = document.getElementById("studentName").textContent;
    const studentID = document.getElementById("studentID").textContent;

    const table = document.querySelector("table");
    const worksheet = XLSX.utils.table_to_sheet(table);

    XLSX.utils.sheet_add_aoa(worksheet, [
        ["Attendance Summary"],
        [],
        [`Name: ${studentName}`],
        [`Student ID: ${studentID}`],
        [],
    ], { origin: "A1" });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Summary");

    const filename = `${studentID}_${studentName.replace(/\s+/g, "_")}.xlsx`;
    XLSX.writeFile(workbook, filename);
});
