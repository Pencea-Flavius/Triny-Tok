/**
 * Renders the top donors table
 */
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
                    <td><span class="accent">${donor.totalDiamonds.toLocaleString()}</span> 💎</td>
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
