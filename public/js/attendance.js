        // Session Validation and Fetch User Details
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // Session validation
                const sessionResponse = await fetch('/session-check', {
                    method: 'GET',
                    credentials: 'include',
                });

                const sessionData = await sessionResponse.json();

                if (!sessionResponse.ok || !sessionData.authenticated) {
                    window.location.href = 'login';
                    return;
                }

                if (sessionData.role === 'admin') {
                    window.location.href = 'admin_dashboard';
                    return;
                } else if (sessionData.role !== 'student') {
                    window.location.href = '403';
                    return;
                }

                // Fetch user details after session validation
                await fetchStudentDetails();
            } catch (error) {
                console.error('Error during session validation:', error);
                window.location.href = 'login';
            }
        });

        async function fetchStudentDetails() {
            try {
                const response = await fetch('/user-details', {
                    method: 'GET',
                    credentials: 'include',
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch user details. Status: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    document.getElementById('studentName').textContent = `${data.user.firstName} ${data.user.lastName}`;
                    document.getElementById('studentID').textContent = data.user.studentIDNumber;

                    // Fetch and display courses
                    await fetchCourses(data.user.studentIDNumber);
                } else {
                    console.error('Failed to fetch user details:', data.message);
                }
            } catch (error) {
                console.error('Error fetching user details:', error);
            }
        }

        // Fetch Courses and Populate Dropdown
        async function fetchCourses(studentIDNumber) {
            try {
                const response = await fetch(`/get-courses/${studentIDNumber}`, { credentials: 'include' });
                const data = await response.json();

                if (data.success) {
                    populateCourses(data.courseDataArray);
                } else {
                    console.error('Failed to fetch courses:', data.message);
                }
            } catch (error) {
                console.error('Error fetching courses:', error);
            }
        }

        function populateCourses(courseArray) {
            const classesSelect = document.getElementById('classesSelect');
            classesSelect.innerHTML = ''; // Clear options

                // Add a placeholder option
                const placeholderOption = document.createElement('option');
                placeholderOption.value = '';
                placeholderOption.textContent = 'Select a course';
                placeholderOption.disabled = true;
                placeholderOption.selected = true;
                classesSelect.appendChild(placeholderOption);

            courseArray.forEach(course => {
                const option = document.createElement('option');
                option.value = course.courseID;
                option.textContent = `${course.courseID} - ${course.courseDescription}`;
                classesSelect.appendChild(option);
            });

            // Set the default value to the first populated course
            if (courseArray.length > 0) {
                classesSelect.value = courseArray[0].courseID; // Set the dropdown's value to the first course ID
                fetchAttendanceForCourse(courseArray[0].courseID); // Fetch attendance for the first course
                document.getElementById('courseTitle').textContent = `${courseArray[0].courseID} - ${courseArray[0].courseDescription}`;
            }

            // Event Listener for Dropdown Change
            classesSelect.addEventListener('change', function () {
                const selectedCourseID = this.value;
                const selectedCourse = courseArray.find(course => course.courseID === selectedCourseID);
                document.getElementById('courseTitle').textContent = `${selectedCourse.courseID} - ${selectedCourse.courseDescription}`;
                fetchAttendanceForCourse(selectedCourseID);
            });
        }

        // Fetch Attendance for Selected Course
        async function fetchAttendanceForCourse(courseID) {
            const studentIDNumber = document.getElementById('studentID').textContent;

            try {
                const response = await fetch(`/get-attendance/${studentIDNumber}/${courseID}`, { credentials: 'include' });
                const data = await response.json();

                if (data.success) {
                    displayAttendance(data.attendanceDataArray);
                } else {
                    console.error('Failed to fetch attendance:', data.message);
                }
            } catch (error) {
                console.error('Error fetching attendance:', error);
            }
        }

        // Display Attendance in Table
        function displayAttendance(attendanceDataArray) {
            const attendanceTableBody = document.getElementById('attendanceTableBody');
            attendanceTableBody.innerHTML = ''; // Clear previous data

            if (attendanceDataArray.length === 0) {
                attendanceTableBody.innerHTML = '<tr><td colspan="5" class="py-4">No attendance records found.</td></tr>';
                return;
            }

            // Sort data by date (most recent first)
            attendanceDataArray.sort((a, b) => new Date(b.attDate) - new Date(a.attDate));

            attendanceDataArray.forEach(record => {
                console.log(record.term);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-2">${record.attDate || ""}</td>
                    <td class="py-2">${record.attTime || ""}</td>
                    <td class="py-2">${record.attStatus || ""}</td>
                    <td class="py-2">${record.attRemarks || ""}</td>
                    <td class="py-2">${record.term || "Not Specified"}</td> <!-- Populate Term -->
                `;
                attendanceTableBody.appendChild(row);
            });
        }

        function calculateAttendanceSummary(attendanceDataArray) {
            // Separate data by term
            const midtermsData = attendanceDataArray.filter(record => record.term === 'Midterms');
            const finalsData = attendanceDataArray.filter(record => record.term === 'Finals');

            // Function to calculate summary for a specific term
            function calculateTermSummary(dataArray) {
                const dateWeights = {};

                // Process data for unique dates and their weights
                dataArray.forEach(record => {
                    const date = record.attDate;
                    const status = record.attStatus;

                    // Only consider the first valid entry per date
                    if (!dateWeights[date]) {
                        if (status === 'Present') dateWeights[date] = 1.0;
                        else if (status === 'Late') dateWeights[date] = 0.5;
                        else if (status === 'Super Late') dateWeights[date] = 0.25;
                        else dateWeights[date] = 0; // Invalid status
                    }
                });

                const totalClasses = Object.keys(dateWeights).length;
                const classesAttended = Object.values(dateWeights).filter(weight => weight > 0).length;
                const totalWeightsEarned = Object.values(dateWeights).reduce((sum, weight) => sum + weight, 0);
                const attendancePercentage = totalClasses > 0
                    ? ((totalWeightsEarned / totalClasses) * 100).toFixed(2)
                    : 0;

                return { totalClasses, classesAttended, attendancePercentage };
            }

            // Calculate summaries for Midterms and Finals
            const midtermsSummary = calculateTermSummary(midtermsData);
            const finalsSummary = calculateTermSummary(finalsData);

            // Update UI for Midterms
            document.getElementById('totalClassesMidterms').textContent = midtermsSummary.totalClasses;
            document.getElementById('classesAttendedMidterms').textContent = midtermsSummary.classesAttended;
            document.getElementById('attendancePercentageMidterms').textContent = `${midtermsSummary.attendancePercentage}%`;

            // Update UI for Finals
            document.getElementById('totalClassesFinals').textContent = finalsSummary.totalClasses;
            document.getElementById('classesAttendedFinals').textContent = finalsSummary.classesAttended;
            document.getElementById('attendancePercentageFinals').textContent = `${finalsSummary.attendancePercentage}%`;
        }


    // Example usage: Call this function with attendance data
    const attendanceDataArray = [
        { attDate: '10/2/2024', attTime: '9:51:24', attStatus: 'Present', term: 'Midterms' },
        { attDate: '10/2/2024', attTime: '9:51:34', attStatus: 'Present', term: 'Midterms' }, // Duplicate entry
        { attDate: '10/2/2024', attTime: '9:55:24', attStatus: 'Present', term: 'Midterms' }, // Duplicate entry
        { attDate: '10/3/2024', attTime: '10:00:24', attStatus: 'Late', term: 'Finals' },
    ];

    calculateAttendanceSummary(attendanceDataArray);



        // Call this function after fetching attendance data
        function displayAttendance(attendanceDataArray) {
            const attendanceTableBody = document.getElementById('attendanceTableBody');
            attendanceTableBody.innerHTML = ''; // Clear previous data

            if (attendanceDataArray.length === 0) {
                attendanceTableBody.innerHTML = '<tr><td colspan="4" class="py-4">No attendance records found.</td></tr>';
                calculateAttendanceSummary([]);
                return;
            }

            attendanceDataArray.forEach(record => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-2">${record.attDate || ""}</td>
                    <td class="py-2">${record.attTime || ""}</td>
                    <td class="py-2">${record.attStatus || ""}</td>
                    <td class="py-2">${record.attRemarks || ""}</td>
                    <td class="py-2">${record.term || ""}</td>
                `;
                attendanceTableBody.appendChild(row);
            });

            // Calculate and update the summary
            calculateAttendanceSummary(attendanceDataArray);
        }


        document.getElementById('exportPdf').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Fetch necessary details
            const studentName = document.getElementById('studentName').textContent;
            const studentID = document.getElementById('studentID').textContent;
            const courseTitle = document.getElementById('courseTitle').textContent;

            // Add title and header details
            doc.setFontSize(16);
            doc.text("Attendance Summary Report", 10, 10);
            doc.setFontSize(12);
            doc.text(`Name: ${studentName}`, 10, 20);
            doc.text(`Student ID: ${studentID}`, 10, 30);
            doc.text(`Subject: ${courseTitle}`, 10, 40);

            // Fetch and add attendance summaries
            const midtermsSummary = {
                totalClasses: document.getElementById('totalClassesMidterms').textContent,
                classesAttended: document.getElementById('classesAttendedMidterms').textContent,
                attendancePercentage: document.getElementById('attendancePercentageMidterms').textContent,
            };

            const finalsSummary = {
                totalClasses: document.getElementById('totalClassesFinals').textContent,
                classesAttended: document.getElementById('classesAttendedFinals').textContent,
                attendancePercentage: document.getElementById('attendancePercentageFinals').textContent,
            };

            doc.text("Midterms Summary:", 10, 50);
            doc.text(`Total Classes: ${midtermsSummary.totalClasses}`, 10, 60);
            doc.text(`Classes Attended: ${midtermsSummary.classesAttended}`, 10, 70);
            doc.text(`Attendance Percentage: ${midtermsSummary.attendancePercentage}`, 10, 80);

            doc.text("Finals Summary:", 10, 90);
            doc.text(`Total Classes: ${finalsSummary.totalClasses}`, 10, 100);
            doc.text(`Classes Attended: ${finalsSummary.classesAttended}`, 10, 110);
            doc.text(`Attendance Percentage: ${finalsSummary.attendancePercentage}`, 10, 120);

            // Fetch table data and add to the PDF
            const rows = Array.from(document.querySelectorAll('#attendanceTableBody tr')).map(row =>
                Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim())
            );

            doc.autoTable({
                startY: 130,
                head: [['Date', 'Time', 'Status', 'Remarks', 'Term']], // Updated header to include Term
                body: rows,
            });

            // Generate dynamic file name
            const fileName = `Attendance_${studentID}_${courseTitle.split(' - ')[0]}.pdf`;

            // Save the PDF
            doc.save(fileName);
        });


        document.getElementById('exportExcel').addEventListener('click', () => {
            const studentName = document.getElementById('studentName').textContent;
            const studentID = document.getElementById('studentID').textContent;
            const courseTitle = document.getElementById('courseTitle').textContent;

            // Fetch attendance summaries
            const midtermsSummary = {
                totalClasses: document.getElementById('totalClassesMidterms').textContent,
                classesAttended: document.getElementById('classesAttendedMidterms').textContent,
                attendancePercentage: document.getElementById('attendancePercentageMidterms').textContent,
            };

            const finalsSummary = {
                totalClasses: document.getElementById('totalClassesFinals').textContent,
                classesAttended: document.getElementById('classesAttendedFinals').textContent,
                attendancePercentage: document.getElementById('attendancePercentageFinals').textContent,
            };

            // Fetch table data
            const rows = Array.from(document.querySelectorAll('#attendanceTableBody tr')).map(row =>
                Array.from(row.querySelectorAll('td')).map(cell => cell.textContent.trim())
            );

            const headers = ['Date', 'Time', 'Status', 'Remarks', 'Term'];

            // Prepare worksheet data
            const worksheetData = [
                [`Attendance Summary Report`],
                [],
                [`Name: ${studentName}`],
                [`Student ID: ${studentID}`],
                [`Subject: ${courseTitle}`],
                [],
                [`Midterms Summary`],
                [`Total Classes`, midtermsSummary.totalClasses],
                [`Classes Attended`, midtermsSummary.classesAttended],
                [`Attendance Percentage`, midtermsSummary.attendancePercentage],
                [],
                [`Finals Summary`],
                [`Total Classes`, finalsSummary.totalClasses],
                [`Classes Attended`, finalsSummary.classesAttended],
                [`Attendance Percentage`, finalsSummary.attendancePercentage],
                [],
                headers,
                ...rows,
            ];

            // Create Excel sheet
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Summary');

            // Generate dynamic file name
            const fileName = `Attendance_${studentID}_${courseTitle.split(' - ')[0]}.xlsx`;

            // Write file
            XLSX.writeFile(workbook, fileName);
        });

