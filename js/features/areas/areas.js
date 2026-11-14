/* ---------- áreas (personalizáveis por workspace; ficam em preferencias.areas) ---------- */
const AREAS_PADRAO = [
    { nome: 'Projeto', cor: '#0ea5e9' },
    { nome: 'Melhoria', cor: '#a855f7' },
    { nome: 'Tarefa', cor: '#10b981' }
];
const PALETA_AREAS = ['#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#64748b'];
/* eram áreas padrão da versão anterior; os itens que ainda as usam passam para a primeira área da lista */
const AREAS_ANTIGAS = ['Gerais', 'BI e SSAPM'];
const corAreaValida = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
const nomeAreaValido = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 30);

function areasDasPreferencias(preferencias) {
    const lista = preferencias && Array.isArray(preferencias.areas) ? preferencias.areas : null;
    if (!lista) return null;
    const vistos = new Set(), saida = [];
    lista.forEach(a => {
        const nome = nomeAreaValido(a && a.nome);
        if (!nome || vistos.has(nome.toLowerCase())) return;
        vistos.add(nome.toLowerCase());
        saida.push({ nome, cor: corAreaValida(a.cor) ? a.cor : PALETA_AREAS[saida.length % PALETA_AREAS.length] });
    });
    return saida.length ? saida : null;
}
function listarAreas() {
    return (areasDasPreferencias(lerPreferenciasBanco()) || AREAS_PADRAO).map(a => ({ nome: a.nome, cor: a.cor }));
}
const nomesAreas = () => listarAreas().map(a => a.nome);
const areaPadrao = () => listarAreas()[0].nome;
function corDaArea(nome) {
    const a = listarAreas().find(x => x.nome === nome);
    return a ? a.cor : null;
}
/* valor para o atributo style das pílulas: "--glow:#rrggbb" (vazio se a área não está na lista) */
function estiloArea(nome) {
    const cor = corDaArea(nome);
    return cor ? '--glow:' + cor : '';
}
function contarItensPorArea() {
    const contagem = {};
    lerBancoDeDados().forEach(i => { if (i && i.area) contagem[i.area] = (contagem[i.area] || 0) + 1; });
    return contagem;
}
function reiniciarHistorico() {
    estadosHistorico = [localStorage.getItem(chaveDb()) || '[]'];
    indiceHistorico = 0;
    persistirHistorico();
    notificarHistorico();
}
/* Grava a nova lista de áreas. renomeios: { nomeAntigo: nomeNovo } (inclui as áreas excluídas, que vão para a primeira). */
function salvarAreas(novas, renomeios) {
    const itens = lerBancoDeDados();
    itens.forEach(i => {
        if (i && i.area && Object.prototype.hasOwnProperty.call(renomeios, i.area)) i.area = renomeios[i.area];
    });
    localStorage.setItem(chavePreferencias(), JSON.stringify({ ...lerPreferenciasBanco(), areas: novas }));
    salvarBancoDeDados(itens);
    reiniciarHistorico();   // o desfazer não acompanha as preferências; recomeça a partir daqui para não deixar áreas inconsistentes
    window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', { detail: { dados: itens } }));
    window.dispatchEvent(new Event('Planora-areas-atualizadas'));
}
/* Primeira abertura de um workspace sem áreas definidas: grava a lista padrão e troca as áreas antigas. */
async function garantirAreasPadrao() {
    const preferencias = lerPreferenciasBanco();
    if (areasDasPreferencias(preferencias)) return true;
    const areas = AREAS_PADRAO.map(a => ({ ...a }));
    const itens = lerBancoDeDados();
    itens.forEach(i => { if (i && AREAS_ANTIGAS.includes(i.area)) i.area = areas[0].nome; });
    localStorage.setItem(chaveDb(), JSON.stringify(itens));
    localStorage.setItem(chavePreferencias(), JSON.stringify({ ...preferencias, areas }));
    if (workspaceAtual && workspaceAtual.role === 'viewer') {
        reiniciarHistorico();
        return true;
    }
    localStorage.setItem(chavePend(), '1');
    seq++;
    reiniciarHistorico();
    return enviar();
}

function abrirGerenciadorAreas() {
    if (document.querySelector('.ar-overlay')) return;
    const usos = contarItensPorArea();
    let rascunho = listarAreas().map(a => ({ orig: a.nome, nome: a.nome, cor: a.cor, removida: false }));
    let paletaAberta = null;                       // índice do rascunho com a paleta aberta (ou 'nova')
    let corNova = PALETA_AREAS[rascunho.length % PALETA_AREAS.length];
    const o = document.createElement('div');
    o.className = 'lg-overlay ar-overlay';
    o.innerHTML = `<div class="lg-card ar-modal" role="dialog" aria-modal="true" aria-labelledby="ar-tit">
        <div class="modal-header"><h2 id="ar-tit">Áreas</h2><button class="btn-fechar" type="button" id="ar-fechar" aria-label="Fechar">×</button></div>
        <p class="ar-intro">Crie, renomeie, reordene e escolha a cor das áreas deste workspace. Renomear atualiza os itens; ao excluir uma área em uso, os itens passam para a primeira área da lista.</p>
        <ul class="ar-lista" id="ar-lista"></ul>
        <div class="ar-nova">
            <button type="button" class="ar-cor" id="ar-nova-cor" aria-label="Cor da nova área"></button>
            <input class="ar-campo" id="ar-nova-nome" maxlength="30" placeholder="Nova área (ex.: Suporte)" autocomplete="off" aria-label="Nome da nova área">
            <button type="button" class="ar-btn-pri" id="ar-add">Adicionar</button>
            <div class="ar-paleta" id="ar-nova-paleta" hidden></div>
        </div>
        <p class="ar-msg" role="alert" aria-live="polite"></p>
        <div class="ar-rodape"><button type="button" class="ar-btn-sec" id="ar-cancelar">Cancelar</button><button type="button" class="ar-btn-pri" id="ar-salvar">Salvar alterações</button></div>
    </div>`;
    document.body.appendChild(o);
    const q = s => o.querySelector(s);
    const msg = t => { q('.ar-msg').textContent = t; };
    const paletaHtml = atual => PALETA_AREAS.map(c => `<button type="button" class="cor-opcao${c.toLowerCase() === String(atual).toLowerCase() ? ' sel' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('');
    function desenhar() {
        const vivas = rascunho.filter(a => !a.removida);
        q('#ar-lista').innerHTML = rascunho.map((a, i) => {
            if (a.removida) return '';
            const pos = vivas.indexOf(a), uso = a.orig ? (usos[a.orig] || 0) : 0;
            return `<li class="ar-linha" data-i="${i}" style="--cor-area:${a.cor}">
                <button class="ar-cor" type="button" data-acao="cor" aria-label="Escolher cor de ${escaparTag(a.nome)}"></button>
                <input class="ar-campo" data-acao="nome" maxlength="30" value="${escaparTag(a.nome)}" aria-label="Nome da área" autocomplete="off">
                <span class="ar-uso">${uso} ${uso === 1 ? 'item' : 'itens'}</span>
                <span class="ar-acoes">
                    <button class="ar-icone" type="button" data-acao="subir" title="Subir" aria-label="Subir"${pos === 0 ? ' disabled' : ''}>↑</button>
                    <button class="ar-icone" type="button" data-acao="descer" title="Descer" aria-label="Descer"${pos === vivas.length - 1 ? ' disabled' : ''}>↓</button>
                    <button class="ar-icone perigo" type="button" data-acao="excluir" title="Excluir" aria-label="Excluir"${vivas.length <= 1 ? ' disabled' : ''}>✕</button>
                </span>
                <div class="ar-paleta"${paletaAberta === i ? '' : ' hidden'}>${paletaHtml(a.cor)}</div>
            </li>`;
        }).join('');
        const nova = q('#ar-nova-cor'), paletaNova = q('#ar-nova-paleta');
        nova.style.setProperty('--cor-area', corNova);
        paletaNova.hidden = paletaAberta !== 'nova';
        paletaNova.innerHTML = paletaHtml(corNova);
    }
    const fechar = () => { document.removeEventListener('keydown', tecla); o.remove(); };
    const tecla = e => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', tecla);
    o.addEventListener('mousedown', e => { if (e.target === o) fechar(); });
    q('#ar-fechar').onclick = fechar;
    q('#ar-cancelar').onclick = fechar;
    const lista = q('#ar-lista');
    lista.addEventListener('input', e => {
        const li = e.target.closest('.ar-linha');
        if (li && e.target.dataset.acao === 'nome') { rascunho[Number(li.dataset.i)].nome = e.target.value; msg(''); }
    });
    lista.addEventListener('click', e => {
        const b = e.target.closest('button');
        const li = e.target.closest('.ar-linha');
        if (!b || !li) return;
        const i = Number(li.dataset.i), a = rascunho[i];
        if (b.dataset.cor) { a.cor = b.dataset.cor; paletaAberta = null; return desenhar(); }
        const vivas = rascunho.filter(x => !x.removida);
        if (b.dataset.acao === 'cor') { paletaAberta = paletaAberta === i ? null : i; desenhar(); }
        else if (b.dataset.acao === 'subir' || b.dataset.acao === 'descer') {
            const pos = vivas.indexOf(a), vizinho = vivas[pos + (b.dataset.acao === 'subir' ? -1 : 1)];
            if (!vizinho) return;
            const j = rascunho.indexOf(vizinho);
            [rascunho[i], rascunho[j]] = [rascunho[j], rascunho[i]];
            paletaAberta = null;
            desenhar();
        } else if (b.dataset.acao === 'excluir' && vivas.length > 1) { a.removida = true; paletaAberta = null; msg(''); desenhar(); }
    });
    q('#ar-nova-cor').onclick = () => { paletaAberta = paletaAberta === 'nova' ? null : 'nova'; desenhar(); };
    q('#ar-nova-paleta').addEventListener('click', e => {
        const b = e.target.closest('button[data-cor]');
        if (b) { corNova = b.dataset.cor; paletaAberta = null; desenhar(); }
    });
    const nomeDuplicado = (nome, ignorar) => rascunho.some(x => x !== ignorar && !x.removida && x.nome.trim().toLowerCase() === nome.toLowerCase());
    const adicionar = () => {
        const campo = q('#ar-nova-nome'), nome = nomeAreaValido(campo.value);
        if (!nome) return msg('Digite um nome para a nova área.');
        if (nomeDuplicado(nome, null)) return msg('Já existe uma área com esse nome.');
        rascunho.push({ orig: null, nome, cor: corNova, removida: false });
        campo.value = '';
        corNova = PALETA_AREAS[(rascunho.filter(x => !x.removida).length) % PALETA_AREAS.length];
        msg('');
        desenhar();
        campo.focus();
    };
    q('#ar-add').onclick = adicionar;
    q('#ar-nova-nome').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
    q('#ar-salvar').onclick = () => {
        const vivas = rascunho.filter(a => !a.removida);
        if (!vivas.length) return msg('Mantenha pelo menos uma área.');
        const vistos = new Set();
        for (const a of vivas) {
            const nome = nomeAreaValido(a.nome);
            if (!nome) return msg('Toda área precisa de um nome.');
            if (vistos.has(nome.toLowerCase())) return msg('Há duas áreas com o nome "' + nome + '".');
            vistos.add(nome.toLowerCase());
            a.nome = nome;
        }
        const destino = vivas[0].nome;
        const emUso = rascunho.filter(a => a.removida && a.orig && (usos[a.orig] || 0) > 0);
        if (emUso.length) {
            const total = emUso.reduce((s, a) => s + usos[a.orig], 0);
            if (!confirm(`${total} ${total === 1 ? 'item usa' : 'itens usam'} a${emUso.length > 1 ? 's áreas excluídas' : ' área excluída'} (${emUso.map(a => a.orig).join(', ')}). ${total === 1 ? 'Ele passará' : 'Eles passarão'} para "${destino}". Continuar?`)) return;
        }
        const renomeios = {};
        rascunho.forEach(a => { if (a.orig) renomeios[a.orig] = a.removida ? destino : a.nome; });
        salvarAreas(vivas.map(a => ({ nome: a.nome, cor: a.cor })), renomeios);
        fechar();
    };
    desenhar();
    q('#ar-nova-nome').focus();
}
window.Planora_Areas = {
    listar: listarAreas, nomes: nomesAreas, padrao: areaPadrao, cor: corDaArea, estilo: estiloArea,
    contar: contarItensPorArea, gerenciar: abrirGerenciadorAreas, paleta: PALETA_AREAS.slice()
};

