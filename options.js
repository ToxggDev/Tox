// Default settings
const defaultSettings = {
    userName: '',
    userAvatar: 'U',
    groupId: '',
    groupName: '',
    autoShare: true,
    notifications: true
};

// Initialize the settings page
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
    setupEventListeners();
    loadHistory();
    
    // Debug load function to verify storage state
    chrome.storage.local.get(['username', 'groupId'], (result) => {
        console.log('Current storage values:', result);
    });
});

// Load saved settings
async function loadSettings() {
    const settings = await chrome.storage.local.get(Object.keys(defaultSettings));
    
    // Set values for all form fields
    Object.entries(settings).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
            }
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Save button
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
    
    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSettings);
    }
    
    // Avatar input - limit to one character
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.addEventListener('input', (e) => {
            if (e.target.value.length > 1) {
                e.target.value = e.target.value.slice(0, 1);
            }
            e.target.value = e.target.value.toUpperCase();
        });
    }

    // Save profile
    const saveProfileBtn = document.getElementById('saveProfile');
    const usernameInput = document.getElementById('username');
    const groupIdInput = document.getElementById('groupId');
    const profileStatus = document.getElementById('profileStatus');
    
    if (saveProfileBtn && usernameInput && groupIdInput && profileStatus) {
        console.log('Save profile button found, adding event listener');
        
        saveProfileBtn.addEventListener('click', () => {
            console.log('Save profile button clicked');
            const username = usernameInput.value;
            const groupId = groupIdInput.value;

            if (!username) {
                showStatus(profileStatus, 'Please enter a username', 'error');
                return;
            }

            console.log('Saving username:', username, 'Group ID:', groupId);
            chrome.storage.local.set({ 
                username,
                groupId
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error saving profile:', chrome.runtime.lastError);
                    showStatus(profileStatus, 'Error saving profile: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    console.log('Profile saved successfully');
                    showStatus(profileStatus, 'Profile saved successfully', 'success');
                }
            });
        });
    } else {
        console.error('One or more profile elements not found in the DOM', {
            saveProfileBtn: !!saveProfileBtn,
            usernameInput: !!usernameInput,
            groupIdInput: !!groupIdInput,
            profileStatus: !!profileStatus
        });
    }
}

// Save settings
async function saveSettings() {
    const settings = {};
    
    // Get values from all form fields
    Object.keys(defaultSettings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                settings[key] = element.checked;
            } else {
                settings[key] = element.value;
            }
        }
    });

    // Save to storage
    await chrome.storage.local.set(settings);
    
    // Show success message
    showMessage('Settings saved successfully!', 'success');
}

// Reset settings to defaults
async function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
        await chrome.storage.local.set(defaultSettings);
        loadSettings();
        showMessage('Settings reset to defaults', 'success');
    }
}

// Show message to user
function showMessage(message, type = 'success') {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    document.body.appendChild(messageElement);
    
    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

// Load history
function loadHistory() {
    chrome.storage.local.get(['history'], (result) => {
        const historyList = document.getElementById('historyList');
        const history = result.history || [];
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-state">No history available</div>';
            return;
        }
        
        historyList.innerHTML = history
            .map(item => `
                <div class="history-item">
                    <div class="history-content">${escapeHtml(item.content)}</div>
                    <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
            `)
            .join('');
    });
}

// Load user profile
function loadUserProfile() {
    chrome.storage.local.get(['username', 'groupId'], (result) => {
        if (result.username) {
            document.getElementById('username').value = result.username;
        }
        if (result.groupId) {
            document.getElementById('groupId').value = result.groupId;
        }
    });
}

// Helper function to show status messages
function showStatus(element, message, type) {
    console.log('Showing status:', message, type);
    if (!element) {
        console.error('Status element not found');
        return;
    }
    
    element.textContent = message;
    element.className = `status ${type}`;
    element.style.display = 'block'; // Ensure it's visible
    
    setTimeout(() => {
        element.textContent = '';
        element.className = 'status';
        element.style.display = 'none';
    }, 3000);
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
} 