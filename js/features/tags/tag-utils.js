/* ---------- Tags (bolhas coloridas) — usadas na tabela e no cabeçalho do projeto ---------- */
function escaparTag(t) {
    return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function corTextoTag(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return '#ffffff';
    const lum = 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
    return lum > 160 ? '#0f172a' : '#ffffff';       // texto escuro em cores claras
}
function htmlTagBolha(tag) {
    const cor = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(tag.cor) ? tag.cor : '#4b5563';
    return `<span class="tag-bolha" style="background:${cor};color:${corTextoTag(cor)}">${escaparTag(tag.nome)}</span>`;
}