document.addEventListener('DOMContentLoaded', () => {
    const blogId = 'blog5'; // Identifier for the current blog post
    const commentsContainer = document.getElementById('commentsContainer');
    const commentForm = document.getElementById('commentForm');
    const commentInput = document.getElementById('commentInput');
    const anonymousCheckbox = document.getElementById('anonymousCheckbox');
    const commentError = document.getElementById('commentError');

    let isAuthenticated = false; // Flag to track authentication status


    // Function to check if user is authenticated
    const checkAuthentication = () => {
        return fetch('/session-check', { credentials: 'include' })
            .then(response => response.json())
            .then(data => {
                isAuthenticated = data.authenticated;
            })
            .catch(error => {
                console.error('Error checking authentication:', error);
            });
    };

    // Function to fetch and display comments
    const loadComments = () => {
        fetch(`/api/comments/${blogId}`, {
            credentials: 'include' // Include cookies for session
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                commentsContainer.innerHTML = '';
                data.comments.forEach(comment => {
                    const commentDiv = document.createElement('div');
                    commentDiv.classList.add('mb-4', 'p-4', 'border', 'rounded-lg');
                    
                    const userPara = document.createElement('p');
                    userPara.classList.add('font-semibold');
                    userPara.textContent = comment.username;

                    const datePara = document.createElement('p');
                    datePara.classList.add('text-sm', 'text-gray-500');
                    const date = new Date(comment.createdAt);
                    datePara.textContent = date.toLocaleString();

                    const commentPara = document.createElement('p');
                    commentPara.classList.add('mt-2', 'text-gray-700');
                    commentPara.textContent = comment.comment;

                    commentDiv.appendChild(userPara);
                    commentDiv.appendChild(datePara);
                    commentDiv.appendChild(commentPara);

                    commentsContainer.appendChild(commentDiv);
                });
            } else {
                commentsContainer.innerHTML = '<p class="text-gray-500">No comments yet. Be the first to comment!</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching comments:', error);
            commentsContainer.innerHTML = '<p class="text-red-500">Failed to load comments.</p>';
        });
    };

    // Initial load
    checkAuthentication().then(() => {
        loadComments();
    });

    // Handle comment form submission
    commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const commentText = commentInput.value.trim();
        const isAnonymous = anonymousCheckbox.checked; 

        
        if (commentText === '') {
            commentError.textContent = 'Comment cannot be empty.';
            return;
        }

        fetch(`/api/comments/${blogId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                comment: commentText,
                isAnonymous
            })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
        .then(data => {
            if (data.success) {
                commentInput.value = '';
                anonymousCheckbox.checked = false;
                commentError.textContent = '';
                loadComments();
            } else {
                commentError.textContent = data.message || 'Failed to post comment.';
            }
        })
        .catch(error => {
            console.error('Error posting comment:', error);
            commentError.textContent = 'An error occurred while posting your comment.';
        });
    });
});
