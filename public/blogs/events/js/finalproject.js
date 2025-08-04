document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('submissionForm');
    const fileInput = document.getElementById('fileUpload');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const successMessage = document.getElementById('successMessage');
    const fileError = document.getElementById('fileError');
    const scheduleSelect = document.getElementById('scheduleSelect');

    // Load available schedules based on section
    document.getElementById('sectionSelect').addEventListener('change', function() {
        const section = this.value;
        if (!section) return;
        
        fetch(`/api/schedules?section=${section}`)
            .then(response => response.json())
            .then(data => {
                scheduleSelect.innerHTML = '<option value="">Select a Schedule</option>';
                data.schedules.forEach(schedule => {
                    const option = document.createElement('option');
                    option.value = schedule.id;
                    option.textContent = `${schedule.date} at ${schedule.time}`;
                    scheduleSelect.appendChild(option);
                });
            })
            .catch(error => {
                console.error('Error loading schedules:', error);
                scheduleSelect.innerHTML = '<option value="">Error loading schedules</option>';
            });
    });

    // Validate file before upload
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        fileError.classList.add('hidden');
        
        if (file) {
            if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
                fileError.textContent = 'Only .zip files are allowed';
                fileError.classList.remove('hidden');
                this.value = '';
                return;
            }
            
            if (file.size > 50 * 1024 * 1024) { // 50MB
                fileError.textContent = 'File size exceeds 50MB limit';
                fileError.classList.remove('hidden');
                this.value = '';
                return;
            }
        }
    });

    // Handle form submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const submitButton = form.querySelector('button[type="submit"]');
        
        try {
            submitButton.disabled = true;
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
            
            // Create AJAX request
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);
            
            // Update progress
            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = `${percentComplete}%`;
                }
            };
            
            xhr.onload = function() {
                progressContainer.classList.add('hidden');
                submitButton.disabled = false;
                
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        showSuccessMessage();
                        form.reset();
                    } else {
                        showError(response.message || 'Submission failed');
                    }
                } else {
                    const error = JSON.parse(xhr.responseText);
                    showError(error.message || 'Server error');
                }
            };
            
            xhr.onerror = function() {
                progressContainer.classList.add('hidden');
                submitButton.disabled = false;
                showError('Network error occurred');
            };
            
            xhr.send(formData);
            
        } catch (error) {
            console.error('Submission error:', error);
            submitButton.disabled = false;
            progressContainer.classList.add('hidden');
            showError('An unexpected error occurred');
        }
    });
    
    function showSuccessMessage() {
        successMessage.classList.remove('hidden');
        setTimeout(() => {
            successMessage.classList.add('hidden');
        }, 5000);
    }
    
    function showError(message) {
        // You could add an error display element to show this
        alert(`Error: ${message}`);
    }
});