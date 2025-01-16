document.addEventListener('DOMContentLoaded', async () => {
    await fetchGrades();
    await initializePage();
});

async function initializePage() {
    try {
        const sessionResponse = await fetch('/session-check', {
            method: 'GET',
            credentials: 'include'
        });

        const sessionData = await sessionResponse.json();
        console.log('Session check response:', sessionData); // Debug

        if (!sessionResponse.ok || !sessionData.authenticated || sessionData.role !== 'admin') {
            console.error('Access denied:', sessionData);
            window.location.href = sessionData.authenticated ? '403.html' : 'login.html';
            return;
        }

        const userDetailsResponse = await fetch('/user-details', {
            method: 'GET',
            credentials: 'include'
        });

        const userDetails = await userDetailsResponse.json();
        if (userDetails.success) {
            document.getElementById('studentName').textContent = `${userDetails.user.firstName} ${userDetails.user.lastName}`;
            document.getElementById('studentID').textContent = userDetails.user.studentIDNumber;
            // Define studentIDNumber for use in fetchGrades()
            window.studentIDNumber = userDetails.user.studentIDNumber;
        } else {
            console.error('Failed to fetch user details:', userDetails.message);
        }
    } catch (error) {
        console.error('Error during validation or fetching user details:', error);
        window.location.href = 'login.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dashboardLink = document.getElementById('dashboardLink');
    const addGradesLink = document.getElementById('addGradesLink');
    const reportsLink = document.getElementById('reportsLink');

    const dashboardSection = document.getElementById('dashboardSection');
    const addGradesSection = document.getElementById('addGradesSection');
    const reportsSection = document.getElementById('reportsSection');

    // Tab switching functionality
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabs = document.querySelectorAll('.tab');

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tabId = link.getAttribute('data-tab');

            // Remove active class from all tab links
            tabLinks.forEach(link => link.classList.remove('active'));

            // Add active class to clicked tab link
            link.classList.add('active');

            // Hide all tabs
            tabs.forEach(tab => tab.classList.remove('active'));

            // Show selected tab
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Function to switch sections
    function switchSection(activeLink, activeSection) {
        // Remove active class from all links
        document.querySelectorAll('.sidebar-nav li a').forEach(link => link.classList.remove('active'));

        // Hide all sections
        dashboardSection.classList.add('hidden');
        addGradesSection.classList.add('hidden');
        reportsSection.classList.add('hidden');

        // Activate selected link and show selected section
        activeLink.classList.add('active');
        activeSection.classList.remove('hidden');
    }

    // Event listeners for sidebar links
    dashboardLink.addEventListener('click', () => switchSection(dashboardLink, dashboardSection));
    addGradesLink.addEventListener('click', () => switchSection(addGradesLink, addGradesSection));
    reportsLink.addEventListener('click', () => switchSection(reportsLink, reportsSection));
});


        // dashboard.html or your JavaScript fi
async function fetchGrades() {
    try {
        const response = await fetch('/get-grades/' + encodeURIComponent(studentIDNumber), {
            method: 'GET',
            credentials: 'include'
        });
        const data = await response.json();

        if (data.success) {
            displayGrades(data.gradeDataArray);
        } else {
            console.error('Failed to fetch grades:', data.message);
        }
    } catch (error) {
        console.error('Error fetching grades:', error);
    }
}

function displayGrades(gradeDataArray) {
    const gradesTableBody = document.getElementById('gradesTableBody');
    gradesTableBody.innerHTML = '';

    gradeDataArray.forEach(grade => {
        const row = `<tr>
        <td>${escapeHTML(grade.courseID)}</td>
        <td>${escapeHTML(grade.courseDescription)}</td>
        <td>${escapeHTML(grade.midtermGrade)}</td>
        <td>${escapeHTML(grade.transmutedMidtermGrade)}</td>
        <td>${escapeHTML(grade.finalGrade)}</td>
        <td>${escapeHTML(grade.totalFinalGrade)}</td>
        </tr>`;
        gradesTableBody.innerHTML += row;
    });
}

// Perform search
async function performSearch() {
    currentPage = 1; // Reset to the first page on a new search
    const searchInput = document.getElementById('searchInput').value;
    const searchQuery = searchInput.trim();
    
    // Check if the search query is empty
    if (!searchQuery) {
        alert('Please enter a search query.');
        return;
    }
    try {
            // Send search request to the server
            const response = await fetch(`/search?query=${encodeURIComponent(searchQuery)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include' // Include credentials for session handling
            });

            if (!response.ok) {
                throw new Error('Failed to perform search.');
            }

            const data = await response.json();

            if (data.success) {
                // Update the table with results
                displayResults(data.results);
                setupPagination(searchResultsData);
                displayPage(currentPage);
            } else {
                console.error('No results found:', data.message);
                document.getElementById('searchResults').innerHTML = `<p class="no-results">${data.message}</p>`;
            }
        } catch (error) {
            console.error('Error performing search:', error);
        }
    }





// Event listeners for search button and Enter key
document.getElementById('searchButton').addEventListener('click', performSearch);
document.getElementById('searchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Display search results in a table
function displayResults(results) {
    searchResultsData = results; // Store results for pagination
    setupPagination(results);
    displayPage(currentPage);
}

function displayPage(page) {
    const tableBody = document.getElementById('searchResults');
    tableBody.innerHTML = '';

    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedResults = searchResultsData.slice(startIndex, endIndex);

    if (paginatedResults.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="no-results">No results found.</td></tr>';
        return;
    }

    paginatedResults.forEach(result => {
        const row = `<tr>
    <td>${escapeHTML(result.studentIDNumber) || 'N/A'}</td>
    <td>${escapeHTML(result.firstName)} ${escapeHTML(result.lastName)}</td>
    <td>${escapeHTML(result.CourseID) || 'N/A'}</td>
    <td>${escapeHTML(result.CourseDescription) || 'N/A'}</td>
    <td>${escapeHTML(result.MG) || 'N/A'}</td>
    <td>${escapeHTML(result.transmutedMidtermGrade) || 'N/A'}</td>
    <td>${escapeHTML(result.FG) || 'N/A'}</td>
    <td>${escapeHTML(result.totalFinalGrade) || 'N/A'}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}


// Logout functionality
document.getElementById('logoutLink').addEventListener('click', function (event) {
    event.preventDefault();

    fetch('/logout', {
        method: 'POST',
        credentials: 'include' // Include credentials for session handling
    })
    .then(response => {
        if (response.ok) {
            window.location.href = 'login.html'; // Redirect to login page
        } else {
            console.error('Logout failed');
        }
    })
    .catch(error => {
        console.error('Error during logout:', error);
    });
});

document.getElementById('uploadForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    
const formData = new FormData(this);
const xhr = new XMLHttpRequest();

// Show the progress bar
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('uploadProgress');
const progressText = document.getElementById('progressText');
progressContainer.style.display = 'block';

xhr.open('POST', '/upload-grades', true);

// Monitor progress
xhr.upload.addEventListener('progress', function (event) {
    if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        progressBar.value = percentComplete;
        progressText.textContent = `${percentComplete}%`;
    }
});

// Handle completion
xhr.onload = function () {
    if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
            alert('Grades uploaded successfully!');
        } else {
            alert('Failed to upload grades: ' + response.message);
        }
    } else {
        alert('An error occurred during the upload.');
    }
    // Reset progress bar
    progressBar.value = 0;
    progressText.textContent = '0%';
    progressContainer.style.display = 'none';
};

// Handle errors
xhr.onerror = function () {
    alert('An error occurred during the upload.');
    progressBar.value = 0;
    progressText.textContent = '0%';
    progressContainer.style.display = 'none';
};

// Send the form data
xhr.send(formData);


    try {
        const response = await fetch('/upload-grades', {
            method: 'POST',
            body: formData,
            credentials: 'include' // Ensure session is maintained
        });

        const result = await response.json();

        if (result.success) {
            alert('Grades uploaded successfully!');
        } else {
            alert('Failed to upload grades: ' + result.message);
        }
    } catch (error) {
        console.error('Error uploading grades:', error);
        alert('An error occurred while uploading grades.');
    }
});

async function uploadGrades(file) {
try {
const formData = new FormData();
formData.append('gradesFile', file);

const response = await fetch('/upload-grades', {
    method: 'POST',
    body: formData,
    credentials: 'include' // Include cookies for session-based auth
});

if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
}

const result = await response.json();
console.log('Upload response:', result);

if (result.success) {
    alert('Grades uploaded successfully!');
} else {
    console.error('Failed to upload grades:', result.message);
}
} catch (error) {
console.error('Error uploading grades:', error);
}
}

let currentPage = 1;
const rowsPerPage = 5; // Adjust as needed
let searchResultsData = [];



function setupPagination(results) {
const paginationContainer = document.getElementById('pagination');
paginationContainer.innerHTML = ''; // Clear previous buttons

const totalPages = Math.ceil(results.length / rowsPerPage);

// Create First Button
const firstButton = createPaginationButton('First', 1, currentPage === 1);
paginationContainer.appendChild(firstButton);

// Create Previous Button
const prevButton = createPaginationButton('Previous', currentPage - 1, currentPage === 1);
paginationContainer.appendChild(prevButton);

// Create Next Button
const nextButton = createPaginationButton('Next', currentPage + 1, currentPage === totalPages);
paginationContainer.appendChild(nextButton);

// Create Last Button
const lastButton = createPaginationButton('Last', totalPages, currentPage === totalPages);
paginationContainer.appendChild(lastButton);
}

function createPaginationButton(label, targetPage, disabled) {
const button = document.createElement('button');
button.textContent = label;
button.disabled = disabled;

button.addEventListener('click', () => {
if (!disabled) {
    currentPage = targetPage;
    displayPage(currentPage); // Update displayed results
    setupPagination(searchResultsData); // Update button states
}
});

return button;
}

// Function to escape HTML to prevent XSS
function escapeHTML(text) {
if (!text) return text;
return text.replace(/[&<>"'`=\/]/g, function (char) {
return {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
}[char];
});
}

document.getElementById('attendanceUploadForm').addEventListener('submit', async function (event) {
event.preventDefault();

const formData = new FormData(this); // Automatically includes the term input

const xhr = new XMLHttpRequest();

// Show the progress bar
const progressContainer = document.getElementById('attendanceProgressContainer');
const progressBar = document.getElementById('attendanceUploadProgress');
const progressText = document.getElementById('attendanceProgressText');
progressContainer.style.display = 'block';

xhr.open('POST', '/upload-attendance', true);

// Monitor progress
xhr.upload.addEventListener('progress', function (event) {
if (event.lengthComputable) {
    const percentComplete = Math.round((event.loaded / event.total) * 100);
    progressBar.value = percentComplete;
    progressText.textContent = `${percentComplete}%`;
}
});

// Handle completion
xhr.onload = function () {
if (xhr.status === 200) {
    const response = JSON.parse(xhr.responseText);
    if (response.success) {
        alert('Attendance uploaded successfully!');
    } else {
        alert('Failed to upload attendance: ' + response.message);
    }
} else {
    alert('An error occurred during the upload.');
}
// Reset progress bar
progressBar.value = 0;
progressText.textContent = '0%';
progressContainer.style.display = 'none';
};

// Handle errors
xhr.onerror = function () {
alert('An error occurred during the upload.');
progressBar.value = 0;
progressText.textContent = '0%';
progressContainer.style.display = 'none';
};

// Send the form data
xhr.send(formData);
});


