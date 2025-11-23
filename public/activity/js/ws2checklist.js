document.addEventListener('DOMContentLoaded', () => {
    const chartColors = {
        completed: 'rgb(79, 70, 229)',
        remaining: 'rgb(229, 231, 235)'
    };
    
    const bonusChartColors = {
        completed: 'rgb(107, 114, 128)',
        remaining: 'rgb(229, 231, 235)'
    };

    const coreTasks = document.querySelectorAll('.core-task .task-checkbox');
    const bonusTasks = document.querySelectorAll('.bonus-task .task-checkbox');
    const allTaskItems = document.querySelectorAll('.task-item');

    const coreProgressText = document.getElementById('coreProgressText');
    const bonusProgressText = document.getElementById('bonusProgressText');

    // Create Chart.js donut charts
    const createChart = (ctx, colors) => {
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Remaining'],
                datasets: [{
                    data: [0, 1],
                    backgroundColor: [colors.completed, colors.remaining],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: true
                    }
                }
            }
        });
    };

    const coreChart = createChart(document.getElementById('coreProgressChart').getContext('2d'), chartColors);
    const bonusChart = createChart(document.getElementById('bonusProgressChart').getContext('2d'), bonusChartColors);

    // Update progress counters and charts
    function updateProgress() {
        const coreCompleted = document.querySelectorAll('.core-task .task-checkbox:checked').length;
        const coreTotal = coreTasks.length;
        coreProgressText.textContent = `Core Tasks: ${coreCompleted} / ${coreTotal}`;
        coreChart.data.datasets[0].data[0] = coreCompleted;
        coreChart.data.datasets[0].data[1] = coreTotal - coreCompleted;
        coreChart.update();

        const bonusCompleted = document.querySelectorAll('.bonus-task .task-checkbox:checked').length;
        const bonusTotal = bonusTasks.length;
        bonusProgressText.textContent = `Bonus Tasks: ${bonusCompleted} / ${bonusTotal}`;
        bonusChart.data.datasets[0].data[0] = bonusCompleted;
        bonusChart.data.datasets[0].data[1] = bonusTotal - bonusCompleted;
        bonusChart.update();
    }
    
    // Attach change listeners to all task checkboxes
    coreTasks.forEach(task => task.addEventListener('change', updateProgress));
    bonusTasks.forEach(task => task.addEventListener('change', updateProgress));

    // ============ FILTER FUNCTIONALITY ============
    const filterButtons = document.querySelectorAll('.filter-btn');
    const filterAll = document.getElementById('filter-all');
    const filterRemaining = document.getElementById('filter-remaining');
    const filterCompleted = document.getElementById('filter-completed');
    
    function setActiveButton(activeBtn) {
        filterButtons.forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'text-white');
            btn.classList.add('bg-white', 'text-indigo-600', 'border', 'border-indigo-600');
        });
        activeBtn.classList.add('bg-indigo-600', 'text-white');
        activeBtn.classList.remove('bg-white', 'text-indigo-600', 'border', 'border-indigo-600');
    }

    filterAll.addEventListener('click', () => {
        allTaskItems.forEach(item => item.classList.remove('hidden'));
        setActiveButton(filterAll);
    });

    filterRemaining.addEventListener('click', () => {
        allTaskItems.forEach(item => {
            const checkbox = item.querySelector('.task-checkbox');
            if (checkbox.checked) {
                item.classList.add('hidden');
            } else {
                item.classList.remove('hidden');
            }
        });
        setActiveButton(filterRemaining);
    });

    filterCompleted.addEventListener('click', () => {
        allTaskItems.forEach(item => {
            const checkbox = item.querySelector('.task-checkbox');
            if (!checkbox.checked) {
                item.classList.add('hidden');
            } else {
                item.classList.remove('hidden');
            }
        });
        setActiveButton(filterCompleted);
    });

    // Initialize progress on page load
    updateProgress();
});

// ============ SAVE CHECKLIST STATE TO LOCALSTORAGE ============
window.addEventListener('beforeunload', () => {
    const state = {};
    document.querySelectorAll('.task-checkbox').forEach((cb, i) => {
        state[i] = cb.checked;
    });
    localStorage.setItem('checklist', JSON.stringify(state));
});

// ============ FORM HANDLING ============
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('submissionForm');
    const submitBtn = document.getElementById('submitBtn');
    const addMemberBtn = document.getElementById('addMemberBtn');
    const membersContainer = document.getElementById('membersContainer');
    const confirmationModal = document.getElementById('confirmationModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const successBanner = document.getElementById('successBanner');

    if (!addMemberBtn) return; // Exit if form elements don't exist

    // ============ ADD MEMBER ============
    addMemberBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const memberField = document.createElement('div');
        memberField.className = 'member-field flex gap-2 mb-3';
        memberField.innerHTML = `
            <input type="text" class="member-input flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" 
                   placeholder="Member Name" required>
            <button type="button" class="remove-member bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">Remove</button>
        `;
        membersContainer.appendChild(memberField);

        // Attach remove listener to new button
        memberField.querySelector('.remove-member').addEventListener('click', (e) => {
            e.preventDefault();
            memberField.remove();
            updateRemoveButtons();
        });

        updateRemoveButtons();
    });

    // ============ UPDATE REMOVE BUTTONS VISIBILITY ============
    function updateRemoveButtons() {
        const removeButtons = document.querySelectorAll('.remove-member');
        const totalFields = document.querySelectorAll('.member-field').length;
        
        removeButtons.forEach(btn => {
            btn.classList.toggle('hidden', totalFields <= 1);
        });
    }

    updateRemoveButtons();

    // ============ SUBMIT BUTTON CLICK ============
    submitBtn.addEventListener('click', (e) => {
        e.preventDefault();

        // Collect form data
        const groupNumber = document.getElementById('groupNumber').value.trim();
        const projectUrl = document.getElementById('projectUrl').value.trim();
        const senderEmail = document.getElementById('senderEmail').value.trim();
        
        const memberInputs = document.querySelectorAll('.member-input');
        const members = Array.from(memberInputs)
            .map(input => input.value.trim())
            .filter(value => value);

        // Validate all required fields
        if (!groupNumber || !members.length || !projectUrl || !senderEmail) {
            alert('❌ Please fill in all required fields.');
            return;
        }

        // Show confirmation modal with review data
        const reviewData = document.getElementById('reviewData');
        reviewData.innerHTML = `
            <div class="space-y-3">
                <div>
                    <strong class="text-gray-700">Group Number:</strong>
                    <p class="text-indigo-600 font-mono">${groupNumber}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Members:</strong>
                    <p class="text-indigo-600">${members.join(', ')}</p>
                </div>
                <div>
                    <strong class="text-gray-700">Project URL:</strong>
                    <p class="text-indigo-600 truncate"><a href="${projectUrl}" target="_blank" class="underline">${projectUrl}</a></p>
                </div>
                <div>
                    <strong class="text-gray-700">Email Address:</strong>
                    <p class="text-indigo-600">${senderEmail}</p>
                </div>
            </div>
        `;

        confirmationModal.classList.remove('hidden');
    });

    // ============ CANCEL CONFIRMATION ============
    cancelBtn.addEventListener('click', () => {
        confirmationModal.classList.add('hidden');
    });

    // ============ CONFIRM AND SUBMIT ============
    confirmBtn.addEventListener('click', async () => {
        confirmationModal.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Submitting...';

        const groupNumber = document.getElementById('groupNumber').value.trim();
        const projectUrl = document.getElementById('projectUrl').value.trim();
        const senderEmail = document.getElementById('senderEmail').value.trim();
        
        const memberInputs = document.querySelectorAll('.member-input');
        const members = Array.from(memberInputs)
            .map(input => input.value.trim())
            .filter(value => value);

        try {
            // Collect checklist state
            const checklistSummary = {};
            document.querySelectorAll('.task-checkbox').forEach((checkbox) => {
                const section = checkbox.closest('[data-section]')?.getAttribute('data-section') || 'Other';
                const taskLabel = checkbox.nextElementSibling?.textContent || 'Unknown Task';
                
                if (!checklistSummary[section]) {
                    checklistSummary[section] = {};
                }
                checklistSummary[section][taskLabel] = checkbox.checked;
            });

            // Send submission to backend
            const response = await fetch('/api/activity/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupNumber: parseInt(groupNumber),
                    members: members,
                    projectUrl: projectUrl,
                    senderEmail: senderEmail,
                    checklistSummary: checklistSummary
                })
            });

            const data = await response.json();
            if (data.success) {
                confirmationModal.classList.add('hidden');
                successBanner.classList.remove('hidden');
                document.getElementById('refNumber').textContent = data.submissionNumber;
                form.reset();
                submitBtn.disabled = false;
                submitBtn.innerHTML = '🚀 Submit Project';
            } else {
                alert('Error: ' + data.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '🚀 Submit Project';
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 Submit Project';
        }
    });
});