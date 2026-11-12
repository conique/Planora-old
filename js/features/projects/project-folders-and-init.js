/* ---------- Pastas: criar, abrir, mover (arrastando), renomear e excluir ---------- */
function pastaPorId(id) { return id ? db.find(x => x.tipo === 'pasta' && x.id === id) : null; }
function contarFilhos(id) { return db.filter(x => (x.pai || null) === id).length; }
function htmlDetalhesInline(item) {
    const area = item.area ? `<span class="item-detalhe">· ${escapeHTML(item.area)}</span>` : '';
    if (item.tipo !== 'pasta') return area;
    const quantidade = contarFilhos(item.id);
    return `${area}<span class="item-detalhe">· ${quantidade} ${quantidade === 1 ? 'item' : 'itens'}</span>`;
}
function validarPastaAtual() { if (pastaAtual && !pastaPorId(pastaAtual)) pastaAtual = null; }

function caminhoDaPasta(id) {
    const cadeia = [];
    let atual = pastaPorId(id), guarda = 0;
    while (atual && guarda++ < 50) { cadeia.unshift(atual); atual = pastaPorId(atual.pai); }
    return cadeia;
}
/* true se "filhoId" está dentro de "paiId" (em qualquer nível) */
function ehDescendente(paiId, filhoId) {
    let x = pastaPorId(filhoId), guarda = 0;
    while (x && guarda++ < 50) { if ((x.pai || null) === paiId) return true; x = pastaPorId(x.pai); }
    return false;
}

function atualizarCaminho() {
    if (!window.Planora_Topo) return;
    const cadeia = caminhoDaPasta(pastaAtual);
    Planora_Topo.definirCaminho(cadeia.map((f, i) => ({
        nome: f.nome, pasta: f.id, href: i < cadeia.length - 1 ? 'index.html?pasta=' + f.id : null
    })));
}

function irParaPasta(id, historico = true) {
    pastaAtual = id || null;
    if (historico) {
        try {
            const u = new URL(location.href);
            if (pastaAtual) u.searchParams.set('pasta', pastaAtual); else u.searchParams.delete('pasta');
            history.pushState({}, '', u);
        } catch (e) { /* sem histórico (ex.: arquivo local) */ }
    }
    window.__termoBusca = '';
    const campo = document.getElementById('topo-busca');
    if (campo) campo.value = '';
    renderizarTabela();
}
window.addEventListener('popstate', () => {
    pastaAtual = new URLSearchParams(location.search).get('pasta') || null;
    renderizarTabela();
});
document.addEventListener('click', e => {                 // links do caminho navegam sem recarregar
    const a = e.target.closest && e.target.closest('#topo a[data-pasta]');
    if (!a) return;
    e.preventDefault();
    irParaPasta(a.dataset.pasta || null);
});

function salvarPastas() {
    salvarBancoDeDados(db);
    if (typeof enviarAgora === 'function') enviarAgora();
    renderizarTabela();
}
function criarPasta() {
    db.push({
        tipo: 'pasta',
        id: 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nome: 'Nova pasta',
        rotulo: opcoesRotulos[0]?.nome || 'Em andamento',
        area: Planora_Areas.padrao(),
        prazo: '---',
        pai: pastaAtual || null
    });
    salvarPastas();
}
function excluirPasta(index) {
    const p = db[index], n = contarFilhos(p.id);
    const msg = n
        ? `Excluir a pasta "${p.nome}"?\nOs ${n} item(ns) dentro dela serão movidos para o nível acima. Nada é apagado.`
        : `Excluir a pasta vazia "${p.nome}"?`;
    if (!confirm(msg)) return;
    db.forEach(x => { if (x.pai === p.id) x.pai = p.pai || null; });
    db.splice(index, 1);
    salvarPastas();
}
function moverParaPasta(de, pastaId) {
    const item = db[de];
    if (!item) return;
    if (item.tipo === 'pasta' && (item.id === pastaId || ehDescendente(item.id, pastaId))) return;
    db.splice(de, 1);
    item.pai = pastaId || null;
    db.push(item);
    salvarPastas();
}

function criarLinhaVoltar() {
    const pai = (pastaPorId(pastaAtual) || {}).pai || null;
    const nomePai = pai ? pastaPorId(pai).nome : 'Workspace';
    const tr = document.createElement('tr');
    tr.className = 'linha-voltar';
    tr.dataset.dropPasta = pai || '';
    tr.onclick = () => irParaPasta(pai);
    tr.innerHTML = `<td colspan="5"><div class="col-nome"><span>↰</span><span>Voltar para ${escapeHTML(nomePai)}</span></div></td>`;
    return tr;
}
function criarLinhaVazia() {
    const tr = document.createElement('tr');
    tr.className = 'linha-vazia';
    tr.innerHTML = '<td colspan="5">Pasta vazia. Crie uma página aqui ou arraste itens para dentro dela.</td>';
    return tr;
}

const NOMES_COLUNAS = { nome: 'Título', rotulo: 'Rótulo', area: 'Área', prazo: 'Prazo' };

/* Transforma a ordenação que está na tela na ordem personalizada salva (vai para a nuvem). */
function adotarOrdemAtual() {
    const posicoes = db.map((_, i) => i).filter(i => (db[i].pai || null) === (pastaAtual || null));
    const ordenados = calcularOrdemVisual().map(i => db[i]);
    posicoes.forEach((pos, k) => { db[pos] = ordenados[k]; });
    ordenacaoAtual = null;
    direcaoOrdenacao = 1;
    salvarPreferenciasBanco({
        ...lerPreferenciasBanco(),
        ordenacao: null
    });
    salvarBancoDeDados(db);
    if (typeof enviarAgora === 'function') enviarAgora();
    renderizarTabela();
}

function usarOrdemPersonalizada() {
    ordenacaoAtual = null;
    direcaoOrdenacao = 1;
    salvarPreferenciasBanco({
        ...lerPreferenciasBanco(),
        ordenacao: null
    });
    renderizarTabela();
}

function atualizarBarraOrdem() {
    document.querySelectorAll('.cabecalho-clicavel').forEach(th => {
        const m = (th.getAttribute('onclick') || '').match(/'(\w+)'/);
        th.dataset.ordem = m && m[1] === ordenacaoAtual ? (direcaoOrdenacao === 1 ? 'asc' : 'desc') : '';
    });
    const barra = document.getElementById('barra-ordem');
    if (!barra) return;
    barra.innerHTML = ordenacaoAtual
        ? `<span>Visualização ordenada por <strong>${NOMES_COLUNAS[ordenacaoAtual]}</strong> ${direcaoOrdenacao === 1 ? '↑' : '↓'} · Arraste desativado</span>
           <span class="barra-acoes"><button type="button" class="btn-ordem" onclick="adotarOrdemAtual()">Salvar como minha ordem</button><button type="button" class="btn-ordem" onclick="usarOrdemPersonalizada()">Voltar à ordem personalizada</button></span>`
        : '<span>⠿ Ordem personalizada · arraste em uma área vazia para selecionar vários; Ctrl+clique alterna a seleção</span>';
}

let arrasto = null;

document.addEventListener('pointerdown', e => {
    if (e.button > 0 || !e.target.closest) return;
    const tr = e.target.closest('#corpo-tabela tr');
    if (!tr || tr.classList.contains('em-edicao') || !tr.id.startsWith('linha-projeto-')) return;
    if (e.target.closest('button, input, select, a, .col-acoes')) return;
    if (e.pointerType === 'touch' && !e.target.closest('.alca-arrastar')) return;   // no toque, só pela alça
    const index = Number(tr.id.replace('linha-projeto-', ''));
    const indices = indicesParaArrastar(index);
    if (!itensSelecionados.has(index)) limparSelecaoCards();
    arrasto = { tr, indices, id: e.pointerId, x0: e.clientX, y0: e.clientY, ativo: false, ghost: null, alvo: null, depois: false, dentro: undefined };
});

window.addEventListener('pointermove', e => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    if (!arrasto.ativo) {
        if (Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 6) return;
        arrasto.ativo = true;
        arrasto.indices.forEach(i => document.getElementById(`linha-projeto-${i}`)?.classList.add('arrastando-origem', 'selecionado'));
        arrasto.indices.forEach(i => itensSelecionados.add(i));
        document.body.classList.add('arrastando');
        if (window.getSelection) window.getSelection().removeAllRanges();
        const nome = arrasto.tr.querySelector('.titulo-linha');
        const g = document.createElement('div');
        g.className = 'ghost-arrasto';
        g.textContent = arrasto.indices.length > 1
            ? `${arrasto.indices.length} itens selecionados`
            : (nome ? nome.textContent.trim() : 'Projeto');
        document.body.appendChild(g);
        arrasto.ghost = g;
    }
    arrasto.ghost.style.left = (e.clientX + 14) + 'px';
    arrasto.ghost.style.top = (e.clientY + 10) + 'px';

    if (e.clientY < 70) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);

    document.querySelectorAll('.drop-acima, .drop-abaixo, .drop-dentro')
        .forEach(r => r.classList.remove('drop-acima', 'drop-abaixo', 'drop-dentro'));
    arrasto.alvo = null;
    arrasto.dentro = undefined;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.closest) return;
    const podeIrPara = pastaId => arrasto.indices.every(i => {
        const origem = db[i];
        return origem && !(origem.tipo === 'pasta' && (origem.id === pastaId || ehDescendente(origem.id, pastaId)));
    });

    const zona = el.closest('[data-drop-pasta]');          // linha "voltar", Workspace e pastas do caminho
    if (zona) {
        const id = zona.dataset.dropPasta || null;
        if (podeIrPara(id)) { arrasto.dentro = id; zona.classList.add('drop-dentro'); }
        return;
    }
    const alvo = el.closest('#corpo-tabela tr');
    if (!alvo || !alvo.id.startsWith('linha-projeto-') || arrasto.indices.includes(Number(alvo.id.replace('linha-projeto-', '')))) return;
    const r = alvo.getBoundingClientRect();
    const rel = (e.clientY - r.top) / r.height;
    if (alvo.classList.contains('linha-pasta') && rel > .25 && rel < .75) {   // meio da pasta = colocar dentro
        const idPasta = db[Number(alvo.id.replace('linha-projeto-', ''))].id;
        if (podeIrPara(idPasta)) { arrasto.dentro = idPasta; alvo.classList.add('drop-dentro'); }
        return;
    }
    arrasto.alvo = alvo;
    arrasto.depois = rel > .5;
    alvo.classList.add(arrasto.depois ? 'drop-abaixo' : 'drop-acima');
});

function finalizarArrasto(e, cancelar) {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const a = arrasto;
    arrasto = null;
    if (!a.ativo) return;
    if (a.ghost) a.ghost.remove();
    document.body.classList.remove('arrastando');
    a.indices.forEach(i => document.getElementById(`linha-projeto-${i}`)?.classList.remove('arrastando-origem'));
    document.querySelectorAll('.drop-acima, .drop-abaixo, .drop-dentro').forEach(r => r.classList.remove('drop-acima', 'drop-abaixo', 'drop-dentro'));
    window.__arrastou = true;                       // evita abrir o projeto ao soltar
    setTimeout(() => { window.__arrastou = false; }, 0);
    if (cancelar) return;
    if (a.dentro !== undefined) { moverSelecaoParaPasta(a.indices, a.dentro); return; }
    if (ordenacaoAtual) return;
    if (!a.alvo) return;
    const para = Number(a.alvo.id.replace('linha-projeto-', ''));
    reordenarSelecao(a.indices, para, a.depois);
}
window.addEventListener('pointerup', e => finalizarArrasto(e, false));
window.addEventListener('pointercancel', e => finalizarArrasto(e, true));
document.addEventListener('click', e => {
    if (window.__arrastou) { e.stopPropagation(); e.preventDefault(); }
}, true);
document.addEventListener('dragstart', e => { if (arrasto && arrasto.ativo) e.preventDefault(); });

function aplicarBusca() {
    const termo = window.__termoBusca || '';
    document.querySelectorAll('#corpo-tabela tr').forEach(tr => {
        tr.style.display = !termo || tr.textContent.toLowerCase().includes(termo) ? '' : 'none';
    });
}
window.aoBuscar = t => { window.__termoBusca = t; aplicarBusca(); if (visaoAtual === 'kanban') renderizarKanban(); };
window.aoNovoRegistro = abrirModal;
window.aoNovaPasta = criarPasta;
const _renderizarTabelaBase = renderizarTabela;
renderizarTabela = function () { _renderizarTabelaBase(); atualizarBarraOrdem(); atualizarCaminho(); aplicarBusca(); aplicarVisao(); };

window.addEventListener('Planora-dados-restaurados', e => {
    db = e.detail.dados;
    renderizarTabela();
});

renderizarTabela();
