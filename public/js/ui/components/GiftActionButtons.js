const DEFAULT_GIFT_IMG = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85c33e017f3648eaf88d7189~tplv-obj.png';

const SVG_TEST   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const SVG_EDIT   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const SVG_DELETE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>`;

/**
 * Returns a jQuery <td> with Test/Edit/Delete buttons.
 * @param {string} giftName
 * @param {{ onTest, onEdit, onDelete }} callbacks
 */
export function makeActionCell(giftName, { onTest, onEdit, onDelete } = {}) {
    const testBtn   = $(`<button class="btn-primary btn-sm" title="Test">${SVG_TEST} Test</button>`);
    const editBtn   = $(`<button class="btn-secondary btn-sm" title="Edit">${SVG_EDIT} Edit</button>`);
    const deleteBtn = $(`<button class="btn-danger btn-sm" title="Delete">${SVG_DELETE} Delete</button>`);

    if (onTest)   testBtn.on('click',   () => onTest(giftName));
    if (onEdit)   editBtn.on('click',   () => onEdit(giftName));
    if (onDelete) deleteBtn.on('click', () => onDelete(giftName));

    const wrapper = $('<div style="display:flex;gap:6px;justify-content:center;white-space:nowrap;"></div>');
    wrapper.append(testBtn, editBtn, deleteBtn);

    const td = $('<td class="actions-cell"></td>');
    td.append(wrapper);
    return td;
}

/**
 * Returns a jQuery <td> with gift image + name (truncated).
 * @param {string} giftName
 * @param {object|undefined} gift  — from availableGifts array
 */
export function makeGiftCell(giftName, gift) {
    const imgSrc = gift?.image?.url_list?.[0] || DEFAULT_GIFT_IMG;
    const td = $('<td style="overflow:hidden;"></td>');
    const inner = $('<div style="display:flex;align-items:center;gap:10px;min-width:0;"></div>');
    inner.append(
        $(`<img src="${imgSrc}" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);flex-shrink:0;">`),
        $('<b style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></b>').text(giftName)
    );
    td.append(inner);
    return td;
}
