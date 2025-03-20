// Check authentication status first
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Popup loaded - checking authentication');
    
    // Check if user is authenticated
    chrome.storage.local.get(['toxAuthenticated'], function(result) {
        console.log('Authentication status:', result.toxAuthenticated);
        if (result.toxAuthenticated !== true) {
            // Not authenticated, redirect to auth page
            console.log('Not authenticated, redirecting to auth page');
            window.location.href = 'auth.html';
            return;
        } else {
            // User is authenticated, initialize popup
            console.log('User authenticated, initializing popup');
            initializePopup();
        }
    });
    
    // Listen for changes to username or group in storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            // Update username if it changes
            if (changes.username) {
                const statusElem = document.getElementById('userStatus');
                if (statusElem) {
                    statusElem.textContent = changes.username.newValue || 'Guest';
                }
            }
            
            // Update group if it changes
            if (changes.groupId) {
                const groupDisplay = document.getElementById('groupDisplay');
                if (groupDisplay) {
                    groupDisplay.textContent = changes.groupId.newValue 
                        ? `Group: ${changes.groupId.newValue}` 
                        : 'No Group';
                }
            }
        }
    });
});

async function initializePopup() {
    try {
        // Check if the background script is responsive
        const isBackgroundActive = await checkBackgroundConnection();
        if (!isBackgroundActive) {
            showExtensionError();
            return;
        }
        
        await initializeUserInfo();
        await loadWebhooks();
        await loadHistory();
        await loadNotifications(); // Load any existing notifications
        setupEventListeners();
        addTestNotificationButton();
        
        // Listen for new notifications while popup is open
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'newNotification') {
                // Add the new notification to the UI
                addNotificationToUI(message.notification);
            }
        });
    } catch (error) {
        console.error('Error initializing popup:', error);
        if (error.message && error.message.includes('Extension context invalidated')) {
            showExtensionError();
        }
    }
}

// Check if the background script is responsive
async function checkBackgroundConnection() {
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'ping' }, response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
            
            // Set a timeout in case the message is never answered
            setTimeout(() => reject(new Error('Background connection timeout')), 2000);
        });
        
        return response && response.success;
    } catch (error) {
        console.error('Background connection check failed:', error);
        return false;
    }
}

// Show extension error message and reload button
function showExtensionError() {
    const container = document.querySelector('.container') || document.body;
    
    // Clear container
    container.innerHTML = '';
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'extension-error';
    errorDiv.style.padding = '20px';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.display = 'flex';
    errorDiv.style.flexDirection = 'column';
    errorDiv.style.alignItems = 'center';
    errorDiv.style.gap = '15px';
    
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Extension Error';
    errorTitle.style.color = 'red';
    
    const errorMessage = document.createElement('p');
    errorMessage.textContent = 'The extension has been updated or reloaded. Please try reconnecting or reload to continue.';
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    
    // Reconnect button 
    const reconnectButton = document.createElement('button');
    reconnectButton.textContent = 'Try Reconnecting';
    reconnectButton.className = 'btn btn-info';
    reconnectButton.style.padding = '8px 16px';
    reconnectButton.addEventListener('click', () => {
        // Show loading state
        reconnectButton.textContent = 'Reconnecting...';
        reconnectButton.disabled = true;
        
        // Try to reconnect
        try {
            chrome.runtime.sendMessage({ action: 'reconnect' }, (response) => {
                if (chrome.runtime.lastError) {
                    // If still having issues, show the error again
                    console.error('Failed to reconnect:', chrome.runtime.lastError);
                    errorMessage.textContent = 'Reconnection failed. Please reload the extension.';
                    reconnectButton.textContent = 'Try Again';
                    reconnectButton.disabled = false;
                    return;
                }
                
                if (response && response.success) {
                    // Reconnection successful, reload the popup content
                    window.location.reload();
                } else {
                    // Reconnection failed for some other reason
                    errorMessage.textContent = 'Reconnection failed: ' + (response?.error || 'Unknown error');
                    reconnectButton.textContent = 'Try Again';
                    reconnectButton.disabled = false;
                }
            });
        } catch (error) {
            console.error('Error during reconnection attempt:', error);
            errorMessage.textContent = 'Reconnection error: ' + error.message;
            reconnectButton.textContent = 'Try Again';
            reconnectButton.disabled = false;
        }
    });
    
    // Reload button
    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Reload Extension';
    reloadButton.className = 'btn btn-primary';
    reloadButton.style.padding = '8px 16px';
    reloadButton.addEventListener('click', () => {
        chrome.runtime.reload();
        window.close(); // Close the popup
    });
    
    // Add buttons to container
    buttonContainer.appendChild(reconnectButton);
    buttonContainer.appendChild(reloadButton);
    
    // Assemble the error UI
    errorDiv.appendChild(errorTitle);
    errorDiv.appendChild(errorMessage);
    errorDiv.appendChild(buttonContainer);
    container.appendChild(errorDiv);
}

// Initialize user info
async function initializeUserInfo() {
    console.log('Initializing user info');
    try {
        const { username, userAvatar = 'U', groupId = '', keyInfo } = 
            await chrome.storage.local.get(['username', 'userAvatar', 'groupId', 'keyInfo']);
        
        const statusElem = document.getElementById('userStatus');
        const avatarElem = document.getElementById('userAvatar');
        const groupDisplay = document.getElementById('groupDisplay');
        
        if (statusElem) statusElem.textContent = username || 'Guest';
        if (avatarElem) avatarElem.textContent = userAvatar;
        if (groupDisplay) {
            groupDisplay.textContent = groupId ? `Group: ${groupId}` : 'No Group';
        }
        
        // Display wallet information if available
        if (keyInfo && keyInfo.wallet) {
            const walletDisplay = document.createElement('div');
            walletDisplay.id = 'walletDisplay';
            walletDisplay.className = 'user-info-item';
            walletDisplay.style.fontSize = '12px';
            walletDisplay.style.color = '#888';
            walletDisplay.style.marginTop = '4px';
            
            // Format wallet address (first 6 chars + ... + last 4 chars)
            const formattedWallet = keyInfo.wallet.length > 10 
                ? `${keyInfo.wallet.substring(0, 6)}...${keyInfo.wallet.substring(keyInfo.wallet.length - 4)}`
                : keyInfo.wallet;
                
            walletDisplay.textContent = `Wallet: ${formattedWallet}`;
            
            // Add tooltip with full wallet address
            walletDisplay.title = keyInfo.wallet;
            
            // Add to the header
            const headerDiv = groupDisplay.parentElement;
            if (headerDiv) {
                headerDiv.appendChild(walletDisplay);
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load webhooks
async function loadWebhooks() {
    try {
        const { webhooks = [] } = await chrome.storage.local.get(['webhooks']);
        const webhooksList = document.getElementById('webhooksList');
        
        if (!webhooksList) {
            console.error('Webhooks list element not found');
            return;
        }
        
        if (webhooks.length === 0) {
            webhooksList.innerHTML = '<div class="empty-state">No webhooks added</div>';
            return;
        }
        
        webhooksList.innerHTML = webhooks.map(webhook => `
            <div class="webhook-item">
                <div class="webhook-info">
                    <div class="webhook-name">${escapeHtml(webhook.name)}</div>
                </div>
                <button class="delete-webhook" data-url="${escapeHtml(webhook.url)}">Delete</button>
            </div>
        `).join('');

        // Add delete webhook handlers
        const deleteButtons = webhooksList.querySelectorAll('.delete-webhook');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const url = button.dataset.url;
                const { webhooks = [] } = await chrome.storage.local.get(['webhooks']);
                const newWebhooks = webhooks.filter(w => w.url !== url);
                await chrome.storage.local.set({ webhooks: newWebhooks });
                await loadWebhooks();
            });
        });
    } catch (error) {
        console.error('Error loading webhooks:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Add webhook
    const addWebhookBtn = document.getElementById('addWebhook');
    const webhookName = document.getElementById('webhookName');
    const webhookUrl = document.getElementById('webhookUrl');
    const webhookStatus = document.getElementById('webhookStatus');
    
    if (addWebhookBtn && webhookName && webhookUrl && webhookStatus) {
        addWebhookBtn.addEventListener('click', async () => {
            console.log('Add webhook button clicked');
            const name = webhookName.value.trim();
            const url = webhookUrl.value.trim();
            
            if (!name || !url) {
                showStatus(webhookStatus, 'Please enter both name and URL', 'error');
                return;
            }
            
            try {
                // Test webhook
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: '🔄 Testing webhook connection...',
                        username: 'Tox'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                // Save webhook
                const { webhooks = [] } = await chrome.storage.local.get(['webhooks']);
                if (webhooks.some(w => w.url === url)) {
                    showStatus(webhookStatus, 'This webhook is already added', 'error');
                    return;
                }
                
                webhooks.push({ name, url });
                await chrome.storage.local.set({ webhooks });
                
                // Clear inputs and reload list
                webhookName.value = '';
                webhookUrl.value = '';
                showStatus(webhookStatus, 'Webhook added successfully', 'success');
                await loadWebhooks();
            } catch (error) {
                console.error('Error adding webhook:', error);
                showStatus(webhookStatus, 'Error: ' + error.message, 'error');
            }
        });
    }
    
    // Open settings
    const openSettingsBtn = document.getElementById('openSettings');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    }
    
    // Join Group button
    const joinGroupBtn = document.getElementById('joinGroup');
    const groupIdInput = document.getElementById('groupIdInput');
    const groupStatus = document.getElementById('groupStatus');
    
    if (joinGroupBtn && groupIdInput && groupStatus) {
        joinGroupBtn.addEventListener('click', async () => {
            const groupId = groupIdInput.value.trim();
            
            if (!groupId) {
                showStatus(groupStatus, 'Please enter a group ID', 'error');
                return;
            }
            
            try {
                // Save the group ID
                await chrome.storage.local.set({ groupId });
                
                // Update display
                const groupDisplay = document.getElementById('groupDisplay');
                if (groupDisplay) {
                    groupDisplay.textContent = `Group: ${groupId}`;
                }
                
                showStatus(groupStatus, 'Joined group successfully', 'success');
                
                // Clear input
                groupIdInput.value = '';
            } catch (error) {
                console.error('Error joining group:', error);
                showStatus(groupStatus, 'Error: ' + error.message, 'error');
            }
        });
    }
    
    // Test Supabase connection button
    const testSupabaseBtn = document.getElementById('test-supabase-btn');
    if (testSupabaseBtn) {
        testSupabaseBtn.addEventListener('click', async () => {
            const resultContainer = document.getElementById('test-result-container');
            if (resultContainer) {
                resultContainer.style.display = 'block';
                resultContainer.innerHTML = '<div>Running test...</div>';
            }
            
            try {
                // Send test request
                chrome.runtime.sendMessage({ action: 'testSupabase' }, (response) => {
                    if (chrome.runtime.lastError) {
                        throw new Error(chrome.runtime.lastError.message);
                    }
                    
                    if (response && response.success) {
                        if (resultContainer) {
                            resultContainer.innerHTML = `
                                <div style="color: green">✓ Supabase connection successful</div>
                                <div>Message: ${response.message || ''}</div>
                            `;
                        }
                    } else {
                        if (resultContainer) {
                            resultContainer.innerHTML = `
                                <div style="color: red">✗ Supabase connection failed</div>
                                <div>Error: ${response.error || 'Unknown error'}</div>
                                <div>Stage: ${response.stage || 'Unknown'}</div>
                            `;
                        }
                    }
                });
            } catch (error) {
                console.error('Error testing Supabase connection:', error);
                if (resultContainer) {
                    resultContainer.innerHTML = `
                        <div style="color: red">✗ Test error</div>
                        <div>Error: ${error.message}</div>
                    `;
                }
            }
        });
    }
}

// Load history
async function loadHistory() {
    const historyList = document.getElementById('historyList');
    
    if (!historyList) {
        console.log('History list not found - skipping history loading');
        return;
    }
    
    const { history = [] } = await chrome.storage.local.get(['history']);
    
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No history available</div>';
        return;
    }
    
    historyList.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-content">${escapeHtml(item.content)}</div>
            <div class="history-timestamp">${formatTimestamp(item.timestamp)}</div>
        </div>
    `).join('');
}

// Helper function to show status messages
function showStatus(element, message, type) {
    if (!element) {
        console.error('Status element not found');
        return;
    }
    
    element.textContent = message;
    element.className = `status ${type}`;
    element.style.display = 'block';
    
    // Only auto-hide for success and error messages, not for pending status
    if (type !== 'pending') {
        setTimeout(() => {
            // Fade out effect
            element.style.opacity = '0';
            setTimeout(() => {
                element.style.display = 'none';
                element.style.opacity = '1';
            }, 300);
        }, 3000);
    }
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Add a function to test database monitoring functionality
function addTestNotificationButton() {
    // Connect to the existing buttons in the HTML
    const dbTestButton = document.getElementById('test-db-notifications');
    const directTestButton = document.getElementById('test-browser-notifications');
    const forcedTestButton = document.getElementById('force-notification-test');
    const monitoringStatus = document.getElementById('monitoring-status');
    
    if (!dbTestButton || !directTestButton || !forcedTestButton) {
        console.log('Test buttons not found in the HTML - skipping notification test setup');
        return;
    }
    
    // Add click handler for database test with error handling
    dbTestButton.addEventListener('click', () => {
        // Show loading state
        dbTestButton.textContent = 'Testing...';
        dbTestButton.disabled = true;
        
        // Send test message to background script with error handling
        chrome.runtime.sendMessage({ action: 'testRealtimeMonitoring' }, (response) => {
            // Handle extension context invalidated error
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    showExtensionError();
                    return;
                }
                
                // Reset button state
                dbTestButton.disabled = false;
                dbTestButton.textContent = 'Test DB Notifications';
                
                alert('Error: ' + chrome.runtime.lastError.message);
                return;
            }
            
            // Reset button state
            dbTestButton.disabled = false;
            dbTestButton.textContent = 'Test DB Notifications';
            
            // Show result
            if (response && response.success) {
                let message = response.message || 'Test notification sent!';
                if (response.note) {
                    message += '\n\n' + response.note;
                }
                
                // Add monitoring status info
                if (response.monitoringStatus) {
                    message += '\n\nMonitoring Active: ' + (response.monitoringStatus.active ? 'Yes' : 'No');
                    message += '\nCurrent DB Size: ' + response.monitoringStatus.currentDbSize;
                    message += '\nLast Known Count: ' + response.monitoringStatus.lastCount;
                }
                
                // Use our own alert instead of browser alert
                showInlineAlert(message, 'success');
            } else {
                let errorMsg = 'Test failed: ' + (response?.error || 'Unknown error');
                if (response?.details) {
                    errorMsg += '\n\n' + response.details;
                }
                // Use our own alert instead of browser alert
                showInlineAlert(errorMsg, 'error');
                
                // Log detailed info to console
                console.error('Notification test failed:', response);
            }
        });
    });
    
    // Add click handler for direct notification test with error handling
    directTestButton.addEventListener('click', () => {
        // Show loading state
        directTestButton.textContent = 'Testing...';
        directTestButton.disabled = true;
        
        // Send direct notification test request with error handling
        chrome.runtime.sendMessage({ action: 'testNotifications' }, (response) => {
            // Handle extension context invalidated error
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    showExtensionError();
                    return;
                }
                
                // Reset button state
                directTestButton.disabled = false;
                directTestButton.textContent = 'Test Notifications';
                
                // Use our own alert instead of browser alert
                showInlineAlert('Error: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            // Reset button state
            directTestButton.disabled = false;
            directTestButton.textContent = 'Test Notifications';
            
            // Show result
            if (response && response.success) {
                // Use our own alert instead of browser alert
                showInlineAlert('In-app notification test triggered. You should see a notification in active tabs.', 'success');
            } else {
                // Use our own alert instead of browser alert
                showInlineAlert('Notification test failed: ' + (response?.error || 'Unknown error'), 'error');
                console.error('Notification test failed:', response);
            }
        });
    });
    
    // Add click handler for forced notification test
    forcedTestButton.addEventListener('click', () => {
        // Show loading state
        forcedTestButton.textContent = 'Forcing...';
        forcedTestButton.disabled = true;
        
        // Send forced notification test request
        chrome.runtime.sendMessage({ action: 'forceTestNotification' }, (response) => {
            // Handle extension context invalidated error
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                    showExtensionError();
                    return;
                }
                
                // Reset button state
                forcedTestButton.disabled = false;
                forcedTestButton.textContent = 'Force Notification Test';
                
                // Use our own alert instead of browser alert
                showInlineAlert('Error: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            // Reset button state
            forcedTestButton.disabled = false;
            forcedTestButton.textContent = 'Force Notification Test';
            
            // Show result
            if (response && response.success) {
                // Use our own alert instead of browser alert
                showInlineAlert('Forced notification created. You should see a notification in active tabs.', 'success');
            } else {
                // Use our own alert instead of browser alert
                showInlineAlert('Forced notification failed: ' + (response?.error || 'Unknown error'), 'error');
                console.error('Forced notification test failed:', response);
            }
        });
    });
    
    // Check monitoring status
    if (monitoringStatus) {
        updateMonitoringStatus();
    }
}

// Load notifications from storage
async function loadNotifications() {
    try {
        const notificationsContainer = document.getElementById('notifications-container');
        
        if (!notificationsContainer) {
            console.log('Notifications container not found - skipping notifications loading');
            return;
        }
        
        const { inAppNotifications = [] } = await chrome.storage.local.get(['inAppNotifications']);
        const noNotificationsMsg = document.getElementById('no-notifications-msg');
        
        // Clear container except for the empty state message
        Array.from(notificationsContainer.children).forEach(child => {
            if (child.id !== 'no-notifications-msg') {
                child.remove();
            }
        });
        
        if (inAppNotifications.length === 0) {
            if (noNotificationsMsg) noNotificationsMsg.style.display = 'block';
            return;
        }
        
        if (noNotificationsMsg) noNotificationsMsg.style.display = 'none';
        
        // Add notifications to UI
        inAppNotifications.forEach(notification => {
            addNotificationToUI(notification);
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Initialize Notyf with custom options
let notyf;
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Notyf if available
    if (window.Notyf) {
        notyf = new window.Notyf({
            duration: 5000,
            position: {
                x: 'right',
                y: 'top',
            },
            dismissible: true,
            types: [
                {
                    type: 'success',
                    background: '#0A3B2C',
                    icon: false
                },
                {
                    type: 'error',
                    background: '#F87171',
                    icon: false
                },
                {
                    type: 'info',
                    background: '#0F4D3A',
                    className: 'notyf__toast--info',
                    icon: false
                }
            ]
        });
        
        // Add custom styles for our notifications
        const customStyles = document.createElement('style');
        customStyles.textContent = `
            .notyf__toast {
                border-radius: 12px;
                box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
                padding: 16px;
            }
            .notyf__toast--info {
                background-color: var(--accent);
            }
            .notyf__ripple {
                background-color: rgba(0, 0, 0, 0.07);
            }
            .notyf__toast--success .notyf__ripple {
                background-color: rgba(10, 59, 44, 0.2);
            }
            .notyf__toast--error .notyf__ripple {
                background-color: rgba(248, 113, 113, 0.2);
            }
            .notyf__toast--info .notyf__ripple {
                background-color: rgba(15, 77, 58, 0.2);
            }
        `;
        document.head.appendChild(customStyles);
    }
    
    // ... rest of your DOMContentLoaded code ...
});

// Show inline alert with Notyf
function showInlineAlert(message, type = 'info') {
    if (notyf) {
        if (type === 'success') {
            notyf.success(message);
        } else if (type === 'error') {
            notyf.error(message);
        } else {
            notyf.open({
                type: 'info',
                message: message
            });
        }
    } else {
        // Fallback alert
        alert(message);
    }
}

// Add a notification to the UI
function addNotificationToUI(notification) {
    const notificationsContainer = document.getElementById('notifications-container');
    
    if (!notificationsContainer) {
        console.log('Notifications container not found - skipping notification UI update');
        return;
    }
    
    // Hide the empty state message
    const noNotificationsMsg = document.getElementById('no-notifications-msg');
    if (noNotificationsMsg) noNotificationsMsg.style.display = 'none';
    
    // Create notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = 'notification-item';
    notificationEl.style.padding = '16px 20px';
    notificationEl.style.marginBottom = '10px';
    notificationEl.style.backgroundColor = 'var(--bg-secondary)';
    notificationEl.style.borderRadius = '20px';
    notificationEl.style.border = '1px solid var(--border)';
    
    // Create header with title and close button
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '16px';
    
    // Add TOX logo
    const logo = document.createElement('div');
    logo.style.display = 'flex';
    logo.style.alignItems = 'center';
    logo.style.gap = '12px';
    
    // Add green TOX icon SVG
    const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    iconSvg.setAttribute('width', '24');
    iconSvg.setAttribute('height', '24');
    iconSvg.setAttribute('viewBox', '0 0 24 24');
    iconSvg.setAttribute('fill', 'none');
    
    // Create background circle
    const rectBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rectBg.setAttribute('width', '24');
    rectBg.setAttribute('height', '24');
    rectBg.setAttribute('rx', '12');
    rectBg.setAttribute('fill', '#4ADE80');
    
    // Create TOX logo paths
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M14.4 9H15.6C15.8122 9 16.0157 9.08429 16.1657 9.23431C16.3157 9.38434 16.4 9.58783 16.4 9.8V16.2C16.4 16.4122 16.3157 16.6157 16.1657 16.7657C16.0157 16.9157 15.8122 17 15.6 17H8.4C8.18783 17 7.98434 16.9157 7.83431 16.7657C7.68429 16.6157 7.6 16.4122 7.6 16.2V9.8C7.6 9.58783 7.68429 9.38434 7.83431 9.23431C7.98434 9.08429 8.18783 9 8.4 9H9.6');
    path1.setAttribute('stroke', 'white');
    path1.setAttribute('stroke-width', '1.5');
    path1.setAttribute('stroke-linecap', 'round');
    path1.setAttribute('stroke-linejoin', 'round');
    
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M14 8L10 8C9.73478 8 9.48043 7.89464 9.29289 7.70711C9.10536 7.51957 9 7.26522 9 7V7C9 6.73478 9.10536 6.48043 9.29289 6.29289C9.48043 6.10536 9.73478 6 10 6H14C14.2652 6 14.5196 6.10536 14.7071 6.29289C14.8946 6.48043 15 6.73478 15 7V7C15 7.26522 14.8946 7.51957 14.7071 7.70711C14.5196 7.89464 14.2652 8 14 8Z');
    path2.setAttribute('stroke', 'white');
    path2.setAttribute('stroke-width', '1.5');
    path2.setAttribute('stroke-linecap', 'round');
    path2.setAttribute('stroke-linejoin', 'round');
    
    // Add all elements to SVG
    iconSvg.appendChild(rectBg);
    iconSvg.appendChild(path1);
    iconSvg.appendChild(path2);
    
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.color = 'var(--text-primary)';
    title.textContent = 'TOX';
    
    logo.appendChild(iconSvg);
    logo.appendChild(title);
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'var(--text-secondary)';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 5px';
    closeBtn.addEventListener('click', () => {
        notificationEl.remove();
        
        // If no notifications left, show empty state
        if (notificationsContainer.children.length === 1 && notificationsContainer.children[0].id === 'no-notifications-msg') {
            noNotificationsMsg.style.display = 'block';
        }
        
        // Remove from storage
        removeNotificationFromStorage(notification.id);
    });
    
    header.appendChild(logo);
    header.appendChild(closeBtn);
    
    // Create message body
    const messageContainer = document.createElement('div');
    messageContainer.style.color = 'var(--text-primary)';
    messageContainer.style.fontSize = '14px';
    messageContainer.style.marginBottom = '12px';
    messageContainer.style.lineHeight = '1.5';
    
    // Add message text
    const message = document.createElement('div');
    message.textContent = notification.message || '';
    message.style.marginBottom = '8px';
    messageContainer.appendChild(message);
    
    // Add content if available
    if (notification.content) {
        const contentInfo = document.createElement('div');
        contentInfo.style.color = 'var(--text-secondary)';
        contentInfo.style.fontSize = '14px';
        contentInfo.style.marginBottom = '4px';
        contentInfo.textContent = `Contract address: ${notification.content}`;
        messageContainer.appendChild(contentInfo);
    }
    
    // Add group ID if available
    if (notification.groupId) {
        const groupInfo = document.createElement('div');
        groupInfo.style.color = 'var(--text-secondary)';
        groupInfo.style.fontSize = '14px';
        groupInfo.textContent = `Group ID: ${notification.groupId}`;
        messageContainer.appendChild(groupInfo);
    }
    
    // Create footer with context and timestamp
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.color = 'var(--text-secondary)';
    footer.style.fontSize = '12px';
    footer.style.marginTop = '8px';
    
    const context = document.createElement('div');
    context.textContent = notification.context || '';
    
    const timestamp = document.createElement('div');
    timestamp.textContent = formatTimestamp(notification.timestamp);
    
    footer.appendChild(context);
    footer.appendChild(timestamp);
    
    // Add an OK button
    const actionButton = document.createElement('button');
    actionButton.textContent = 'OK';
    actionButton.style.padding = '8px 20px';
    actionButton.style.backgroundColor = 'var(--accent)';
    actionButton.style.color = 'white';
    actionButton.style.border = 'none';
    actionButton.style.borderRadius = '8px';
    actionButton.style.fontSize = '14px';
    actionButton.style.fontWeight = '500';
    actionButton.style.cursor = 'pointer';
    actionButton.style.alignSelf = 'flex-end';
    actionButton.style.marginTop = '12px';
    actionButton.style.width = 'auto';
    actionButton.addEventListener('click', () => {
        notificationEl.remove();
        
        // If no notifications left, show empty state
        if (notificationsContainer.children.length === 1 && notificationsContainer.children[0].id === 'no-notifications-msg') {
            noNotificationsMsg.style.display = 'block';
        }
        
        // Remove from storage
        removeNotificationFromStorage(notification.id);
    });
    
    // Assemble notification
    notificationEl.appendChild(header);
    notificationEl.appendChild(messageContainer);
    notificationEl.appendChild(footer);
    notificationEl.appendChild(actionButton);
    
    // Add to container (at the top)
    if (notificationsContainer.firstChild && notificationsContainer.firstChild.id !== 'no-notifications-msg') {
        notificationsContainer.insertBefore(notificationEl, notificationsContainer.firstChild);
    } else {
        notificationsContainer.appendChild(notificationEl);
    }
}

// Remove a notification from storage
function removeNotificationFromStorage(notificationId) {
    chrome.storage.local.get(['inAppNotifications'], (result) => {
        const notifications = result.inAppNotifications || [];
        const updatedNotifications = notifications.filter(n => n.id !== notificationId);
        
        chrome.storage.local.set({ 
            inAppNotifications: updatedNotifications,
            [`notification_${notificationId}`]: null // Remove individual notification
        });
    });
}

// Create a function to force database monitoring restart
function forceRestartMonitoring() {
    chrome.runtime.sendMessage({ action: 'forceRestartMonitoring' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error forcing monitoring restart:', chrome.runtime.lastError);
            return;
        }
        
        if (response && response.success) {
            alert('Monitoring restart initiated. Please check again in a few seconds.');
            // Wait 3 seconds and check status again
            setTimeout(() => {
                updateMonitoringStatus();
            }, 3000);
        } else {
            alert('Failed to restart monitoring: ' + (response?.error || 'Unknown error'));
        }
    });
}

// Function to update monitoring status
function updateMonitoringStatus() {
    const monitoringStatus = document.getElementById('monitoring-status');
    if (!monitoringStatus) return;
    
    chrome.runtime.sendMessage({ action: 'getMonitoringStatus' }, (response) => {
        if (chrome.runtime.lastError) {
            monitoringStatus.textContent = 'Error: Unable to check monitoring status';
            monitoringStatus.style.color = 'red';
            
            // Add a restart button
            const restartBtn = document.createElement('button');
            restartBtn.textContent = 'Force Restart';
            restartBtn.style.marginTop = '8px';
            restartBtn.style.padding = '5px 10px';
            restartBtn.style.fontSize = '12px';
            restartBtn.style.backgroundColor = '#ef4444';
            restartBtn.style.color = 'white';
            restartBtn.style.border = 'none';
            restartBtn.style.borderRadius = '4px';
            restartBtn.style.cursor = 'pointer';
            
            restartBtn.addEventListener('click', forceRestartMonitoring);
            
            // Clear existing buttons first
            Array.from(monitoringStatus.parentNode.querySelectorAll('button')).forEach(btn => btn.remove());
            
            // Add the button after the status text
            monitoringStatus.parentNode.appendChild(restartBtn);
            
            return;
        }
        
        if (response && response.active) {
            monitoringStatus.textContent = `Active - Checking every ${response.interval/1000} seconds - Last count: ${response.lastCount}`;
            monitoringStatus.style.color = 'green';
        } else {
            monitoringStatus.textContent = 'Inactive - Notifications may not work correctly';
            monitoringStatus.style.color = 'red';
            
            // Add debug info
            const debugInfo = document.createElement('div');
            debugInfo.style.marginTop = '5px';
            debugInfo.style.fontSize = '12px';
            debugInfo.style.color = '#666';
            debugInfo.innerHTML = `Supabase initialized: ${response.initialized ? 'Yes' : 'No'}<br>`;
            
            // Add a restart button
            const restartBtn = document.createElement('button');
            restartBtn.textContent = 'Force Restart';
            restartBtn.style.marginTop = '8px';
            restartBtn.style.padding = '5px 10px';
            restartBtn.style.fontSize = '12px';
            restartBtn.style.backgroundColor = '#ef4444';
            restartBtn.style.color = 'white';
            restartBtn.style.border = 'none';
            restartBtn.style.borderRadius = '4px';
            restartBtn.style.cursor = 'pointer';
            
            restartBtn.addEventListener('click', forceRestartMonitoring);
            
            // Clear existing buttons first
            Array.from(monitoringStatus.parentNode.querySelectorAll('button')).forEach(btn => btn.remove());
            Array.from(monitoringStatus.parentNode.querySelectorAll('div:not(#monitoring-status)')).forEach(div => div.remove());
            
            // Add debug info and button
            monitoringStatus.parentNode.appendChild(debugInfo);
            monitoringStatus.parentNode.appendChild(restartBtn);
        }
    });
} 