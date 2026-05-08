// update stream counters
export function updateRoomStats(viewerCount, likeCount) {
    const vc = document.getElementById('viewerCount');
    const lc = document.getElementById('likeCount');
    if (vc) vc.textContent = viewerCount.toLocaleString();
    if (lc) lc.textContent = likeCount.toLocaleString();
}

export function updateDonationStats(trackedDiamonds, initialDonorsSum, initialDonorsSynced) {
    const usd = (trackedDiamonds * 0.005).toFixed(2); // 1 diamond = $0.005

    $('#totalDiamonds').text(trackedDiamonds.toLocaleString());
    $('#totalUSD').text(`$${usd}`);

    // only show sync button if there are unsynced donors
    if (initialDonorsSum > 0 && !initialDonorsSynced) {
        $('#syncInitialBtn').show().html(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg> Sync Initial Top Donors (+${initialDonorsSum.toLocaleString()})`);
    } else {
        $('#syncInitialBtn').hide();
    }
}

export async function syncInitial() {
    try {
        const response = await fetch('/api/sync-initial', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            console.log('Synced initial donors');
        } else {
            alert(data.error);
        }
    } catch (e) {
        console.error('Error syncing:', e);
    }
}

export function resetStats() {
    $('#totalDiamonds').text('0');
    $('#totalUSD').text('$0.00');
    $('#syncInitialBtn').hide();
}
