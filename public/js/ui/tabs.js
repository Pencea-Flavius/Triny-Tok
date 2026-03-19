/**
 * Handles tab switching in the UI
 */
export function setupTabs() {
    const tabs = document.querySelectorAll('.nav-item');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('Tab', '');

            // If it's a link-like button (OBS), don't switch
            if (tab.id === 'obsBtn') return;

            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update content visibility
            contents.forEach(content => {
                if (content.id === `${tabId}Content`) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
}
