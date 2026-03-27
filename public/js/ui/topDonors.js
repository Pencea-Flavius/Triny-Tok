// draw the top donors table
export async function loadTopDonors() {
    const tbody = document.getElementById('topDonorsTableBody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>';

        const response = await fetch('/api/top-donors');
        const data = await response.json();

        if (data.success) {
            tbody.innerHTML = '';
            if (data.donors.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No donors yet.</td></tr>';
                return;
            }

            data.donors.forEach((donor, index) => {
                const row = document.createElement('tr');

                let rankDisplay = `#${index + 1}`;
                let rowStyle = '';

                if (index === 0) {
                    rankDisplay = '🥇 1st';
                    rowStyle = 'background: rgba(255, 215, 0, 0.1); font-weight: bold; color: #ffd700;';
                } else if (index === 1) {
                    rankDisplay = '🥈 2nd';
                    rowStyle = 'background: rgba(192, 192, 192, 0.1); font-weight: bold; color: #c0c0c0;';
                } else if (index === 2) {
                    rankDisplay = '🥉 3rd';
                    rowStyle = 'background: rgba(205, 127, 50, 0.1); font-weight: bold; color: #cd7f32;';
                }

                row.setAttribute('style', rowStyle);

                row.innerHTML = `
                    <td><strong>${rankDisplay}</strong></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="${donor.profilePictureUrl || 'https://www.tiktok.com/static/images/avatar_default.png'}" class="miniprofilepicture" style="width: 24px; height: 24px;">
                            <span>${donor.nickname || donor.uniqueId}</span>
                        </div>
                    </td>
                    <td><span class="accent">${donor.totalDiamonds.toLocaleString()}</span> <svg width="12" height="12" viewBox="0 0 640 640" fill="currentColor" style="margin-left: 2px; opacity: 0.9;"><path d="M232.5 136L320 229L407.5 136L232.5 136zM447.9 163.1L375.6 240L504.6 240L448 163.1zM497.9 288L142.1 288L320 484.3L497.9 288zM135.5 240L264.5 240L192.2 163.1L135.6 240zM569.8 280.1L337.8 536.1C333.3 541.1 326.8 544 320 544C313.2 544 306.8 541.1 302.2 536.1L70.2 280.1C62.5 271.6 61.9 258.9 68.7 249.7L180.7 97.7C185.2 91.6 192.4 87.9 200 87.9L440 87.9C447.6 87.9 454.8 91.5 459.3 97.7L571.3 249.7C578.1 258.9 577.4 271.6 569.8 280.1z"/></svg></td>
                    <td>${donor.lastGift || '-'}</td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (e) {
        console.error('Error loading top donors:', e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger);">Error loading data</td></tr>`;
    }
}

export function clearTopDonors() {
    const tbody = document.getElementById('topDonorsTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No data yet</td></tr>';
    }
}
