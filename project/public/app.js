// Global state
const state = {
    users: {},
    apiBaseUrl: 'http://localhost:3000/api',
    activityPubBaseUrl: ''
};

// Helper function to normalize URLs for local development
function normalizeUrl(url) {
    return url;
}

// Helper function to generate a UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Toast component
    const toastEl = document.getElementById('liveToast');
    window.toast = new bootstrap.Toast(toastEl);
    
    // Create users if they don't exist
    createUsersIfNeeded()
        .then(() => {
            // Load initial data for both users
            loadUserCheckins('user1');
            loadUserCheckins('user2');
            loadUserProfile('user1');
            loadUserProfile('user2');
            updateStats('user1');
            updateStats('user2');
        })
        .catch(error => {
            showToast('Error', error.message);
        });
        
    // Add event listeners for tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const user = this.closest('.user-panel').id.split('-')[0];
            const tabName = this.getAttribute('onclick').split("'")[1];
            if (tabName === 'following') {
                loadFollowingData(user);
            }
        });
    });
});

// Tab navigation
function showTab(user, tabName) {
    // Hide all tab contents for this user
    const tabContents = document.querySelectorAll(`#${user}-panel .tab-content`);
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Deactivate all tab buttons for this user
    const tabButtons = document.querySelectorAll(`#${user}-panel .tab-btn`);
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Activate the selected tab and button
    document.getElementById(`${user}-${tabName}`).classList.add('active');
    
    // Find and activate the button
    const activeButton = Array.from(tabButtons).find(btn => 
        btn.getAttribute('onclick').includes(`'${tabName}'`)
    );
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// Create a new check-in
async function createCheckin(user) {
    try {
        const username = user === 'user1' ? 'alice' : 'bob';
        const userId = state.users[username].id;
        
        const content = document.getElementById(`${user}-content`).value;
        const locationName = document.getElementById(`${user}-location-name`).value;
        const latitude = parseFloat(document.getElementById(`${user}-latitude`).value);
        const longitude = parseFloat(document.getElementById(`${user}-longitude`).value);
        const imageUrl = document.getElementById(`${user}-image-url`).value || null;
        
        // Make the actual API call
        const response = await fetch(`${state.apiBaseUrl}/checkins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                content,
                latitude,
                longitude,
                locationName,
                imageUrl
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create check-in');
        }
        
        // Reset form
        document.getElementById(`${user}-checkin-form`).reset();
        
        // Load new check-ins
        loadUserCheckins('user1');
        loadUserCheckins('user2');
        
        // Update stats
        updateStats('user1');
        updateStats('user2');
        
        // Show success message
        showToast('Check-in Created', 'Your check-in has been posted successfully!');
        
        // Switch to feed tab
        showTab(user, 'feed');
        
    } catch (error) {
        showToast('Error', error.message);
    }
}

// Load user check-ins
async function loadUserCheckins(user) {
    try {
        const username = user === 'user1' ? 'alice' : 'bob';
        const feedContainer = document.getElementById(`${user}-feed-container`);
        
        // Set loading state
        feedContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading check-ins...</p>';
        
        // Fetch user's feed from API
        const response = await fetch(`${state.apiBaseUrl}/checkins/feed/user/${username}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load check-ins');
        }
        
        const checkins = await response.json();
        
        if (checkins.length === 0) {
            feedContainer.innerHTML = '<p class="text-center text-muted">No check-ins yet</p>';
            return;
        }
        
        // Create HTML for check-ins
        const checkinsHtml = checkins.map(checkin => {
            const isOwnCheckin = checkin.username === username;
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(checkin.display_name || checkin.username)}&background=random`;
            const date = new Date(checkin.created_at).toLocaleString();
            
            return `
                <div class="checkin-card">
                    <div class="checkin-header">
                        <img src="${avatarUrl}" alt="${checkin.display_name || checkin.username}" class="checkin-avatar">
                        <div class="checkin-user-info">
                            <h5>${checkin.display_name || checkin.username}</h5>
                            <p>@${checkin.username}</p>
                        </div>
                    </div>
                    <div class="checkin-content">
                        <p class="checkin-text">${checkin.content}</p>
                        ${checkin.image_url ? `<img src="${checkin.image_url}" alt="Check-in image" class="checkin-image">` : ''}
                        <div class="checkin-location">
                            <i class="fas fa-map-marker-alt"></i> ${checkin.location_name} 
                            <span class="ms-2 small">(${checkin.latitude.toFixed(4)}, ${checkin.longitude.toFixed(4)})</span>
                        </div>
                    </div>
                    <div class="checkin-footer">
                        <span><i class="far fa-clock"></i> ${date}</span>
                        <span>${isOwnCheckin ? '<i class="fas fa-user-circle"></i> Your check-in' : ''}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        feedContainer.innerHTML = checkinsHtml;
    } catch (error) {
        console.error('Error loading check-ins:', error);
        const feedContainer = document.getElementById(`${user}-feed-container`);
        feedContainer.innerHTML = `<p class="text-center text-danger">Error loading check-ins: ${error.message}</p>`;
        showToast('Error', error.message);
    }
}

// Toggle follow/unfollow
async function toggleFollow(user, targetUsername, button) {
    try {
        // Disable the button during the operation
        button.disabled = true;
        
        const username = user === 'user1' ? 'alice' : 'bob';
        const userId = state.users[username].id;
        
        // Check if already following - determine from button state
        const isFollowing = button.textContent === 'Unfollow';
        
        // Create a follow or unfollow activity and send it to the appropriate inbox
        // This would trigger ActivityPub federation
        if (isFollowing) {
            // Unfollow - create an Undo activity for the original Follow
            try {
                // Find the following relationship to remove
                const followingResponse = await fetch(`${state.apiBaseUrl}/users/${username}/following`);
                if (followingResponse.ok) {
                    const following = await followingResponse.json();
                    const targetFollow = following.find(f => f.following_actor_id.includes(targetUsername));
                    
                    if (targetFollow) {
                        // Get the user's outbox URL from their profile
                        // Get the target user's inbox URL
                        if (!state.users[targetUsername] || !state.users[targetUsername].inbox_url) {
                            // If we don't have the target user's data, load it first
                            await loadUserProfile({ username: targetUsername });
                        }
                        
                        let inboxUrl = state.users[targetUsername].inbox_url;
                        if (!inboxUrl) {
                            throw new Error(`Could not find inbox URL for ${targetUsername}`);
                        }
                        
                        // Normalize URL for local development
                        inboxUrl = normalizeUrl(inboxUrl);
                        
                        // Create an Undo activity and send it directly to the target's inbox
                        console.log(`Unfollowing ${targetUsername}...`);
                        try {
                            console.log(`Sending Undo activity to ${targetUsername}'s inbox`);
                            
                            // Generate a UUID for the activity
                            const uuid = generateUUID();
                            const actorUrl = normalizeUrl(state.users[username]?.actor_id || `http://${window.location.host}/users/${username}`);
                            const targetUrl = normalizeUrl(state.users[targetUsername]?.actor_id || `http://${window.location.host}/users/${targetUsername}`);
                            
                            console.log(`Actor: ${actorUrl}`);
                            console.log(`Target: ${targetUrl}`);
                            
                            const unfollowResponse = await fetch(inboxUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    '@context': 'https://www.w3.org/ns/activitystreams',
                                    type: 'Undo',
                                    id: `http://${window.location.host}/activities/${uuid}`,
                                    actor: actorUrl,
                                    object: {
                                        type: 'Follow',
                                        id: `http://${window.location.host}/activities/${generateUUID()}`,
                                        actor: actorUrl,
                                        object: targetUrl
                                    }
                                })
                            });
                            
                            if (!unfollowResponse.ok) {
                                try {
                                    const errorData = await unfollowResponse.json();
                                    throw new Error(errorData.error || `Server returned ${unfollowResponse.status}: ${unfollowResponse.statusText}`);
                                } catch (jsonError) {
                                    throw new Error(`Failed to unfollow user: ${unfollowResponse.status} ${unfollowResponse.statusText}`);
                                }
                            }
                        } catch (networkError) {
                            console.error('Network error:', networkError);
                            throw new Error(`Network error: ${networkError.message}`);
                        }
                        
                        const localUpdateResponse = await fetch(`${state.apiBaseUrl}/users/${username}/unfollow`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                targetUsername: targetUsername
                            })
                        });
                        
                        if (!localUpdateResponse.ok) {
                            console.warn('Failed to update local following status. Remote unfollow succeeded but local state may be out of sync.');
                        }
                        
                        // Update UI
                        button.textContent = 'Follow';
                        button.classList.remove('btn-outline-danger');
                        button.classList.add('btn-outline-primary');
                        
                        showToast('Unfollowed', `You have unfollowed @${targetUsername}`);
                    } else {
                        throw new Error(`You are not following ${targetUsername}`);
                    }
                } else {
                    throw new Error('Failed to get following list');
                }
            } catch (error) {
                console.error('Error unfollowing:', error);
                throw new Error(`Failed to unfollow ${targetUsername}: ${error.message}`);
            }
        } else {
            // Follow - create a new Follow activity
            try {
                // In a full implementation, this would create a Follow activity in our outbox
                // and deliver it to the target's inbox
                console.log(`Following ${targetUsername}...`);
                
                // Get the target user's inbox URL
                if (!state.users[targetUsername] || !state.users[targetUsername].inbox_url) {
                    // If we don't have the target user's data, load it first
                    await loadUserProfile({ username: targetUsername });
                }
                
                let inboxUrl = state.users[targetUsername].inbox_url;
                if (!inboxUrl) {
                    throw new Error(`Could not find inbox URL for ${targetUsername}`);
                }
                
                // Normalize URL for local development
                inboxUrl = normalizeUrl(inboxUrl);
                
                console.log(`Target inbox URL: ${inboxUrl}`);
                // Create and send a Follow activity directly to the target's inbox
                try {
                    console.log(`Sending Follow activity to ${targetUsername}'s inbox`);
                    
                    // Generate a UUID-compatible random ID for the activity
                    const uuid = generateUUID();
                    const actorUrl = normalizeUrl(state.users[username]?.actor_id || `http://${window.location.host}/users/${username}`);
                    const targetUrl = normalizeUrl(state.users[targetUsername]?.actor_id || `http://${window.location.host}/users/${targetUsername}`);
                    
                    console.log(`Actor: ${actorUrl}`);
                    console.log(`Target: ${targetUrl}`);
                    
                    const followResponse = await fetch(inboxUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            '@context': 'https://www.w3.org/ns/activitystreams',
                            type: 'Follow',
                            id: `http://${window.location.host}/activities/${uuid}`,
                            actor: actorUrl,
                            object: targetUrl
                        })
                    });
                    
                    if (!followResponse.ok) {
                        try {
                            const errorData = await followResponse.json();
                            throw new Error(errorData.error || `Server returned ${followResponse.status}: ${followResponse.statusText}`);
                        } catch (jsonError) {
                            throw new Error(`Failed to follow user: ${followResponse.status} ${followResponse.statusText}`);
                        }
                    }
                } catch (networkError) {
                    console.error('Network error:', networkError);
                    throw new Error(`Network error: ${networkError.message}`);
                }
                
                // Update UI
                button.textContent = 'Unfollow';
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-outline-danger');
                
                showToast('Following', `You are now following @${targetUsername}`);
            } catch (error) {
                console.error('Error following:', error);
                throw new Error(`Failed to follow ${targetUsername}: ${error.message}`);
            }
        }
        
        // Enable the button again
        button.disabled = false;
        
        // Update stats by loading fresh data
        await Promise.all([
            loadUserProfile('user1'),
            loadUserProfile('user2')
        ]);
        
        // Refresh feeds
        await Promise.all([
            loadUserCheckins('user1'),
            loadUserCheckins('user2')
        ]);
    } catch (error) {
        showToast('Error', error.message);
        // Re-enable the button in case of error
        button.disabled = false;
    }
}

// Update user stats
async function updateStats(user) {
    try {
        const username = user === 'user1' ? 'alice' : 'bob';
        
        if (!state.users[username]) {
            console.warn(`User ${username} not loaded yet`);
            return;
        }
        
        // We'd ideally get this information from the API
        // For now, set defaults if data isn't available
        document.getElementById(`${user}-checkin-count`).textContent = state.users[username].checkin_count || 0;
        document.getElementById(`${user}-following-count`).textContent = state.users[username].following_count || 0;
        document.getElementById(`${user}-followers-count`).textContent = state.users[username].followers_count || 0;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Create users if needed and load their profiles
async function createUsersIfNeeded() {
    try {
        // Try to load Alice
        let aliceResponse = await fetch(`${state.apiBaseUrl}/users/alice`);
        // If Alice doesn't exist, create her
        if (aliceResponse.status === 404) {
            aliceResponse = await fetch(`${state.apiBaseUrl}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'alice',
                    displayName: 'Alice Johnson',
                    summary: 'Hello, I\'m Alice!'
                })
            });
            
            if (!aliceResponse.ok) {
                const errorData = await aliceResponse.json();
                throw new Error(errorData.error || 'Failed to create Alice');
            }
            
            showToast('User Created', 'Created user Alice Johnson');
        } else if (!aliceResponse.ok) {
            const errorData = await aliceResponse.json();
            throw new Error(errorData.error || 'Failed to check if Alice exists');
        }
        
        // Try to load Bob
        let bobResponse = await fetch(`${state.apiBaseUrl}/users/bob`);
        
        // If Bob doesn't exist, create him
        if (bobResponse.status === 404) {
            bobResponse = await fetch(`${state.apiBaseUrl}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'bob',
                    displayName: 'Bob Smith',
                    summary: 'Hello, I\'m Bob!'
                })
            });
            
            if (!bobResponse.ok) {
                const errorData = await bobResponse.json();
                throw new Error(errorData.error || 'Failed to create Bob');
            }
            
            showToast('User Created', 'Created user Bob Smith');
        } else if (!bobResponse.ok) {
            const errorData = await bobResponse.json();
            throw new Error(errorData.error || 'Failed to check if Bob exists');
        }
        
        // Load the user profiles after creation
        await Promise.all([
            loadUserProfile('user1'),
            loadUserProfile('user2')
        ]);
        
        console.log('Users created or already exist');
    } catch (error) {
        console.error('Error creating/loading users:', error);
        throw error;
    }
}

// Show toast notification
function showToast(title, message) {
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-message').textContent = message;
    document.getElementById('toast-time').textContent = 'just now';
    
    window.toast.show();
}

// Load user profile data
async function loadUserProfile(user) {
    try {
        const username = user === 'user1' ? 'alice' : 'bob';
        
        // Set loading state
        const profileNameEl = document.getElementById(`${user}-profile-name`);
        const profileUsernameEl = document.getElementById(`${user}-profile-username`);
        const profileBioEl = document.getElementById(`${user}-profile-bio`);
        
        if (profileNameEl && profileUsernameEl && profileBioEl) {
            profileNameEl.textContent = 'Loading...';
            profileUsernameEl.textContent = `@${username}`;
            profileBioEl.textContent = 'Loading profile information...';
        }
        
        // Fetch user profile
        const response = await fetch(`${state.apiBaseUrl}/users/${username}`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to load profile for ${username}`);
        }
        
        const userData = await response.json();
        
        // Get counts for stats
        // In a production app, these would come from the API
        // Here we're manually setting them since our API doesn't return them directly
        const followersResponse = await fetch(`${state.apiBaseUrl}/users/${username}/followers`);
        const followingResponse = await fetch(`${state.apiBaseUrl}/users/${username}/following`);
        
        if (followersResponse.ok && followingResponse.ok) {
            const followers = await followersResponse.json();
            const following = await followingResponse.json();
            
            userData.followers_count = followers.length;
            userData.following_count = following.length;
            userData.followers = followers;
            userData.following = following;
            userData.checkin_count = 0; // This would come from a real API endpoint
        }
        
        // Store in state
        state.users[username] = userData;
        
        // Update all profile UI elements
        updateProfileUI(user, userData);
        
        // Load following data
        loadFollowingData(user);
        
        return userData;
    } catch (error) {
        console.error(`Error loading profile for ${user}:`, error);
        showToast('Error', error.message);
    }
}

// Update all profile UI elements
function updateProfileUI(user, userData) {
    // Update profile display
    const profileNameEl = document.getElementById(`${user}-profile-name`);
    const profileUsernameEl = document.getElementById(`${user}-profile-username`);
    const profileBioEl = document.getElementById(`${user}-profile-bio`);
    const headerNameEl = document.getElementById(`${user}-header-name`);
    const headerUsernameEl = document.getElementById(`${user}-header-username`);
    
    if (profileNameEl && profileUsernameEl) {
        profileNameEl.textContent = userData.display_name || userData.username;
        profileUsernameEl.textContent = `@${userData.username}`;
    }
    
    if (profileBioEl) {
        profileBioEl.textContent = userData.summary || 'No bio available';
    }
    
    if (headerNameEl) {
        headerNameEl.textContent = userData.display_name || userData.username;
    }
    
    if (headerUsernameEl) {
        headerUsernameEl.textContent = `@${userData.username}`;
    }
}

// Load following data for a user
async function loadFollowingData(user) {
    try {
        const username = user === 'user1' ? 'alice' : 'bob';
        const otherUsername = username === 'alice' ? 'bob' : 'alice';
        const followingContainer = document.getElementById(`${user}-following-container`);
        
        if (!followingContainer) return;
        
        // Show loading state
        followingContainer.innerHTML = '<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading following data...</p>';
        
        // Make sure user data is loaded
        if (!state.users[username]) {
            await loadUserProfile(user);
        }
        
        // Get following data from state
        const userData = state.users[username];
        const followingData = userData.following || [];
        
        if (followingData.length === 0) {
            followingContainer.innerHTML = '<p class="text-center text-muted">You are not following anyone yet</p>';
            return;
        }
        
        // Build HTML for following list
        let followingHtml = '';
        followingData.forEach(following => {
            // In a real app, we would have more complete data from the API
            // For now, we'll just show the basic info
            const followingName = following.following_actor_id.split('/').pop();
            
            followingHtml += `
                <div class="following-item">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(followingName)}&background=random" alt="${followingName}" class="following-avatar">
                    <div class="following-info">
                        <h5>${followingName}</h5>
                        <p>@${followingName}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="toggleFollow('${user}', '${followingName}', this)">Unfollow</button>
                </div>
            `;
        });
        
        followingContainer.innerHTML = followingHtml;
        
        // Check if suggested user's follow button should be Follow or Unfollow
        const suggestedUserButton = document.querySelector(`#${user}-following .mt-4 .following-item button`);
        if (suggestedUserButton) {
            // Check if we're already following the suggested user
            const isFollowing = followingData.some(f => 
                f.following_actor_id.includes(otherUsername));
            
            if (isFollowing) {
                suggestedUserButton.textContent = 'Unfollow';
                suggestedUserButton.classList.remove('btn-outline-primary');
                suggestedUserButton.classList.add('btn-outline-danger');
            } else {
                suggestedUserButton.textContent = 'Follow';
                suggestedUserButton.classList.remove('btn-outline-danger');
                suggestedUserButton.classList.add('btn-outline-primary');
            }
        }
    } catch (error) {
        console.error(`Error loading following data for ${user}:`, error);
        const followingContainer = document.getElementById(`${user}-following-container`);
        if (followingContainer) {
            followingContainer.innerHTML = `<p class="text-center text-danger">Error loading following data: ${error.message}</p>`;
        }
    }
}