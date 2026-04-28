export class GiftDropdown {
    constructor({ inputId, resultsId, previewId, availableGifts = [], onSelect = () => {}, onDelete = null }) {
        this.input = $(`#${inputId}`);
        this.results = $(`#${resultsId}`);
        this.preview = $(`#${previewId}`);
        this.availableGifts = availableGifts;
        this.onSelect = onSelect;
        this.onDelete = onDelete;

        this.init();
    }

    init() {
        this.input.on('focus input', () => {
            this.updateImagePreview(this.input.val());
            this.updateSuggestions(this.input.val());
        });

        $(document).on('click', (e) => {
            if (!$(e.target).closest(`#${this.input.attr('id')}, #${this.results.attr('id')}`).length) {
                this.results.hide();
            }
        });
    }

    updateGifts(gifts) {
        this.availableGifts = gifts;
    }

    reset() {
        this.input.val('');
        this.updateImagePreview('');
    }

    setValue(name) {
        this.input.val(name);
        this.updateImagePreview(name);
    }
    
    getValue() {
        return this.input.val().trim();
    }

    updateImagePreview(name) {
        const gift = this.availableGifts.find(g => g.name === name);
        if (gift && gift.image && gift.image.url_list && gift.image.url_list[0]) {
            this.preview.html(`<img src="${gift.image.url_list[0]}" style="width: 100%; height: 100%; object-fit: cover;">`);
        } else {
            this.preview.html('<span style="font-size:9px;color:var(--dim);">ICON</span>');
        }
    }

    updateSuggestions(query = '') {
        this.results.empty();
        
        const sortedGifts = [...this.availableGifts].sort((a, b) => (a.diamond_count || 0) - (b.diamond_count || 0));
        const filtered = sortedGifts.filter(gift =>
            gift.name.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length === 0) {
            this.results.hide();
            return;
        }

        filtered.forEach(gift => {
            const img = gift.image?.url_list?.[0] || '';
            const price = gift.diamond_count || 0;

            const item = $(`
                <div class="gift-search-item" data-name="${gift.name}">
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                        ${img ? `<img src="${img}">` : ''}
                        <div class="gift-search-info">
                            <span class="gift-search-name">${gift.name}</span>
                            <span class="gift-search-price">
                                ${price} <svg width="12" height="12" viewBox="0 0 640 640" fill="currentColor" style="margin-left: 2px; opacity: 0.9;"><path d="M232.5 136L320 229L407.5 136L232.5 136zM447.9 163.1L375.6 240L504.6 240L448 163.1zM497.9 288L142.1 288L320 484.3L497.9 288zM135.5 240L264.5 240L192.2 163.1L135.6 240zM569.8 280.1L337.8 536.1C333.3 541.1 326.8 544 320 544C313.2 544 306.8 541.1 302.2 536.1L70.2 280.1C62.5 271.6 61.9 258.9 68.7 249.7L180.7 97.7C185.2 91.6 192.4 87.9 200 87.9L440 87.9C447.6 87.9 454.8 91.5 459.3 97.7L571.3 249.7C578.1 258.9 577.4 271.6 569.8 280.1z"/></svg>
                            </span>
                        </div>
                    </div>
                    ${this.onDelete ? `
                    <button class="btn-icon-danger btn-delete-gift-db" title="Delete from Database" data-id="${gift.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    ` : ''}
                </div>
            `);

            if (this.onDelete) {
                item.find('.btn-delete-gift-db').click(async (e) => {
                    e.stopPropagation();
                    this.onDelete(gift);
                });
            }

            item.click(() => {
                this.input.val(gift.name);
                this.updateImagePreview(gift.name);
                this.results.hide();
                this.onSelect(gift.name);
            });

            this.results.append(item);
        });

        this.results.show();
    }
}
