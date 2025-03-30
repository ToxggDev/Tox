(function() {
    function createFloatingButton() {
        // Remove any existing buttons
        const existingButton = document.querySelector('#tox-floating-button');
        if (existingButton) {
            existingButton.remove();
        }

        // Create button element
        const button = document.createElement('button');
        button.id = 'tox-floating-button';
        
        // Apply styles directly to ensure visibility
        const styles = {
            position: 'fixed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bottom: '20px',
            right: '20px',
            width: '56px',
            height: '56px',
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            border: '2px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            zIndex: '2147483647',
            visibility: 'visible',
            opacity: '1'
        };

        // Apply all styles with !important
        Object.entries(styles).forEach(([key, value]) => {
            button.style.setProperty(key, value, 'important');
        });

        // Add button content
        button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color: #6366f1"><path d="M16 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 2H9C8.44772 2 8 2.44772 8 3V5C8 5.55228 8.44772 6 9 6H15C15.5523 6 16 5.55228 16 5V3C16 2.44772 15.5523 2 15 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

        // Add to page
        if (document.body) {
            document.body.appendChild(button);
            console.log('Button added to page');
        }

        return button;
    }

    // Try to create button in multiple ways
    function ensureButtonExists() {
        if (!document.getElementById('tox-floating-button')) {
            createFloatingButton();
        }
    }

    // Create immediately if possible
    ensureButtonExists();

    // Create on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureButtonExists);
    }

    // Create on load
    window.addEventListener('load', ensureButtonExists);

    // Watch for body changes
    const observer = new MutationObserver(() => {
        if (document.body && !document.getElementById('tox-floating-button')) {
            ensureButtonExists();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Force visibility periodically
    setInterval(ensureButtonExists, 1000);
})(); 