// activity_reports.js - FIXED VERSION
document.addEventListener('DOMContentLoaded', () => {
    const filterForm = document.getElementById('filterForm');
    const reportsTableBody = document.getElementById('reportsTableBody');
    const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const searchInput = document.getElementById('searchInput');
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');

    console.log('DOM loaded, initializing...');

    async function fetchReports(params = {}) {
        try {
            console.log('Fetching reports with params:', params);
            const url = new URL('/api/activity/submissions', window.location.origin);
            Object.entries(params).forEach(([key, val]) => {
                if (val) url.searchParams.append(key, val);
            });

            console.log('API URL:', url.toString());
            const res = await fetch(url, { credentials: 'include' });
            console.log('Response status:', res.status);
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('Fetch error:', errorText);
                reportsTableBody.innerHTML = `<tr><td colspan="8">Error: ${res.status} ${res.statusText}</td></tr>`;
                return;
            }

            const data = await res.json();
            console.log('Fetched data:', data);
            displayReports(data.submissions || []);
        } catch (error) {
            console.error('Fetch failed:', error);
            reportsTableBody.innerHTML = `<tr><td colspan="8">Network Error: ${error.message}</td></tr>`;
        }
    }

    function displayReports(submissions) {
        console.log('Displaying reports:', submissions);
        reportsTableBody.innerHTML = '';

        if (!submissions || !submissions.length) {
            console.log('No submissions to display');
            reportsTableBody.innerHTML = '<tr><td colspan="8">No submissions found.</td></tr>';
            return;
        }

        console.log(`Rendering ${submissions.length} submissions`);
        
        submissions.forEach((sub, index) => {
            console.log(`Rendering submission ${index}:`, sub);
            
            const row = document.createElement('tr');
            
            // Fix checklist summary display
            let checklistDisplay = 'No checklist data';
            if (sub.checklistSummary && typeof sub.checklistSummary === 'object') {
                try {
                    // Count completed tasks
                    let completedCount = 0;
                    let totalCount = 0;
                    
                    Object.values(sub.checklistSummary).forEach(section => {
                        if (section && typeof section === 'object') {
                            Object.values(section).forEach(value => {
                                totalCount++;
                                if (value === true) completedCount++;
                            });
                        }
                    });
                    
                    checklistDisplay = `${completedCount}/${totalCount} tasks completed`;
                    
                } catch (e) {
                    console.error('Error processing checklist:', e);
                    checklistDisplay = 'Error processing checklist';
                }
            }

            row.innerHTML = `
                <td>${sub.submissionNumber || 'N/A'}</td>
                <td>${sub.groupNumber || 'N/A'}</td>
                <td>${(sub.members || []).join(', ') || 'N/A'}</td>
                <td><a href="${sub.projectUrl}" target="_blank">${sub.projectUrl || 'N/A'}</a></td>
                <td>${sub.senderEmail || 'N/A'}</td>
                <td>${sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}</td>
                <td>${sub.status || 'N/A'}</td>
                <td>${checklistDisplay}</td>
            `;
            
            reportsTableBody.appendChild(row);
        });
        
        console.log('Finished rendering table');
    }

    // Live search as you type
    searchInput.addEventListener('input', () => {
        const params = {
            search: searchInput.value,
            startDate: startDateInput.value,
            endDate: endDateInput.value
        };
        fetchReports(params);
    });

    // Handle filter form submit
    filterForm.addEventListener('submit', e => {
        e.preventDefault();
        const params = {
            search: searchInput.value,
            startDate: startDateInput.value,
            endDate: endDateInput.value
        };
        fetchReports(params);
    });

    // Download XLSX
    downloadXlsxBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            search: searchInput.value,
            startDate: startDateInput.value,
            endDate: endDateInput.value
        });
        window.open(`/api/activity/submissions/xlsx?${params.toString()}`, '_blank');
    });

    // Download PDF
    downloadPdfBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            search: searchInput.value,
            startDate: startDateInput.value,
            endDate: endDateInput.value
        });
        window.open(`/api/activity/submissions/pdf?${params.toString()}`, '_blank');
    });

    // Reset filters
    document.getElementById('resetFiltersBtn').addEventListener('click', () => {
        searchInput.value = '';
        startDateInput.value = '';
        endDateInput.value = '';
        fetchReports();
    });

    // Initial fetch
    console.log('Starting initial fetch...');
    fetchReports();

    // Add this at the end of your DOMContentLoaded event
setTimeout(() => {
    const debugDiv = document.getElementById('debugInfo');
    if (debugDiv) {
        debugDiv.innerHTML = `
            <h3>Debug Info:</h3>
            <p>Table Body: ${reportsTableBody ? 'Found' : 'Not Found'}</p>
            <p>Rows in table: ${reportsTableBody ? reportsTableBody.children.length : 0}</p>
        `;
    }
}, 1000);
});