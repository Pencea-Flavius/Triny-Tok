/**
 * Update the room stats and session diamonds
 */
export function updateRoomStats(viewerCount, likeCount) {
    $('#roomStats').html(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b>`);
}

export function updateDonationStats(trackedDiamonds, initialDonorsSum, initialDonorsSynced) {
    const usd = (trackedDiamonds * 0.005).toFixed(2); // 1 diamond = $0.005

    $('#totalDiamonds').text(trackedDiamonds.toLocaleString());
    $('#totalUSD').text(`$${usd}`);

    // Initial Sync Button Logic
    if (initialDonorsSum > 0 && !initialDonorsSynced) {
        $('#syncInitialBtn').show().text(`🔄 Sync Initial Top Donors (+${initialDonorsSum.toLocaleString()})`);
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
