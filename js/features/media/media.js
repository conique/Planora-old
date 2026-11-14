/* ---------- mídias: cache em IndexedDB + arquivo no Supabase Storage ---------- */
let _idb = null;
function abrirBancoMidia() {
    return _idb || (_idb = new Promise((ok, err) => {
        const r = indexedDB.open('Planora_midia_db', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => err(r.error);
    }));
}
async function idbOp(modo, fn) {
    const b = await abrirBancoMidia();
    return new Promise((ok, err) => {
        const t = b.transaction(['arquivos'], modo);
        const rq = fn(t.objectStore('arquivos'));
        t.oncomplete = () => ok(rq && rq.result);
        t.onerror = () => err(t.error);
    });
}
async function enviarMidia(id, blob, tipo) {
    if (!sb || !usuario) return;
    if (workspaceAtual && workspaceAtual.role === 'viewer') {
        throw new Error('Este workspace está em modo de visualização.');
    }
    const pasta = workspaceAtual ? workspaceAtual.id : usuario.id;
    const { error } = await sb.storage.from(BUCKET).upload(pasta + '/' + id, blob, { contentType: tipo, upsert: true });
    if (error) throw error;
}
const PENDENTES = 'Planora_midias_pendentes';
const lerPendentes = () => {
    const pendentes = JSON.parse(localStorage.getItem(PENDENTES) || '[]');
    if (!Array.isArray(pendentes)) throw new TypeError('A fila de mídias pendentes está inválida.');
    return pendentes.map(item => typeof item === 'string' ? { id: item, workspace_id: null } : item)
        .filter(item => item && typeof item.id === 'string');
};
async function salvarMidiaBlob(blob, tipo) {
    if (!blob) return null;
    if (workspaceAtual && workspaceAtual.role === 'viewer') {
        throw new Error('Este workspace está em modo de visualização.');
    }
    const id = 'midia_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
    tipo = tipo || blob.type || 'application/octet-stream';
    await idbOp('readwrite', s => s.put({ blob, tipo }, id));
    try {
        await enviarMidia(id, blob, tipo);
    } catch (e) {
        console.error('Falha ao enviar mídia:', e);
        const pendentes = lerPendentes().filter(item =>
            item.id !== id || item.workspace_id !== (workspaceAtual ? workspaceAtual.id : null));
        pendentes.push({ id, workspace_id: workspaceAtual ? workspaceAtual.id : null });
        localStorage.setItem(PENDENTES, JSON.stringify(pendentes));
        alert('A mídia foi salva neste navegador, mas NÃO foi enviada para a nuvem:\n' + (e.message || e) +
            '\n\nEla será reenviada automaticamente na próxima vez que abrir o sistema. ' +
            'Se persistir, rode o trecho de Storage do setup.sql no Supabase.');
    }
    return id;
}
async function reenviarPendentes() {
    if (workspaceAtual && workspaceAtual.role === 'viewer') return;
    const restantes = [];
    for (const item of lerPendentes()) {
        if (item.workspace_id && (!workspaceAtual || item.workspace_id !== workspaceAtual.id)) {
            restantes.push(item);
            continue;
        }
        const r = await idbOp('readonly', s => s.get(item.id));
        if (!r) continue;
        try {
            if (item.workspace_id) await enviarMidia(item.id, r.blob, r.tipo);
            else {
                const { error } = await sb.storage.from(BUCKET).upload(usuario.id + '/' + item.id, r.blob, {
                    contentType: r.tipo,
                    upsert: true
                });
                if (error) throw error;
            }
        } catch (e) { restantes.push(item); }
    }
    localStorage.setItem(PENDENTES, JSON.stringify(restantes));
}
async function obterMidiaBlob(id) {
    if (!id) return null;
    let r = await idbOp('readonly', s => s.get(id));
    if (r) return r;
    if (!sb || !usuario) return null;
    const pastaWorkspace = workspaceAtual && workspaceAtual.id;
    let { data, error } = pastaWorkspace
        ? await sb.storage.from(BUCKET).download(pastaWorkspace + '/' + id)
        : { data: null, error: null };
    if ((!data || error) && usuario) {
        const legado = await sb.storage.from(BUCKET).download(usuario.id + '/' + id);
        data = legado.data;
        error = legado.error;
        if (data && pastaWorkspace && workspaceAtual.role !== 'viewer') {
            try { await enviarMidia(id, data, data.type); }
            catch (falha) { console.error('Não foi possível migrar a mídia antiga para o workspace:', falha); }
        }
    }
    if (error || !data) return null;
    r = { blob: data, tipo: data.type };
    await idbOp('readwrite', s => s.put(r, id));
    return r;
}
async function deletarMidiaBlob(id) {
    if (!id) return;
    if (workspaceAtual && workspaceAtual.role === 'viewer') {
        throw new Error('Este workspace está em modo de visualização.');
    }
    await idbOp('readwrite', s => s.delete(id));
    if (sb && usuario && workspaceAtual && workspaceAtual.role !== 'viewer') {
        const { error } = await sb.storage.from(BUCKET).remove([workspaceAtual.id + '/' + id]);
        if (error) throw error;
    }
}
async function sincronizarMidiasLocais() {
    if (workspaceAtual && workspaceAtual.role === 'viewer') return;
    for (const p of lerBancoDeDados())
        for (const c of (p.cards || []))
            if (c.midiaId) {
                const r = await idbOp('readonly', s => s.get(c.midiaId));
                if (r) try { await enviarMidia(c.midiaId, r.blob, r.tipo); } catch (e) { console.error(e); }
            }
}
async function migrarMidiasLegadasWorkspace() {
    if (!sb || !usuario || !workspaceAtual || workspaceAtual.role === 'viewer') return;
    const ids = new Set();
    lerBancoDeDados().forEach(item => (Array.isArray(item.cards) ? item.cards : [])
        .forEach(card => { if (card && card.midiaId) ids.add(card.midiaId); }));
    const { data: arquivos, error: erroLista } = await sb.storage.from(BUCKET).list(workspaceAtual.id);
    if (erroLista) {
        console.error('Não foi possível verificar as mídias do workspace:', erroLista);
        return;
    }
    const existentes = new Set((arquivos || []).map(arquivo => arquivo.name));
    for (const id of ids) {
        if (existentes.has(id)) continue;

        const local = await idbOp('readonly', store => store.get(id));
        if (local) {
            try {
                await enviarMidia(id, local.blob, local.tipo);
                existentes.add(id);
            }
            catch (erro) { console.error('Não foi possível sincronizar uma mídia local do workspace:', erro); }
            continue;
        }

        const legado = await sb.storage.from(BUCKET).download(usuario.id + '/' + id);
        if (legado.error || !legado.data) continue;
        try {
            await enviarMidia(id, legado.data, legado.data.type);
            existentes.add(id);
        }
        catch (erro) { console.error('Não foi possível copiar uma mídia antiga para o workspace:', erro); }
    }
}
