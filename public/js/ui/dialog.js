// custom alerts and toasts 

// popups that fade away
let toastContainer = null;

function getToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed; bottom: 24px; right: 24px;
            display: flex; flex-direction: column; gap: 10px;
            z-index: 9999; pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

export function showToast(message, type = 'info', duration = 3500) {
    const container = getToastContainer();
    const icons = {
        info:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        error:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    };
    const colors = {
        info: 'var(--accent)', success: 'var(--success)', error: 'var(--danger)', warning: 'var(--warning)',
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
        pointer-events: all;
        background: var(--bg2);
        border: 1px solid var(--border);
        border-left: 3px solid ${colors[type] || colors.info};
        border-radius: var(--r-lg);
        padding: 12px 16px;
        display: flex; align-items: center; gap: 10px;
        font-size: 13px; font-weight: 500; color: var(--text);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: inherit;
        min-width: 240px; max-width: 360px;
        opacity: 0;
        transform: translateX(20px);
        transition: opacity 0.25s, transform 0.25s;
    `;
    toast.innerHTML = `
        <span style="color:${colors[type] || colors.info}; flex-shrink:0;">${icons[type] || icons.info}</span>
        <span style="flex:1; line-height:1.4;">${message}</span>
    `;

    container.appendChild(toast);

    // fade in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    // auto close
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// popup that asks yes/no
export function showConfirm({ title = 'Confirm', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 9998;
            opacity: 0; transition: opacity 0.2s;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: var(--bg2);
            border: 1px solid var(--border);
            border-radius: var(--r-xl);
            padding: 28px 28px 24px;
            max-width: 380px; width: 90%;
            box-shadow: 0 24px 64px rgba(0,0,0,0.5);
            font-family: inherit;
            transform: scale(0.94) translateY(8px);
            transition: transform 0.2s, opacity 0.2s;
            opacity: 0;
        `;

        const accentColor = danger ? 'var(--danger)' : 'var(--accent)';
        const icon = danger
            ? `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

        box.innerHTML = `
            <div style="margin-bottom:16px;">${icon}</div>
            <div style="font-size:16px; font-weight:800; margin-bottom:8px; color:var(--text);">${title}</div>
            <div style="font-size:13px; color:var(--muted); line-height:1.6; margin-bottom:24px;">${message}</div>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button id="dlg-cancel" style="
                    padding:8px 18px; border-radius:var(--r-md); border:1px solid var(--border);
                    background:var(--bg3); color:var(--muted); cursor:pointer;
                    font-family:inherit; font-size:13px; font-weight:600; transition:all 0.15s;
                ">${cancelText}</button>
                <button id="dlg-confirm" style="
                    padding:8px 18px; border-radius:var(--r-md); border:1px solid ${accentColor};
                    background:${danger ? 'var(--danger)' : 'var(--accent)'}; 
                    color:${danger ? '#fff' : '#07090f'}; cursor:pointer;
                    font-family:inherit; font-size:13px; font-weight:700; transition:all 0.15s;
                ">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            box.style.opacity = '1';
            box.style.transform = 'scale(1) translateY(0)';
        });

        const close = (result) => {
            overlay.style.opacity = '0';
            box.style.opacity = '0';
            box.style.transform = 'scale(0.94) translateY(8px)';
            setTimeout(() => overlay.remove(), 220);
            resolve(result);
        };

        box.querySelector('#dlg-confirm').addEventListener('click', () => close(true));
        box.querySelector('#dlg-cancel').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
}

// simple popup error
export function showAlert(message, type = 'info') {
    if (type === 'error') {
        showToast(message, 'error', 5000);
    } else {
        showToast(message, type, 3500);
    }
}
