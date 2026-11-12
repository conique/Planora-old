/* =========================================================
           CONFIGURAÇÃO DO PROJETO
        ========================================================= */

        const parametrosDaURL =
            new URLSearchParams(window.location.search);

        const projetoId =
            parametrosDaURL.get('id');

        let db =
            lerBancoDeDados();

        let projetoAtual =
            db[projetoId];

        if (!projetoAtual) {
            window.location.href = 'index.html';
        }

        let midiaTemporariaNovo = {
            blob: null,
            tipo: null,
            urlPreview: null
        };


        /* =========================================================
           RENDERIZAR TIMELINE
        ========================================================= */

        /* Minimizar/expandir cards: botão "−" (expandido) vira "□" (minimizado). */
        const ICONE_MENOS = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"></path></svg>';
        const ICONE_QUADRADO = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>';

        function aplicarMinimizacao(box, minimizado, animar) {
            const conteudo = box.querySelector('[id^="card-conteudo-"]');
            box.classList.toggle('minimizado', minimizado);
            if (conteudo) {
                if (minimizado) {
                    const d = conteudo.getAttribute('ondblclick');
                    if (d) { conteudo.dataset.dbl = d; conteudo.removeAttribute('ondblclick'); }
                    conteudo.style.cursor = 'default';
                    conteudo.removeAttribute('title');
                } else if (conteudo.dataset.dbl) {
                    conteudo.setAttribute('ondblclick', conteudo.dataset.dbl);
                    conteudo.style.cursor = 'pointer';
                    conteudo.title = 'Duplo clique para editar';
                }
            }
            const b = box.querySelector('.btn-min-card');
            if (b) {
                b.innerHTML = minimizado ? ICONE_QUADRADO : ICONE_MENOS;
                b.title = minimizado ? 'Expandir card' : 'Minimizar card';
                b.setAttribute('aria-label', b.title);
                b.setAttribute('aria-expanded', String(!minimizado));
            }
            if (animar) { box.classList.remove('anim-min'); void box.offsetWidth; box.classList.add('anim-min'); }
        }

        function sincronizarMinimizar() {
            document.querySelectorAll('#feed-timeline .timeline-item').forEach(item => {
                const box = item.querySelector('.timeline-card');
                if (!box) return;
                const card = projetoAtual.cards[Number(box.id.replace('card-box-', ''))];
                const b = box.querySelector('.btn-min-card');
                if (!card || !b) return;
                b.onclick = () => {
                    if (box.querySelector('.btn-enviar-card')) return;   // card em edição
                    const novo = !box.classList.contains('minimizado');
                    card.minimizado = novo;
                    db[projetoId] = projetoAtual;
                    salvarBancoDeDados(db);
                    aplicarMinimizacao(box, novo, true);
                };
                aplicarMinimizacao(box, !!card.minimizado, false);
            });
        }

        /* Lápis: se o card estiver minimizado, expande e abre a edição. */
        function editarCardPeloLapis(index) {
            const box = document.getElementById(`card-box-${index}`);
            if (!box || box.querySelector('.btn-enviar-card')) return;
            if (box.classList.contains('minimizado')) {
                projetoAtual.cards[index].minimizado = false;
                db[projetoId] = projetoAtual;
                salvarBancoDeDados(db);
                aplicarMinimizacao(box, false, false);
            }
            ativarEdicaoCard(index);
        }

        /* Formulário de novo card: aberto pelo botão padrão "Criar card" do header.
           Em projetos sem cards ele fica sempre aberto. */
        let formularioAberto = false;

        function abrirFecharFormulario(abrir, focar) {
            const form = document.getElementById('form-novo-card');
            formularioAberto = abrir;
            if (abrir) {
                form.hidden = false;
                form.classList.remove('fechando', 'entrando');
                void form.offsetWidth;
                form.classList.add('entrando');
                if (focar) setTimeout(() => document.getElementById('inputTituloCard').focus(), 120);
            } else {
                form.classList.remove('entrando');
                form.classList.add('fechando');
                setTimeout(() => {
                    if (!formularioAberto) { form.hidden = true; form.classList.remove('fechando'); }
                }, 220);
            }
            const acaoHeader = document.getElementById('topo-acao');
            if (acaoHeader) {
                acaoHeader.classList.toggle('ativo', abrir);
                acaoHeader.setAttribute('aria-expanded', String(abrir));
                const texto = acaoHeader.querySelector('span');
                if (texto) texto.textContent = abrir ? 'Fechar card' : 'Criar card';
            }
        }

        function sincronizarFormulario() {
            const form = document.getElementById('form-novo-card');
            const primeiro = document.querySelector('#feed-timeline .timeline-item');
            const botaoAntigo = document.querySelector('.btn-mais-card');
            if (botaoAntigo) botaoAntigo.remove();

            if (!primeiro) {
                formularioAberto = true;
                form.hidden = false;
                form.classList.remove('fechando', 'entrando');
            } else if (!form.classList.contains('fechando')) {
                form.hidden = !formularioAberto;
            }

            const acaoHeader = document.getElementById('topo-acao');
            if (acaoHeader) {
                acaoHeader.classList.toggle('ativo', formularioAberto);
                acaoHeader.setAttribute('aria-expanded', String(formularioAberto));
                const texto = acaoHeader.querySelector('span');
                if (texto) texto.textContent = formularioAberto ? 'Fechar card' : 'Criar card';
            }
        }

        window.aoNovoRegistro = () => abrirFecharFormulario(!formularioAberto, true);

        /* Campos de legenda crescem junto com o texto (Enter pula linha). */
        function ajustarAlturaTextarea(campo) {
            if (!campo) return;
            campo.style.height = 'auto';
            campo.style.height = campo.scrollHeight + 2 + 'px';
        }
        function ajustarTodasLegendas() {
            document.querySelectorAll('textarea.input-legenda-card').forEach(ajustarAlturaTextarea);
        }
        document.addEventListener('input', e => {
            if (e.target.matches && e.target.matches('textarea.input-legenda-card')) ajustarAlturaTextarea(e.target);
        });
        document.addEventListener('focusin', e => {
            if (e.target.matches && e.target.matches('textarea.input-legenda-card')) ajustarAlturaTextarea(e.target);
        });
        window.addEventListener('resize', ajustarTodasLegendas);

        function escaparHTML(texto) {
            return String(texto).replace(/[&<>"']/g, c => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
            ));
        }

        /* Legenda: preserva quebras de linha e transforma links em clicáveis (com escape de HTML). */
        function formatarLegenda(legenda) {
            const puro = String(legenda || '').replace(/<br\s*\/?>/gi, '\n');
            return escaparHTML(puro)
                .replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi, m => {
                    let url = m, fim = '';
                    const sobra = url.match(/[.,;:!?)\]]+$/);
                    if (sobra) { fim = sobra[0]; url = url.slice(0, -fim.length); }
                    const href = /^www\./i.test(url) ? 'https://' + url : url;
                    return `<a href="${href}" target="_blank" rel="noopener noreferrer" ondblclick="event.stopPropagation()">${url}</a>${fim}`;
                })
                .replace(/\n/g, '<br>');
        }

        function formatarPrazoHeader(prazo) {
            if (!prazo || prazo === '---') return '';
            const m = String(prazo).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            return m ? `${m[3]}/${m[2]}/${m[1]}` : prazo;
        }

        /* ---------- Editar os dados do projeto (título, rótulo, área, prazo e tags) na própria página ---------- */
        const ROTULOS_ORDEM = ['A ser feito', 'Atrasado', 'Esperando', 'Em andamento', 'Pronto'];

        function listaRotulosEdicao() {
            let nomes = [];
            try { nomes = ((lerPreferenciasBanco().rotulos || []) || []).map(r => r.nome); } catch (e) { /* padrão */ }
            ROTULOS_ORDEM.forEach(n => { if (!nomes.includes(n)) nomes.push(n); });
            return nomes.sort((a, b) => {
                const i = ROTULOS_ORDEM.indexOf(a), j = ROTULOS_ORDEM.indexOf(b);
                return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
            });
        }
        function listaAreasEdicao() {
            return Planora_Areas.nomes();
        }
        function preencherSelect(id, lista, atual) {
            const itens = atual && !lista.includes(atual) ? [...lista, atual] : lista;
            document.getElementById(id).innerHTML = itens
                .map(v => `<option${v === atual ? ' selected' : ''}>${escaparHTML(v)}</option>`).join('');
        }
        function abrirEdicaoDados() {
            document.getElementById('ed-nome').value = projetoAtual.nome || '';
            preencherSelect('ed-rotulo', listaRotulosEdicao(), projetoAtual.rotulo || projetoAtual.status || 'Em andamento');
            preencherSelect('ed-area', listaAreasEdicao(), projetoAtual.area || Planora_Areas.padrao());
            const prazo = projetoAtual.prazo || '';
            document.getElementById('ed-prazo').value = /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : '';
            document.getElementById('painel-edicao').hidden = false;
            document.getElementById('ed-nome').focus();
        }
        function fecharEdicaoDados() {
            document.getElementById('painel-edicao').hidden = true;
        }
        function salvarEdicaoDados() {
            const nome = document.getElementById('ed-nome').value.trim();
            if (!nome) { alert('O título não pode ficar vazio.'); return; }
            const rotulo = document.getElementById('ed-rotulo').value;
            projetoAtual.nome = nome;
            projetoAtual.rotulo = rotulo;
            if ('status' in projetoAtual) projetoAtual.status = rotulo;
            projetoAtual.area = document.getElementById('ed-area').value;
            projetoAtual.prazo = document.getElementById('ed-prazo').value || '---';
            db[projetoId] = projetoAtual;
            salvarBancoDeDados(db);
            if (typeof enviarAgora === 'function') enviarAgora();
            fecharEdicaoDados();
            renderizarTimeline();
        }

        document.getElementById('btn-editar-dados').addEventListener('click', () => {
            if (document.getElementById('painel-edicao').hidden) abrirEdicaoDados(); else fecharEdicaoDados();
        });
        document.getElementById('ed-salvar').addEventListener('click', salvarEdicaoDados);
        document.getElementById('ed-cancelar').addEventListener('click', fecharEdicaoDados);
        document.getElementById('painel-edicao').addEventListener('keydown', e => {
            if (e.key === 'Escape') { fecharEdicaoDados(); return; }
            if (e.key !== 'Enter') return;
            e.preventDefault();
            salvarEdicaoDados();
        });

        /* ---------- Tags do projeto: mesmo seletor do menu (escolher existente, criar com cor, remover) ---------- */
        const CORES_TAG = [
            '#3b82f6', '#22c55e', '#ef4444', '#f97316', '#eab308', '#a855f7',
            '#ec4899', '#14b8a6', '#6366f1', '#92400e', '#6b7280'
        ];
        let popTags = null;

        function tagsExistentes() {
            const mapa = new Map();
            db.forEach(p => (p.tags || []).forEach(tg => {
                const k = tg.nome.toLowerCase() + '|' + tg.cor;
                if (!mapa.has(k)) mapa.set(k, { nome: tg.nome, cor: tg.cor });
            }));
            return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        }

        function fecharPopTags() {
            if (popTags) { popTags.el.remove(); popTags = null; }
        }

        function abrirPopTags(event) {
            event.stopPropagation();
            if (popTags) return fecharPopTags();
            const el = document.createElement('div');
            el.className = 'pop-tags';
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-label', 'Tags do projeto');
            popTags = { el, cor: CORES_TAG[0], livres: [] };
            document.body.appendChild(el);

            el.addEventListener('click', e => {
                const b = e.target.closest('[data-acao]');
                if (!b) return;
                const acao = b.dataset.acao;
                if (acao === 'cor') definirCorPop(b.dataset.cor);
                else if (acao === 'remover') removerTag(Number(b.dataset.i));
                else if (acao === 'usar') adicionarTag(popTags.livres[Number(b.dataset.i)]);
                else if (acao === 'criar') criarTag();
            });
            el.addEventListener('input', e => {
                if (e.target.id === 'tag-cor-custom') definirCorPop(e.target.value);
            });
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.target.id === 'tag-nome') { e.preventDefault(); criarTag(); }
            });

            desenharPopTags();
            posicionarPopTags();
            const campo = el.querySelector('#tag-nome');
            if (campo) campo.focus();
        }

        function desenharPopTags() {
            const atuais = projetoAtual.tags || [];
            const livres = tagsExistentes().filter(tg => !atuais.some(a => a.nome.toLowerCase() === tg.nome.toLowerCase()));
            popTags.livres = livres;
            const estilo = c => `background:${c.cor};color:${corTextoTag(c.cor)}`;
            popTags.el.innerHTML = `
                ${atuais.length ? `<div class="pop-sec"><div class="pop-tit">Neste item</div><div class="pop-chips">
                    ${atuais.map((tg, i) => `<span class="tag-bolha tag-removivel" style="${estilo(tg)}">${escaparHTML(tg.nome)}<button type="button" data-acao="remover" data-i="${i}" aria-label="Remover tag ${escaparHTML(tg.nome)}">×</button></span>`).join('')}
                </div></div>` : ''}
                ${livres.length ? `<div class="pop-sec"><div class="pop-tit">Tags existentes</div><div class="pop-chips">
                    ${livres.map((tg, i) => `<button type="button" class="tag-bolha tag-escolher" data-acao="usar" data-i="${i}" style="${estilo(tg)}">${escaparHTML(tg.nome)}</button>`).join('')}
                </div></div>` : ''}
                <div class="pop-sec"><div class="pop-tit">Nova tag</div>
                    <input id="tag-nome" class="pop-input" maxlength="24" placeholder="Nome da tag" autocomplete="off">
                    <div class="pop-cores">
                        ${CORES_TAG.map(c => `<button type="button" class="cor-opcao${c === popTags.cor ? ' sel' : ''}" data-acao="cor" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}
                        <label class="cor-opcao cor-custom${CORES_TAG.includes(popTags.cor) ? '' : ' sel'}" title="Outra cor"><input type="color" id="tag-cor-custom" value="${popTags.cor}"></label>
                    </div>
                    <button type="button" class="btn-salvar-inline pop-criar" data-acao="criar">Adicionar</button>
                </div>`;
        }

        function definirCorPop(cor) {
            popTags.cor = cor;
            popTags.el.querySelectorAll('.cor-opcao').forEach(b => b.classList.remove('sel'));
            const pre = popTags.el.querySelector(`.cor-opcao[data-cor="${cor}"]`);
            (pre || popTags.el.querySelector('.cor-custom')).classList.add('sel');
        }

        function posicionarPopTags() {
            const btn = document.getElementById('btn-tag-mais');
            if (!btn || !popTags) return;
            const r = btn.getBoundingClientRect(), el = popTags.el;
            el.style.maxHeight = (window.innerHeight - 16) + 'px';
            const w = el.offsetWidth, h = el.offsetHeight;
            const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
            let top = r.bottom + 6;
            if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - 6 - h);
            el.style.left = left + 'px';
            el.style.top = top + 'px';
        }

        function atualizarAposTag() {
            db[projetoId] = projetoAtual;
            salvarBancoDeDados(db);
            if (typeof enviarAgora === 'function') enviarAgora();
            document.getElementById('header-tags').innerHTML = (projetoAtual.tags || []).map(htmlTagBolha).join('');
            desenharPopTags();
            posicionarPopTags();
        }

        function adicionarTag(tag) {
            if (!tag) return;
            projetoAtual.tags = projetoAtual.tags || [];
            if (projetoAtual.tags.some(x => x.nome.toLowerCase() === tag.nome.toLowerCase())) return;
            projetoAtual.tags.push({ nome: tag.nome, cor: tag.cor });
            atualizarAposTag();
        }

        function criarTag() {
            const campo = popTags.el.querySelector('#tag-nome');
            const nome = campo.value.trim().slice(0, 24);
            if (!nome) { campo.focus(); return; }
            adicionarTag({ nome, cor: popTags.cor });
            const novo = popTags.el.querySelector('#tag-nome');
            if (novo) novo.focus();
        }

        function removerTag(i) {
            (projetoAtual.tags || []).splice(i, 1);
            atualizarAposTag();
        }

        document.getElementById('btn-tag-mais').addEventListener('click', abrirPopTags);
        document.addEventListener('pointerdown', e => {
            if (popTags && !popTags.el.contains(e.target) && !e.target.closest('#btn-tag-mais')) fecharPopTags();
        }, true);
        document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharPopTags(); });
        window.addEventListener('resize', () => { if (popTags) posicionarPopTags(); });
        window.addEventListener('scroll', () => { if (popTags) posicionarPopTags(); }, true);

        async function renderizarTimeline() {

            document.getElementById('header-titulo').innerText =
                projetoAtual.nome;

            const statusHeader =
                document.getElementById('header-status');

            const rotuloHeader =
                projetoAtual.status ||
                projetoAtual.rotulo ||
                'Em andamento';

            statusHeader.innerText = rotuloHeader;

            document.getElementById('header-tags').innerHTML =

                (projetoAtual.tags || []).map(htmlTagBolha).join('');

            const nomeArea = projetoAtual.area || Planora_Areas.padrao();
            const elArea = document.getElementById('header-area');
            elArea.textContent = nomeArea;
            elArea.style.cssText = Planora_Areas.estilo(nomeArea);
            const prazoHeader = formatarPrazoHeader(projetoAtual.prazo);
            const elPrazo = document.getElementById('header-prazo');
            elPrazo.hidden = !prazoHeader;
            elPrazo.textContent = prazoHeader ? 'Prazo: ' + prazoHeader : '';

            /*
             * Usa exatamente a mesma cor do rótulo
             * utilizado na tabela/menu do Planora.
             */
            const opcoesRotulos =
                (lerPreferenciasBanco().rotulos || [
                    { nome: 'Em andamento', cor: 'blue' },
                    { nome: 'Pronto', cor: 'green' },
                    { nome: 'Esperando', cor: '#a855f7' },
                    { nome: 'Atrasado', cor: 'red' },
                    { nome: 'A ser feito', cor: 'gray' }
                ]);

            const rotuloEncontrado =
                opcoesRotulos.find(
                    item => item.nome === rotuloHeader
                );

            const MAPA_CORES = {blue:'#0ea5e9',green:'#10b981',red:'#dc2626',gray:'#4b5563',purple:'#a855f7'};
            const corBruta = rotuloEncontrado ? rotuloEncontrado.cor : 'blue';
            statusHeader.style.setProperty('--glow', MAPA_CORES[corBruta] || corBruta);

            const feed =
                document.getElementById('feed-timeline');

            feed.innerHTML = '';

            if (!projetoAtual.cards) {
                projetoAtual.cards = [];
            }

            [...projetoAtual.cards]
                .reverse()
                .forEach((card, indexRealInvertido) => {

                    const indexReal =
                        projetoAtual.cards.length -
                        1 -
                        indexRealInvertido;

                    const dataExibicao =
                        card.data ||
                        'Data não registada';

                    const itemDiv =
                        document.createElement('div');

                    itemDiv.className =
                        'timeline-item';

                    itemDiv.innerHTML = `
                        <span class="timeline-date">
                            ${card.data || 'Data não registada'}
                        </span>

                        <div
                            class="timeline-card"
                            id="card-box-${indexReal}"
                        >
                            <div class="card-controles">
                                <button
                                    class="btn-ctrl btn-editar-card"
                                    onclick="editarCardPeloLapis(${indexReal})"
                                    title="Editar card"
                                    aria-label="Editar card"
                                    type="button"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>
                                </button>
                                <button
                                    class="btn-ctrl btn-min-card"
                                    type="button"
                                    aria-label="Minimizar card"
                                ></button>
                                <button
                                    class="btn-ctrl btn-fechar-card"
                                    onclick="deletarCard(${indexReal})"
                                    title="Excluir card"
                                    aria-label="Excluir card"
                                    type="button"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14"></path><path d="M19 5L5 19"></path></svg>
                                </button>
                            </div>

                            <div
                                id="card-conteudo-${indexReal}"
                                ondblclick="ativarEdicaoCard(${indexReal})"
                                style="cursor: pointer;"
                                title="Duplo clique para editar"
                            >
                                <div class="card-cabecalho-conteudo">
                                    <button
                                        class="btn-semaforo ${card.semaforo || 'verde'}"
                                        id="semaforo-${indexReal}"
                                        onclick="event.stopPropagation(); alternarSemaforo(${indexReal})"
                                        title="Status do card: ${card.semaforo || 'verde'} (clique para mudar)"
                                        aria-label="Alterar status do card. Status atual: ${card.semaforo || 'verde'}"
                                        type="button"
                                    ></button>
                                    <span class="card-tipo-tag">
                                        ${card.tipo || 'Atualização'}
                                    </span>
                                    <h3>${card.titulo || ''}</h3>
                                </div>

                                <p class="legenda-card">${formatarLegenda(card.legenda)}</p>

                                <div
                                    class="card-midia-container"
                                    id="midia-card-${indexReal}"
                                ></div>
                            </div>
                            <div class="card-notas" id="notas-${indexReal}"></div>

                        </div>
                    `;

                    feed.appendChild(itemDiv);

                    renderizarNotas(indexReal);
                    carregarMidiaDoCard(card, indexReal);
                });
        }
