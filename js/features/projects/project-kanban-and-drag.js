/* ---------- Ordem personalizada: segurar e arrastar as linhas ---------- */
/* ---------- Visão Kanban: colunas por rótulo, arraste entre colunas muda o rótulo ---------- */
const itensSelecionados = new Set();
let selecaoRetangular = null;

function atualizarSelecaoCards() {
    document.querySelectorAll('.kb-card[data-idx], #corpo-tabela tr[id^="linha-projeto-"]').forEach(el => {
        const index = Number(el.dataset.idx || el.id.replace('linha-projeto-', ''));
        el.classList.toggle('selecionado', itensSelecionados.has(index));
    });
}

function limparSelecaoCards() {
    itensSelecionados.clear();
    atualizarSelecaoCards();
}

function indicesParaArrastar(index) {
    return itensSelecionados.has(index) ? [...itensSelecionados].sort((a, b) => a - b) : [index];
}

function iniciarSelecaoRetangular(e) {
    if (e.button !== 0 || !e.target.closest) return;
    if (!document.body.contains(e.target) || e.target.closest(
        '.topo, .cabecalho-pagina, .footer-Planora, .modal-overlay, .lg-overlay, .pop-tags, .painel-lateral, .fundo-painel-lateral, ' +
        '.kb-card, .kb-col-topo, #corpo-tabela tr, thead, button, input, select, textarea, a'
    )) return;
    if (!e.ctrlKey && !e.metaKey) limparSelecaoCards();
    selecaoRetangular = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        ativo: false,
        manter: new Set(itensSelecionados),
        alternar: e.ctrlKey || e.metaKey,
        caixa: null
    };
}

document.addEventListener('pointerdown', iniciarSelecaoRetangular);
window.addEventListener('pointermove', e => {
    const s = selecaoRetangular;
    if (!s || e.pointerId !== s.id) return;
    if (!s.ativo) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5) return;
        s.ativo = true;
        if (window.getSelection) window.getSelection().removeAllRanges();
        s.caixa = document.createElement('div');
        s.caixa.className = 'caixa-selecao';
        document.body.appendChild(s.caixa);
        document.body.classList.add('selecionando-cards');
    }
    const esquerda = Math.min(s.x, e.clientX), topo = Math.min(s.y, e.clientY);
    const largura = Math.abs(e.clientX - s.x), altura = Math.abs(e.clientY - s.y);
    Object.assign(s.caixa.style, { left: `${esquerda}px`, top: `${topo}px`, width: `${largura}px`, height: `${altura}px` });
    const atingidos = new Set();
    const seletor = visaoAtual === 'kanban' ? '#kanban .kb-card[data-idx]' : '#corpo-tabela tr[id^="linha-projeto-"]';
    document.querySelectorAll(seletor).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > esquerda && r.left < esquerda + largura && r.bottom > topo && r.top < topo + altura) {
            atingidos.add(Number(el.dataset.idx || el.id.replace('linha-projeto-', '')));
        }
    });
    itensSelecionados.clear();
    s.manter.forEach(i => itensSelecionados.add(i));
    atingidos.forEach(i => {
        if (s.alternar && s.manter.has(i)) itensSelecionados.delete(i);
        else itensSelecionados.add(i);
    });
    atualizarSelecaoCards();
});
window.addEventListener('pointerup', e => {
    const s = selecaoRetangular;
    if (!s || e.pointerId !== s.id) return;
    selecaoRetangular = null;
    if (s.caixa) s.caixa.remove();
    document.body.classList.remove('selecionando-cards');
    if (s.ativo) {
        window.__arrastou = true;
        setTimeout(() => { window.__arrastou = false; }, 0);
    }
});
window.addEventListener('pointercancel', e => {
    if (!selecaoRetangular || e.pointerId !== selecaoRetangular.id) return;
    if (selecaoRetangular.caixa) selecaoRetangular.caixa.remove();
    selecaoRetangular = null;
    document.body.classList.remove('selecionando-cards');
});
document.addEventListener('click', e => {
    if (window.__arrastou || (!e.ctrlKey && !e.metaKey)) return;
    const item = e.target.closest && e.target.closest('.kb-card[data-idx], #corpo-tabela tr[id^="linha-projeto-"]');
    if (!item || e.target.closest('button, a, input, select')) return;
    const index = Number(item.dataset.idx || item.id.replace('linha-projeto-', ''));
    if (itensSelecionados.has(index)) itensSelecionados.delete(index);
    else itensSelecionados.add(index);
    atualizarSelecaoCards();
    e.preventDefault();
    e.stopPropagation();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') limparSelecaoCards(); });

function moverSelecaoParaPasta(indices, pastaId) {
    const itens = indices.map(i => db[i]).filter(Boolean);
    if (!itens.length || itens.some(item => item.tipo === 'pasta' && (item.id === pastaId || ehDescendente(item.id, pastaId)))) return false;
    const conjunto = new Set(itens);
    itens.forEach(item => { item.pai = pastaId || null; });
    db.splice(0, db.length, ...db.filter(item => !conjunto.has(item)), ...itens);
    limparSelecaoCards();
    salvarPastas();
    return true;
}

function reordenarSelecao(indices, alvoIndex, depois) {
    const itens = indices.map(i => db[i]).filter(Boolean);
    const alvo = db[alvoIndex];
    if (!itens.length || !alvo || itens.includes(alvo)) return false;
    const conjunto = new Set(itens);
    const restante = db.filter(item => !conjunto.has(item));
    const posicaoAlvo = restante.indexOf(alvo);
    if (posicaoAlvo < 0) return false;
    restante.splice(posicaoAlvo + (depois ? 1 : 0), 0, ...itens);
    db.splice(0, db.length, ...restante);
    limparSelecaoCards();
    salvarPastas();
    return true;
}

function mudarVisao(v) {
    visaoAtual = v;
    salvarPreferenciasBanco({ ...lerPreferenciasBanco(), visao: v });
    renderizarTabela();
}

function aplicarVisao() {
    const kb = document.getElementById('kanban');
    const caixa = document.getElementById('conteudo-tabela');
    const slot = document.getElementById('topo-visao');
    if (!kb || !caixa) return;
    const vazio = !db.length;
    const kanban = visaoAtual === 'kanban';
    if (slot) {
        slot.hidden = vazio;
        slot.innerHTML = `<span class="visao-toggle" role="group" aria-label="Visualização">
            <button type="button" class="${visaoAtual === 'tabela' ? 'on' : ''}" onclick="mudarVisao('tabela')">Tabela</button>
            <button type="button" class="${kanban ? 'on' : ''}" onclick="mudarVisao('kanban')" title="Arraste em uma área vazia para selecionar vários cards; Ctrl+clique alterna a seleção. Arraste a seleção para outra coluna ou pasta.">Kanban</button></span>`;
    }
    kb.hidden = vazio || !kanban;
    if (kanban && !vazio) {
        caixa.style.display = 'none';
        renderizarKanban();
    }
}

function htmlCardKanban(i) {
    const p = db[i], pasta = p.tipo === 'pasta';
    const cor = obterCorRotulo(p.rotulo || opcoesRotulos[0].nome);
    const prazoBruto = p.prazo && p.prazo !== '---' ? p.prazo : '';
    const prazo = /^\d{4}-\d{2}-\d{2}$/.test(prazoBruto) ? prazoBruto.split('-').reverse().join('/') : prazoBruto;
    return `<article class="kb-card${pasta ? ' kb-pasta' : ''}" id="kb-card-${i}" data-idx="${i}" style="--cor-card:${cor}">
        <div class="kb-card-topo">
            <span class="kb-titulo">${pasta ? '📁 ' : ''}${escapeHTML(p.nome)}${htmlDetalhesInline(p)}</span>
            <button type="button" class="btn-card-opcoes" onclick="alternarMenuKanban(event, ${i})" title="Opções" aria-label="Opções de ${escapeHTML(p.nome)}">⋮</button>
        </div>
        <div class="menu-card-flutuante" id="menu-kanban-${i}">
            <button type="button" onclick="editarNoKanban(${i})">Editar</button>
            <button type="button" onclick="${pasta ? 'excluirPasta' : 'deletarProjeto'}(${i})" style="color:#ff4d4d">Deletar</button>
        </div>
        ${prazo ? `<div class="kb-meta"><span class="kb-prazo">📅 ${escapeHTML(prazo)}</span></div>` : ''}
        <div class="kb-tags">${(p.tags || []).map(htmlTagBolha).join('')}<button type="button" class="btn-tag-mais" onclick="abrirPopTags(event, ${i})" title="Adicionar tag" aria-label="Adicionar tag">+</button></div>
    </article>`;
}

let inicioRotulosKanban = 0;
const ROTULOS_POR_TELA = 5;

function abrirGerenciadorRotulos() {
    if (document.querySelector('.rotulos-overlay')) return;
    const PALETA_ROTULOS = ['#0ea5e9','#10b981','#dc2626','#64748b','#a855f7','#f59e0b','#06b6d4','#ec4899','#84cc16','#f97316'];
    let rascunho = opcoesRotulos.map(r => ({ orig: r.nome, nome: r.nome, cor: obterCorRotulo(r.nome), removida: false }));
    let paletaAberta = null;
    let corNova = PALETA_ROTULOS[rascunho.length % PALETA_ROTULOS.length];
    const overlay = document.createElement('div');
    overlay.className = 'lg-overlay ar-overlay rotulos-overlay';
    overlay.innerHTML = `<div class="lg-card ar-modal" role="dialog" aria-modal="true" aria-labelledby="rot-tit">
        <div class="modal-header"><h2 id="rot-tit">Rótulos</h2><button class="btn-fechar" type="button" id="rot-fechar" aria-label="Fechar">×</button></div>
        <p class="ar-intro">Crie, renomeie, reordene e escolha a cor dos rótulos deste workspace. Renomear atualiza os itens; ao excluir um rótulo em uso, os itens passam para o primeiro rótulo da lista.</p>
        <ul class="ar-lista" id="rot-lista"></ul>
        <div class="ar-nova">
            <button type="button" class="ar-cor" id="rot-nova-cor" aria-label="Cor do novo rótulo"></button>
            <input class="ar-campo" id="rot-novo-nome" maxlength="40" placeholder="Novo rótulo (ex.: Em revisão)" autocomplete="off" aria-label="Nome do novo rótulo">
            <button type="button" class="ar-btn-pri" id="rot-add">Adicionar</button>
            <div class="ar-paleta" id="rot-nova-paleta" hidden></div>
        </div>
        <p class="ar-msg" id="rot-msg" role="alert" aria-live="polite"></p>
        <div class="ar-rodape"><button type="button" class="ar-btn-sec" id="rot-cancelar">Cancelar</button><button type="button" class="ar-btn-pri" id="rot-salvar">Salvar alterações</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const q = sel => overlay.querySelector(sel);
    const fechar = () => overlay.remove();
    const normalizar = nome => nome.trim().replace(/\s+/g, ' ');
    const paletaHtml = cor => PALETA_ROTULOS.map(c => `<button type="button" class="cor-opcao${c.toLowerCase() === cor.toLowerCase() ? ' sel' : ''}" style="--cor-area:${c};background:${c}" data-cor="${c}" aria-label="Escolher cor ${c}" title="${c}"></button>`).join('');
    function desenhar() {
        const ativos = rascunho.filter(r => !r.removida);
        q('#rot-lista').innerHTML = ativos.map(r => {
            const i = rascunho.indexOf(r);
            return `<li class="ar-linha" data-i="${i}" style="--cor-area:${r.cor}">
                <button class="ar-cor" type="button" data-acao="cor" aria-label="Escolher cor de ${escapeHTML(r.nome)}"></button>
                <input class="ar-campo" data-acao="nome" maxlength="40" value="${escapeHTML(r.nome)}" aria-label="Nome do rótulo">
                <span class="ar-uso">${db.filter(x => (x.rotulo || opcoesRotulos[0]?.nome) === r.orig).length} itens</span>
                <span class="ar-acoes"><button class="ar-icone" type="button" data-acao="cima" aria-label="Mover para cima">↑</button><button class="ar-icone" type="button" data-acao="baixo" aria-label="Mover para baixo">↓</button><button class="ar-icone perigo" type="button" data-acao="remover" aria-label="Excluir">×</button></span>
                <div class="ar-paleta" ${paletaAberta === i ? '' : 'hidden'}>${paletaHtml(r.cor)}</div>
            </li>`;
        }).join('');
        q('#rot-nova-cor').style.setProperty('--cor-area', corNova);
        q('#rot-nova-paleta').hidden = paletaAberta !== 'nova';
        q('#rot-nova-paleta').innerHTML = paletaHtml(corNova);
    }
    q('#rot-lista').addEventListener('input', e => {
        const li = e.target.closest('.ar-linha');
        if (li && e.target.dataset.acao === 'nome') rascunho[Number(li.dataset.i)].nome = e.target.value;
    });
    q('#rot-lista').addEventListener('click', e => {
        const li = e.target.closest('.ar-linha'); if (!li) return;
        const i = Number(li.dataset.i), acao = e.target.dataset.acao;
        if (acao === 'cor') { paletaAberta = paletaAberta === i ? null : i; desenhar(); return; }
        if (e.target.dataset.cor) { rascunho[i].cor = e.target.dataset.cor; paletaAberta = null; desenhar(); return; }
        const ativos = rascunho.filter(r => !r.removida), pos = ativos.indexOf(rascunho[i]);
        if (acao === 'cima' && pos > 0) { const j=rascunho.indexOf(ativos[pos-1]); [rascunho[i],rascunho[j]]=[rascunho[j],rascunho[i]]; desenhar(); }
        if (acao === 'baixo' && pos < ativos.length-1) { const j=rascunho.indexOf(ativos[pos+1]); [rascunho[i],rascunho[j]]=[rascunho[j],rascunho[i]]; desenhar(); }
        if (acao === 'remover' && ativos.length > 1) { rascunho[i].removida = true; desenhar(); }
    });
    q('#rot-nova-cor').onclick = () => { paletaAberta = paletaAberta === 'nova' ? null : 'nova'; desenhar(); };
    q('#rot-nova-paleta').addEventListener('click', e => { if (e.target.dataset.cor) { corNova=e.target.dataset.cor; paletaAberta=null; desenhar(); } });
    const adicionar = () => {
        const campo=q('#rot-novo-nome'), nome=normalizar(campo.value), msg=q('#rot-msg');
        if (!nome) { msg.textContent='Informe um nome.'; return; }
        if (rascunho.some(r => !r.removida && normalizar(r.nome).toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) { msg.textContent='Já existe um rótulo com esse nome.'; return; }
        rascunho.push({orig:null,nome,cor:corNova,removida:false}); campo.value=''; corNova=PALETA_ROTULOS[rascunho.length % PALETA_ROTULOS.length]; msg.textContent=''; desenhar(); campo.focus();
    };
    q('#rot-add').onclick=adicionar;
    q('#rot-novo-nome').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();adicionar();}});
    q('#rot-salvar').onclick=()=>{
        const ativos=rascunho.filter(r=>!r.removida).map(r=>({...r,nome:normalizar(r.nome)}));
        const nomes=ativos.map(r=>r.nome.toLocaleLowerCase('pt-BR'));
        if (ativos.some(r=>!r.nome) || new Set(nomes).size!==nomes.length) { q('#rot-msg').textContent='Use nomes preenchidos e sem duplicidade.'; return; }
        const primeiro=ativos[0].nome;
        rascunho.forEach(r=>{ if(!r.orig)return; db.forEach(item=>{ if((item.rotulo||opcoesRotulos[0]?.nome)===r.orig) item.rotulo=r.removida?primeiro:(ativos.find(a=>a.orig===r.orig)?.nome||primeiro); }); });
        opcoesRotulos=ativos.map(r=>({nome:r.nome,cor:r.cor}));
        preferenciasUsuario.kanbanColunas=opcoesRotulos.map(r=>r.nome);
        salvarBancoDeDados(db); salvarOpcoesGlobais();
        inicioRotulosKanban=Math.min(inicioRotulosKanban,Math.max(0,opcoesRotulos.length-ROTULOS_POR_TELA));
        fechar(); aplicarVisao();
    };
    q('#rot-fechar').onclick=fechar; q('#rot-cancelar').onclick=fechar;
    overlay.addEventListener('click',e=>{if(e.target===overlay)fechar();});
    desenhar(); q('#rot-novo-nome').focus();
}
function fecharGerenciadorRotulos() { document.querySelector('.rotulos-overlay')?.remove(); }

function navegarRotulosKanban(delta) {
    const maximo = Math.max(0, ordemColunas().length - ROTULOS_POR_TELA);
    inicioRotulosKanban = Math.max(0, Math.min(maximo, inicioRotulosKanban + delta));
    renderizarKanban();
}

function ordemColunas() {
    const base = opcoesRotulos.map(r => r.nome);
    const salvo = Array.isArray(preferenciasUsuario.kanbanColunas) ? preferenciasUsuario.kanbanColunas : [];
    return [...salvo.filter(n => base.includes(n)), ...base.filter(n => !salvo.includes(n))];
}

function renderizarKanban() {
    fecharMenusFlutuantes();
    limparSelecaoCards();
    const kb = document.getElementById('kanban');
    if (!kb) return;
    validarPastaAtual();
    const termo = window.__termoBusca || '';
    const guardado = kb.querySelector('.kb-board');
    const rolagem = guardado ? guardado.scrollLeft : 0;
    const padrao = opcoesRotulos[0].nome;
    const todasColunas = ordemColunas();
    const maximoInicio = Math.max(0, todasColunas.length - ROTULOS_POR_TELA);
    inicioRotulosKanban = Math.max(0, Math.min(maximoInicio, inicioRotulosKanban));
    const nomesVisiveis = todasColunas.slice(inicioRotulosKanban, inicioRotulosKanban + ROTULOS_POR_TELA);
    const colunas = todasColunas.map(nome => ({ nome, cor: obterCorRotulo(nome), itens: [] }));
    db.forEach((p, i) => {
        if ((p.pai || null) !== (pastaAtual || null)) return;
        const texto = [p.nome, p.rotulo, p.area, ...(p.tags || []).map(x => x.nome)].join(' ').toLowerCase();
        if (termo && !texto.includes(termo)) return;
        (colunas.find(c => c.nome === (p.rotulo || padrao)) || colunas.find(c => c.nome === padrao) || colunas[0]).itens.push(i);
    });
    const pai = pastaAtual ? ((pastaPorId(pastaAtual) || {}).pai || null) : null;
    const voltar = pastaAtual
        ? `<div class="kb-voltar" data-drop-pasta="${pai || ''}" onclick="irParaPasta(${pai ? `'${pai}'` : 'null'})">↰ Voltar para ${escapeHTML(pai ? pastaPorId(pai).nome : 'Workspace')}</div>`
        : '';
    const navegacao = todasColunas.length > ROTULOS_POR_TELA
        ? `<div class="kb-navegacao" role="navigation" aria-label="Navegação das colunas do Kanban">
            <button type="button" class="kb-seta kb-seta-anterior" onclick="navegarRotulosKanban(-1)" ${inicioRotulosKanban === 0 ? 'disabled' : ''} aria-label="Mostrar rótulos anteriores" title="Mostrar rótulos anteriores">‹</button>
            <span class="kb-paginacao">${inicioRotulosKanban + 1}–${Math.min(inicioRotulosKanban + ROTULOS_POR_TELA, todasColunas.length)} de ${todasColunas.length}</span>
            <button type="button" class="kb-seta kb-seta-proxima" onclick="navegarRotulosKanban(1)" ${inicioRotulosKanban >= maximoInicio ? 'disabled' : ''} aria-label="Mostrar próximos rótulos" title="Mostrar próximos rótulos">›</button>
        </div>`
        : '';
    kb.innerHTML = voltar + navegacao + '<div class="kb-board">' + colunas.filter(c => nomesVisiveis.includes(c.nome)).map(c => `
        <section class="kb-col" data-rotulo="${escapeHTML(c.nome)}">
            <header class="kb-col-topo" style="--cor-col:${c.cor}" title="Arraste para reordenar as colunas"><span class="alca-arrastar kb-col-alca">⠿</span><h3>${escapeHTML(c.nome)}</h3><span class="kb-conta">${c.itens.length}</span></header>
            <div class="kb-lista">${c.itens.map(htmlCardKanban).join('') || '<div class="kb-vazio">Sem itens</div>'}</div>
        </section>`).join('') + '</div>';
    kb.querySelector('.kb-board').scrollLeft = rolagem;
}

document.getElementById('kanban').addEventListener('click', e => {      // clique no card abre o projeto ou a pasta
    const card = e.target.closest('.kb-card');
    if (!card || e.target.closest('button, a, input')) return;
    const i = Number(card.dataset.idx), p = db[i];
    if (p.tipo === 'pasta') irParaPasta(p.id); else location.href = `cards.html?id=${i}`;
});

let arrastoKb = null;

document.addEventListener('pointerdown', e => {
    if (visaoAtual !== 'kanban' || e.button > 0 || !e.target.closest) return;
    const card = e.target.closest('.kb-card');
    if (!card || e.target.closest('button, a, input')) return;
    const index = Number(card.dataset.idx);
    const indices = indicesParaArrastar(index);
    if (!itensSelecionados.has(index)) limparSelecaoCards();
    arrastoKb = { card, indices, id: e.pointerId, x0: e.clientX, y0: e.clientY, ativo: false, ghost: null, alvo: null, depois: false, col: null, dentro: undefined };
});

window.addEventListener('pointermove', e => {
    const a = arrastoKb;
    if (!a || e.pointerId !== a.id) return;
    if (!a.ativo) {
        if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
        a.ativo = true;
        a.indices.forEach(i => document.getElementById(`kb-card-${i}`)?.classList.add('arrastando-origem', 'selecionado'));
        a.indices.forEach(i => itensSelecionados.add(i));
        document.body.classList.add('arrastando');
        if (window.getSelection) window.getSelection().removeAllRanges();
        const g = a.card.cloneNode(true);
        g.classList.remove('arrastando-origem', 'selecionado');
        g.classList.add('ghost-arrasto');
        g.removeAttribute('id');
        g.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        g.setAttribute('aria-hidden', 'true');
        g.style.width = `${a.card.getBoundingClientRect().width}px`;
        if (a.indices.length > 1) {
            const quantidade = document.createElement('span');
            quantidade.className = 'ghost-arrasto-count';
            quantidade.textContent = `+${a.indices.length - 1}`;
            g.appendChild(quantidade);
        }
        document.body.appendChild(g);
        a.ghost = g;
    }
    a.ghost.style.left = (e.clientX + 14) + 'px';
    a.ghost.style.top = (e.clientY + 10) + 'px';
    if (e.clientY < 70) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
    const board = document.querySelector('#kanban .kb-board');
    if (board) {
        const r = board.getBoundingClientRect();
        if (e.clientX < r.left + 50) board.scrollLeft -= 16; else if (e.clientX > r.right - 50) board.scrollLeft += 16;
    }

    document.querySelectorAll('.drop-acima, .drop-abaixo, .drop-dentro, .drop-col')
        .forEach(x => x.classList.remove('drop-acima', 'drop-abaixo', 'drop-dentro', 'drop-col'));
    a.alvo = null; a.col = null; a.dentro = undefined;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.closest) return;
    const podeIrPara = pastaId => a.indices.every(i => {
        const origem = db[i];
        return origem && !(origem.tipo === 'pasta' && (origem.id === pastaId || ehDescendente(origem.id, pastaId)));
    });

    const zona = el.closest('[data-drop-pasta]');             // "voltar", Workspace e pastas do caminho
    if (zona) {
        const id = zona.dataset.dropPasta || null;
        if (podeIrPara(id)) { a.dentro = id; zona.classList.add('drop-dentro'); }
        return;
    }
    const alvo = el.closest('.kb-card');
    if (alvo && !a.indices.includes(Number(alvo.dataset.idx))) {
        const r = alvo.getBoundingClientRect();
        const rel = (e.clientY - r.top) / r.height;
        if (alvo.classList.contains('kb-pasta') && rel > .25 && rel < .75) {   // meio da pasta = colocar dentro
            const idPasta = db[Number(alvo.dataset.idx)].id;
            if (podeIrPara(idPasta)) { a.dentro = idPasta; alvo.classList.add('drop-dentro'); }
            return;
        }
        a.alvo = alvo;
        a.depois = rel > .5;
        alvo.classList.add(a.depois ? 'drop-abaixo' : 'drop-acima');
        return;
    }
    const col = el.closest('.kb-col');
    if (col) { a.col = col; col.classList.add('drop-col'); }
});

function finalizarArrastoKb(e, cancelar) {
    const a = arrastoKb;
    if (!a || e.pointerId !== a.id) return;
    arrastoKb = null;
    if (!a.ativo) return;
    if (a.ghost) a.ghost.remove();
    document.body.classList.remove('arrastando');
    a.indices.forEach(i => document.getElementById(`kb-card-${i}`)?.classList.remove('arrastando-origem'));
    document.querySelectorAll('.drop-acima, .drop-abaixo, .drop-dentro, .drop-col')
        .forEach(x => x.classList.remove('drop-acima', 'drop-abaixo', 'drop-dentro', 'drop-col'));
    window.__arrastou = true;                                  // evita abrir o card ao soltar
    setTimeout(() => { window.__arrastou = false; }, 0);
    if (cancelar) return;

    if (a.dentro !== undefined) { moverSelecaoParaPasta(a.indices, a.dentro); return; }
    if (a.alvo) {                                              // solto antes/depois de outro card: assume a coluna dele
        const para = Number(a.alvo.dataset.idx);
        const rotulo = db[para].rotulo || opcoesRotulos[0].nome;
        a.indices.forEach(i => { db[i].rotulo = rotulo; });
        reordenarSelecao(a.indices, para, a.depois);
    } else if (a.col) {                                        // solto na coluna: vai para o fim dela
        a.indices.forEach(i => { db[i].rotulo = a.col.dataset.rotulo; });
        limparSelecaoCards();
        salvarPastas();
    } else {
        return;
    }
}
window.addEventListener('pointerup', e => finalizarArrastoKb(e, false));
window.addEventListener('pointercancel', e => finalizarArrastoKb(e, true));

let arrastoCol = null;

document.addEventListener('pointerdown', e => {                // arrastar o título da coluna reordena as colunas
    if (visaoAtual !== 'kanban' || e.button > 0 || !e.target.closest) return;
    const topo = e.target.closest('.kb-col-topo');
    if (!topo) return;
    if (e.pointerType === 'touch' && !e.target.closest('.kb-col-alca')) return;
    arrastoCol = { col: topo.closest('.kb-col'), id: e.pointerId, x0: e.clientX, y0: e.clientY, ativo: false, ghost: null, alvo: null, depois: false };
});

window.addEventListener('pointermove', e => {
    const a = arrastoCol;
    if (!a || e.pointerId !== a.id) return;
    if (!a.ativo) {
        if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return;
        a.ativo = true;
        a.col.classList.add('arrastando-origem');
        document.body.classList.add('arrastando');
        if (window.getSelection) window.getSelection().removeAllRanges();
        const g = document.createElement('div');
        g.className = 'ghost-arrasto';
        g.textContent = a.col.dataset.rotulo;
        document.body.appendChild(g);
        a.ghost = g;
    }
    a.ghost.style.left = (e.clientX + 14) + 'px';
    a.ghost.style.top = (e.clientY + 10) + 'px';
    const board = document.querySelector('#kanban .kb-board');
    if (board) {
        const r = board.getBoundingClientRect();
        if (e.clientX < r.left + 60) board.scrollLeft -= 18; else if (e.clientX > r.right - 60) board.scrollLeft += 18;
    }
    document.querySelectorAll('.kb-col.drop-esq, .kb-col.drop-dir').forEach(x => x.classList.remove('drop-esq', 'drop-dir'));
    a.alvo = null;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const alvo = el && el.closest ? el.closest('.kb-col') : null;
    if (!alvo || alvo === a.col) return;
    const r = alvo.getBoundingClientRect();
    a.alvo = alvo;
    a.depois = e.clientX > r.left + r.width / 2;
    alvo.classList.add(a.depois ? 'drop-dir' : 'drop-esq');
});

function finalizarArrastoCol(e, cancelar) {
    const a = arrastoCol;
    if (!a || e.pointerId !== a.id) return;
    arrastoCol = null;
    if (!a.ativo) return;
    if (a.ghost) a.ghost.remove();
    document.body.classList.remove('arrastando');
    a.col.classList.remove('arrastando-origem');
    document.querySelectorAll('.kb-col.drop-esq, .kb-col.drop-dir').forEach(x => x.classList.remove('drop-esq', 'drop-dir'));
    if (cancelar || !a.alvo) return;
    /* Reordena apenas a janela visível, mas preserva as colunas ocultas das outras páginas.
       Antes, somente as cinco colunas renderizadas eram salvas; ordemColunas() anexava a coluna
       oculta ao final e a ordem global ficava incorreta ao organizar a página 2–6. */
    const ordemCompleta = ordemColunas();
    const nomesVisiveis = [...document.querySelectorAll('#kanban .kb-col')]
        .map(c => c.dataset.rotulo)
        .filter(n => n !== a.col.dataset.rotulo);
    let i = nomesVisiveis.indexOf(a.alvo.dataset.rotulo);
    if (i < 0) return;
    if (a.depois) i++;
    nomesVisiveis.splice(i, 0, a.col.dataset.rotulo);

    const inicio = Math.max(0, Math.min(inicioRotulosKanban, ordemCompleta.length));
    ordemCompleta.splice(inicio, nomesVisiveis.length, ...nomesVisiveis);

    preferenciasUsuario.kanbanColunas = ordemCompleta;
    salvarPreferenciasBanco({ ...lerPreferenciasBanco(), kanbanColunas: ordemCompleta });
    renderizarKanban();
}
window.addEventListener('pointerup', e => finalizarArrastoCol(e, false));
window.addEventListener('pointercancel', e => finalizarArrastoCol(e, true));
