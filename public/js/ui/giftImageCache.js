// Harvests gift images from the browser cache and uploads them to the server.
// Runs once per session in the background — skips gifts that already have a local URL.

export async function harvestGiftImagesFromCache(availableGifts) {
    const cdnGifts = availableGifts.filter(g => {
        const url = g.image?.url_list?.[0];
        return url && !url.startsWith('/images/gifts/');
    });
    if (cdnGifts.length === 0) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    for (const gift of cdnGifts) {
        const url = gift.image.url_list[0];
        await new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = async () => {
                try {
                    canvas.width = img.naturalWidth || 100;
                    canvas.height = img.naturalHeight || 100;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob(async (blob) => {
                        if (!blob) return resolve();
                        try {
                            await fetch(`/api/gifts/${gift.id}/cache-image`, {
                                method: 'POST',
                                headers: { 'Content-Type': blob.type },
                                body: blob,
                            });
                        } catch { /* skip */ }
                        resolve();
                    }, 'image/webp', 0.92);
                } catch { resolve(); }
            };
            img.onerror = () => resolve();
            img.src = url;
        });
    }
}
