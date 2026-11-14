let db = lerBancoDeDados();


let ordenacaoAtual = null;
let direcaoOrdenacao = 1;
let filtrosTabelaVisiveis = false;

let pastaAtual = new URLSearchParams(location.search).get('pasta') || null;
const preferenciasUsuario = lerPreferenciasBanco();
const chaveFiltrosTabela = () => `${chavePreferencias()}:filtros-tabela`;
const filtrosLocaisJson = localStorage.getItem(chaveFiltrosTabela());
let filtrosLocais = null;
if (filtrosLocaisJson) {
    try {
        filtrosLocais = JSON.parse(filtrosLocaisJson);
    } catch (erro) {
        console.error('Não foi possível ler os filtros locais salvos.', erro);
    }
}
const filtrosSalvos = filtrosLocais && typeof filtrosLocais === 'object' && !Array.isArray(filtrosLocais)
    ? filtrosLocais
    : preferenciasUsuario.filtrosTabela && typeof preferenciasUsuario.filtrosTabela === 'object'
        ? preferenciasUsuario.filtrosTabela
        : {};
const lerListaFiltroSalva = valores => {
    const unicos = new Map();
    (Array.isArray(valores) ? valores : []).forEach(valor => {
        if (typeof valor !== 'string') return;
        const nome = valor.trim();
        const chave = nome.toLocaleLowerCase('pt-BR');
        if (nome && !unicos.has(chave)) unicos.set(chave, nome);
    });
    return [...unicos.values()];
};
const filtrosTabela = {
    tag: lerListaFiltroSalva(filtrosSalvos.tag),
    rotulo: lerListaFiltroSalva(filtrosSalvos.rotulo),
    area: lerListaFiltroSalva(filtrosSalvos.area)
};
let visaoAtual = preferenciasUsuario.visao === 'kanban' ? 'kanban' : 'tabela';
let indiceEdicaoKanban = null;

const ordenacaoSalva = preferenciasUsuario.ordenacao;
if (ordenacaoSalva && ['nome', 'rotulo', 'area', 'prazo'].includes(ordenacaoSalva.tipo)) {
    ordenacaoAtual = ordenacaoSalva.tipo;
    direcaoOrdenacao = ordenacaoSalva.dir === -1 ? -1 : 1;
}


const ordemRotulos = [
    'A ser feito',
    'Atrasado',
    'Esperando',
    'Em andamento',
    'Pronto'
];


let opcoesRotulos =
    (Array.isArray(preferenciasUsuario.rotulos) && preferenciasUsuario.rotulos.length
        ? preferenciasUsuario.rotulos.map(r => ({ nome: r.nome, cor: r.cor }))
        : [
            { nome:'A ser feito', cor:'gray' },
            { nome:'Atrasado', cor:'red' },
            { nome:'Esperando', cor:'#a855f7' },
            { nome:'Em andamento', cor:'blue' },
            { nome:'Pronto', cor:'green' }
        ]);
/* Garante todos os rótulos e a ordem padrão (também em dados já salvos no navegador). */
const CORES_PADRAO_ROTULO = {
    'Em andamento':'blue','Esperando':'#a855f7','Atrasado':'red','A ser feito':'gray','Pronto':'green'
};
ordemRotulos.forEach(nome => {
    if (!opcoesRotulos.some(r => r.nome === nome)) {
        opcoesRotulos.push({ nome, cor: CORES_PADRAO_ROTULO[nome] });
    }
});
opcoesRotulos.sort((a, b) => {
    const pa = ordemRotulos.indexOf(a.nome), pb = ordemRotulos.indexOf(b.nome);
    return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
});
const rotuloEsperando = opcoesRotulos.find(r => r.nome === 'Esperando');
if (rotuloEsperando && rotuloEsperando.cor !== '#a855f7') {
    rotuloEsperando.cor = '#a855f7';
}

/* Áreas: vêm do workspace aberto (Planora_Areas, em db.js) e podem ser criadas, renomeadas e coloridas em "Gerenciar áreas". */
function opcoesAreaHtml(atual) {
    const nomes = Planora_Areas.nomes();
    if (atual && !nomes.includes(atual)) nomes.push(atual);
    return nomes
        .map(a => `<option value="${escapeHTML(a)}"${a === atual ? ' selected' : ''}>${escapeHTML(a)}</option>`)
        .join('');
}
function renderizarOpcoesAreaNovaPagina() {
    const caixa = document.getElementById('tipo-selecao-areas');
    if (!caixa) return;
    const marcado = document.querySelector('input[name="tipoPagina"]:checked');
    const nomes = Planora_Areas.nomes();
    const escolhida = marcado && nomes.includes(marcado.value) ? marcado.value : nomes[0];
    caixa.innerHTML = Planora_Areas.listar().map(a =>
        `<label style="${Planora_Areas.estilo(a.nome)}"><input type="radio" name="tipoPagina" value="${escapeHTML(a.nome)}"${a.nome === escolhida ? ' checked' : ''}><span>${escapeHTML(a.nome)}</span></label>`
    ).join('');
}


function salvarOpcoesGlobais() {
    preferenciasUsuario.rotulos = opcoesRotulos.map(r => ({ nome: r.nome, cor: r.cor }));
    salvarPreferenciasBanco({ ...lerPreferenciasBanco(), rotulos: preferenciasUsuario.rotulos });

}


if (!Array.isArray(preferenciasUsuario.rotulos) || !preferenciasUsuario.rotulos.length) {
    preferenciasUsuario.rotulos = opcoesRotulos.map(r => ({ nome: r.nome, cor: r.cor }));
    salvarPreferenciasBanco({ ...lerPreferenciasBanco(), rotulos: preferenciasUsuario.rotulos, kanbanColunas: opcoesRotulos.map(r => r.nome) });
}

const MAPA_CORES={blue:'#0ea5e9',green:'#10b981',red:'#dc2626',gray:'#4b5563',purple:'#a855f7'};
function obterCorRotulo(nome) {

    const r =
        opcoesRotulos.find(
            x => x.nome === nome
        );

    const c = r ? r.cor : 'blue';
    return MAPA_CORES[c] || c;

}


function ordenarPor(tipo) {

    if (ordenacaoAtual === tipo) {

        direcaoOrdenacao *= -1;

    } else {

        ordenacaoAtual = tipo;
        direcaoOrdenacao = 1;

    }

    salvarPreferenciasBanco({
        ...lerPreferenciasBanco(),
        ordenacao: { tipo: ordenacaoAtual, dir: direcaoOrdenacao }
    });
    renderizarTabela();

}


/* Ordem de exibição: a personalizada (a do banco) ou a ordenação temporária por coluna. */
function calcularOrdemVisual() {

    const tipo = ordenacaoAtual;

    const nivel = db.map((_, i) => i).filter(i => (db[i].pai || null) === (pastaAtual || null));

    if (!tipo) {
        return nivel;
    }

    return nivel.sort((ia, ib) => {

        const a = db[ia];
        const b = db[ib];


        if (tipo === 'nome') {

            return String(a.nome || '')
                .localeCompare(
                    String(b.nome || ''),
                    'pt-BR',
                    {
                        sensitivity:'base'
                    }
                ) * direcaoOrdenacao;

        }


        if (tipo === 'rotulo') {

            const nomeA = String(a.rotulo || 'Em andamento');
            const nomeB = String(b.rotulo || 'Em andamento');
            const ordemConfigurada = opcoesRotulos.map(rotulo => rotulo.nome);
            const posA = ordemConfigurada.indexOf(nomeA);
            const posB = ordemConfigurada.indexOf(nomeB);

            /*
             * Rótulos cadastrados seguem exatamente a ordem configurada no
             * gerenciador. Rótulos antigos que ainda não estejam na lista
             * ficam depois e são agrupados alfabeticamente.
             */
            if (posA !== posB) {
                if (posA === -1) return 1 * direcaoOrdenacao;
                if (posB === -1) return -1 * direcaoOrdenacao;
                return (posA - posB) * direcaoOrdenacao;
            }

            return nomeA.localeCompare(nomeB, 'pt-BR', {
                sensitivity: 'base',
                numeric: true
            }) * direcaoOrdenacao;

        }


        if (tipo === 'area') {

            return String(a.area || '')
                .localeCompare(
                    String(b.area || ''),
                    'pt-BR',
                    {
                        sensitivity:'base'
                    }
                ) * direcaoOrdenacao;

        }


        if (tipo === 'prazo') {

            const prazoA =
                a.prazo;

            const prazoB =
                b.prazo;


            const semA =
                !prazoA ||
                prazoA === '---';


            const semB =
                !prazoB ||
                prazoB === '---';


            if (semA && semB)
                return 0;


            if (semA)
                return 1;


            if (semB)
                return -1;


            return (
                new Date(
                    prazoA + 'T00:00:00'
                ) -
                new Date(
                    prazoB + 'T00:00:00'
                )
            ) * direcaoOrdenacao;

        }


        return 0;

    });

}

function valoresUnicosFiltro(valores) {
    const unicos = new Map();
    valores.forEach(valor => {
        const nome = String(valor || '').trim();
        const chave = nome.toLocaleLowerCase('pt-BR');
        if (nome && !unicos.has(chave)) unicos.set(chave, nome);
    });
    return [...unicos.values()];
}

function normalizarFiltroTabela(valor) {
    return String(valor || '').toLocaleLowerCase('pt-BR');
}

function definirOpcoesFiltro(id, textoPadrao, prefixo, plural, valores, tipo) {
    const grupo = document.getElementById(id);
    if (!grupo) return false;

    const aberto = grupo.querySelector('details')?.open || false;
    const disponiveis = new Map(valores.map(valor => [normalizarFiltroTabela(valor), valor]));
    const selecionadosAntes = filtrosTabela[tipo];
    const selecionados = db.length
        ? selecionadosAntes.map(valor => disponiveis.get(normalizarFiltroTabela(valor))).filter(Boolean)
        : selecionadosAntes;
    const alterado = selecionados.length !== selecionadosAntes.length ||
        selecionados.some((valor, indice) => valor !== selecionadosAntes[indice]);
    if (db.length) filtrosTabela[tipo] = selecionados;

    const resumo = selecionados.length === 0
        ? `${prefixo} - ${textoPadrao}`
        : selecionados.length === 1
            ? `${prefixo} - ${selecionados[0]}`
            : `${prefixo} - ${selecionados.length} ${plural}`;
    grupo.innerHTML = `<details class="filtro-tabela-dropdown"${aberto ? ' open' : ''}>
        <summary title="${escapeHTML(resumo)}">${escapeHTML(resumo)}</summary>
        <div class="filtro-tabela-opcoes" role="group" aria-label="${escapeHTML(prefixo)}">
            ${valores.length ? valores.map(valor => `<label class="filtro-tabela-opcao">
                <input type="checkbox" data-filtro-tipo="${tipo}" value="${escapeHTML(valor)}" ${selecionados.some(selecionado => normalizarFiltroTabela(selecionado) === normalizarFiltroTabela(valor)) ? 'checked' : ''}>
                <span>${escapeHTML(valor)}</span>
            </label>`).join('') : '<span class="filtro-tabela-sem-opcoes">Nenhuma opção</span>'}
        </div>
    </details>`;
    return alterado;
}

function renderizarFiltrosTabela() {
    const rotulos = valoresUnicosFiltro(opcoesRotulos.map(rotulo => rotulo.nome));
    const areas = valoresUnicosFiltro(db.map(projeto => projeto.area || Planora_Areas.padrao()));
    const tags = valoresUnicosFiltro(db.flatMap(projeto => (projeto.tags || []).map(tag => tag.nome)));
    const ordenar = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    rotulos.sort(ordenar);
    areas.sort(ordenar);
    tags.sort(ordenar);
    let alterado = definirOpcoesFiltro('filtro-tag', 'Todas', 'Tag', 'selecionadas', tags, 'tag');
    alterado = definirOpcoesFiltro('filtro-rotulo', 'Todos', 'Rótulo', 'selecionados', rotulos, 'rotulo') || alterado;
    alterado = definirOpcoesFiltro('filtro-area', 'Todas', 'Área', 'selecionadas', areas, 'area') || alterado;
    if (alterado) salvarFiltrosTabela();
}

function salvarFiltrosTabela() {
    localStorage.setItem(chaveFiltrosTabela(), JSON.stringify({
        tag: [...filtrosTabela.tag],
        rotulo: [...filtrosTabela.rotulo],
        area: [...filtrosTabela.area]
    }));
}

function atualizarFiltroTabela(tipo, valor, marcado) {
    const selecionados = filtrosTabela[tipo];
    if (!Array.isArray(selecionados)) return;
    const chave = normalizarFiltroTabela(valor);
    const jaSelecionado = selecionados.some(item => normalizarFiltroTabela(item) === chave);
    if (marcado && !jaSelecionado) selecionados.push(valor);
    else if (!marcado && jaSelecionado) {
        filtrosTabela[tipo] = selecionados.filter(item => normalizarFiltroTabela(item) !== chave);
    }
    salvarFiltrosTabela();
    renderizarTabela();
}

function limparFiltrosTabela() {
    filtrosTabela.tag = [];
    filtrosTabela.rotulo = [];
    filtrosTabela.area = [];
    salvarFiltrosTabela();
    renderizarTabela();
}

function atualizarBotaoFiltrosTabela() {
    const botao = document.getElementById('topo-filtros');
    if (!botao) return;
    const aberto = filtrosTabelaVisiveis && db.length > 0;
    botao.hidden = !db.length;
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar filtros' : 'Abrir filtros');
    botao.title = aberto ? 'Fechar filtros' : 'Abrir filtros';
}

function alternarFiltrosTabela() {
    const barra = document.getElementById('barra-filtros');
    if (!barra || !db.length) return;
    filtrosTabelaVisiveis = !filtrosTabelaVisiveis;
    barra.hidden = !filtrosTabelaVisiveis;
    atualizarBotaoFiltrosTabela();
    if (filtrosTabelaVisiveis) barra.querySelector('summary')?.focus();
}

window.aoAlternarFiltros = alternarFiltrosTabela;

document.getElementById('barra-filtros')?.addEventListener('change', event => {
    const checkbox = event.target.closest('input[type="checkbox"][data-filtro-tipo]');
    if (checkbox) atualizarFiltroTabela(checkbox.dataset.filtroTipo, checkbox.value, checkbox.checked);
});

function projetoCorrespondeFiltros(projeto) {
    return (!filtrosTabela.tag.length || (projeto.tags || []).some(tag =>
        filtrosTabela.tag.some(selecionada => normalizarFiltroTabela(tag.nome) === normalizarFiltroTabela(selecionada)))) &&
        (!filtrosTabela.rotulo.length || filtrosTabela.rotulo.some(selecionada =>
            normalizarFiltroTabela(projeto.rotulo || opcoesRotulos[0]?.nome || 'Em andamento') === normalizarFiltroTabela(selecionada))) &&
        (!filtrosTabela.area.length || filtrosTabela.area.some(selecionada =>
            normalizarFiltroTabela(projeto.area || Planora_Areas.padrao()) === normalizarFiltroTabela(selecionada)));
}


function renderizarTabela() {
    limparSelecaoCards();
    renderizarFiltrosTabela();

    const tbody =
        document.getElementById(
            'corpo-tabela'
        );


    tbody.innerHTML = '';


    if (!db.length) {

        document.getElementById(
            'estado-vazio'
        ).style.display = 'block';


        document.getElementById(
            'conteudo-tabela'
        ).style.display = 'none';


        return;

    }


    document.getElementById(
        'estado-vazio'
    ).style.display = 'none';


    document.getElementById(
        'conteudo-tabela'
    ).style.display = 'block';


    validarPastaAtual();
    if (pastaAtual) tbody.appendChild(criarLinhaVoltar());
    const nivelAtual = calcularOrdemVisual().filter(index => projetoCorrespondeFiltros(db[index]));
    if (!nivelAtual.length) {
        const linhaVazia = criarLinhaVazia();
        const filtrosAtivos = Object.values(filtrosTabela).some(selecionados => selecionados.length > 0);
        linhaVazia.querySelector('td').textContent = filtrosAtivos
            ? 'Nenhum item corresponde aos filtros.'
            : pastaAtual
                ? 'Pasta vazia. Crie uma página aqui ou arraste itens para dentro dela.'
                : 'Nenhum item para exibir.';
        tbody.appendChild(linhaVazia);
    }
    nivelAtual.forEach(index => {

        const projeto = db[index];

        const tr =
            document.createElement('tr');


        tr.id =
            `linha-projeto-${index}`;
        if (projeto.tipo === 'pasta') tr.className = 'linha-pasta';


        tr.onclick = e => {

            if (
                tr.classList.contains(
                    'em-edicao'
                )
            ) {
                return;
            }


            if (
                !e.target.closest(
                    '.col-acoes'
                ) &&
                !e.target.closest(
                    'select'
                ) &&
                !e.target.closest(
                    'input'
                ) &&
                !e.target.closest(
                    'button'
                )
            ) {

                if (projeto.tipo === 'pasta') irParaPasta(projeto.id);
                else location.href = `cards.html?id=${index}`;

            }

        };


        const rotulo =
            projeto.rotulo ||
            'Em andamento';


        const area = projeto.area || Planora_Areas.padrao();


        let prazo =
            projeto.prazo ||
            '---';


        if (
            prazo !== '---' &&
            prazo.includes('-')
        ) {

            const p =
                prazo.split('-');


            if (p.length === 3) {

                prazo =
                    `${p[2]}/${p[1]}/${p[0]}`;

            }

        }


        tr.innerHTML = `

            <td>

                <div class="col-nome">

                    <span class="alca-arrastar" title="Arraste para mover">⠿</span>

                    <span>${projeto.tipo === 'pasta' ? '📁' : '📄'}</span>

                    <span class="titulo-linha">${escapeHTML(projeto.nome)}${htmlDetalhesInline(projeto)}</span>
                    <span class="tags-linha">${(projeto.tags || []).map(htmlTagBolha).join('')}<button type="button" class="btn-tag-mais pilula-prazo" onclick="abrirPopTags(event, ${index})" title="Adicionar tag" aria-label="Adicionar tag">+</button></span>

                </div>

            </td>


            <td>

                <span
                    class="selo selo-rotulo"
                    style="--glow:${obterCorRotulo(rotulo)}"
                >
                    ${escapeHTML(rotulo)}
                </span>

            </td>


            <td>

                <span class="pilula-area" style="${Planora_Areas.estilo(area)}">
                    ${escapeHTML(area)}
                </span>

            </td>


            <td>
                ${prazo === '---' ? '---' : `<span class="pilula-prazo">${escapeHTML(prazo)}</span>`}
            </td>


            <td class="col-acoes">

                <button
                    class="btn-tabela-opcoes"
                    onclick="alternarMenuTabela(event,${index})"
                >
                    ⋮
                </button>


                <div
                    class="menu-tabela-flutuante"
                    id="menu-tabela-${index}"
                >

                    <button
                        onclick="ativarEdicaoCompleta(${index})"
                    >
                        Editar
                    </button>


                    <button
                        onclick="${projeto.tipo === 'pasta' ? 'excluirPasta' : 'deletarProjeto'}(${index})"
                        style="color:#ff4d4d"
                    >
                        Deletar
                    </button>

                </div>

            </td>

        `;


        tbody.appendChild(tr);

    });

}


function escapeHTML(v) {

    return String(v ?? '')
        .replace(
            /[&<>"']/g,
            c => ({
                '&':'&amp;',
                '<':'&lt;',
                '>':'&gt;',
                '"':'&quot;',
                "'":'&#039;'
            }[c])
        );

}



function alternarMenuTabela(
    event,
    index
) {

    event.stopPropagation();


    document
        .querySelectorAll(
            '.menu-tabela-flutuante'
        )
        .forEach((m, i) => {

            if (i !== index) {
                m.style.display = 'none';
            }

        });


    const menu =
        document.getElementById(
            `menu-tabela-${index}`
        );


    const abrir = menu.style.display !== 'block';
    menu.style.display = abrir ? 'block' : 'none';
    if (!abrir) return;

    /* Menu "fixed": não é cortado pela rolagem/bordas da tabela. */
    const caixa = event.currentTarget.getBoundingClientRect();
    const altura = menu.offsetHeight;
    const cabeAbaixo = caixa.bottom + 6 + altura <= window.innerHeight;
    menu.style.position = 'fixed';
    menu.style.left = 'auto';
    menu.style.right = (window.innerWidth - caixa.right) + 'px';
    menu.style.top = (cabeAbaixo ? caixa.bottom + 6 : Math.max(8, caixa.top - 6 - altura)) + 'px';

}

function alternarMenuKanban(event, index) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-kanban-${index}`);
    const abrir = menu.style.display !== 'block';
    fecharMenusFlutuantes();
    if (abrir) {
        const botao = event.currentTarget;
        document.body.appendChild(menu);
        menu.style.display = 'block';
        menu.style.position = 'fixed';

        const caixa = botao.getBoundingClientRect();
        const margem = 8;
        const largura = menu.offsetWidth;
        const altura = menu.offsetHeight;
        const esquerda = Math.max(margem, Math.min(
            caixa.right - largura,
            window.innerWidth - largura - margem
        ));
        const abaixo = window.innerHeight - caixa.bottom - margem;
        const topo = altura <= abaixo || caixa.top < altura + margem
            ? Math.min(caixa.bottom + 6, window.innerHeight - altura - margem)
            : caixa.top - altura - 6;

        menu.style.left = `${esquerda}px`;
        menu.style.right = 'auto';
        menu.style.top = `${Math.max(margem, topo)}px`;
    }
}

function editarNoKanban(index) {
    const p = db[index];
    if (!p) return;
    indiceEdicaoKanban = index;
    document.getElementById('kanban-edit-nome').value = p.nome || '';
    document.getElementById('kanban-edit-rotulo').innerHTML = opcoesRotulos
        .map(r => `<option value="${escapeHTML(r.nome)}" ${r.nome === p.rotulo ? 'selected' : ''}>${escapeHTML(r.nome)}</option>`)
        .join('');
    document.getElementById('kanban-edit-area').innerHTML = opcoesAreaHtml(p.area);
    document.getElementById('kanban-edit-prazo').value =
        p.prazo && p.prazo !== '---' ? p.prazo : '';
    document.getElementById('modalEditarKanban').style.display = 'flex';
    document.getElementById('kanban-edit-nome').focus();
}

function fecharEdicaoKanban() {
    document.getElementById('modalEditarKanban').style.display = 'none';
    indiceEdicaoKanban = null;
}

function salvarEdicaoKanban(event) {
    event.preventDefault();
    const index = indiceEdicaoKanban;
    const nome = document.getElementById('kanban-edit-nome').value.trim();
    if (index === null || !db[index]) return;
    if (!nome) {
        document.getElementById('kanban-edit-nome').focus();
        return;
    }
    db[index].nome = nome;
    db[index].rotulo = document.getElementById('kanban-edit-rotulo').value;
    db[index].area = document.getElementById('kanban-edit-area').value;
    db[index].prazo = document.getElementById('kanban-edit-prazo').value || '---';
    salvarBancoDeDados(db);
    fecharEdicaoKanban();
    renderizarTabela();
}

function fecharMenusFlutuantes() {
    document.querySelectorAll('.menu-tabela-flutuante, .menu-card-flutuante')
        .forEach(menu => {
            menu.style.display = 'none';
            if (!menu.id.startsWith('menu-kanban-') || menu.parentElement !== document.body) return;

            const indice = menu.id.slice('menu-kanban-'.length);
            const card = document.getElementById(`kb-card-${indice}`);
            const topo = card && card.querySelector('.kb-card-topo');
            if (topo) topo.insertAdjacentElement('afterend', menu);

            menu.style.position = '';
            menu.style.left = '';
            menu.style.right = '';
            menu.style.top = '';
        });
}

window.addEventListener('scroll', fecharMenusFlutuantes, true);
window.onclick = fecharMenusFlutuantes;


function abrirModal() {

    renderizarOpcoesAreaNovaPagina();

    document.getElementById(
        'modalNovaPagina'
    ).style.display = 'flex';


    setTimeout(
        () =>
            document
                .getElementById(
                    'nomePagina'
                )
                .focus(),
        50
    );

}


function fecharModal() {

    document.getElementById(
        'modalNovaPagina'
    ).style.display = 'none';

}


async function salvarNovoProjeto() {

    const nome =
        document
            .getElementById(
                'nomePagina'
            )
            .value
            .trim();


    if (!nome)
        return;


    const area =
        document.querySelector(
            'input[name="tipoPagina"]:checked'
        ).value;


    db.push({

        nome,

        rotulo:
            opcoesRotulos[0]?.nome ||
            'Em andamento',

        area,

        prazo:'---',

        pai: pastaAtual || null,
        cards:[]

    });


    salvarBancoDeDados(db);
    await descarregarNuvem();
    permitirNavegacaoComPendencias();
    location.href =
        `cards.html?id=${db.length - 1}`;

}


document
    .getElementById('nomePagina')
    .addEventListener(
        'keydown',
        e => {

            if (e.key === 'Enter')
                salvarNovoProjeto();


            if (e.key === 'Escape')
                fecharModal();

        }
    );


function ativarEdicaoCompleta(index) {

    const linhaEmEdicao =
        document.querySelector(
            '#corpo-tabela tr.em-edicao'
        );

    if (linhaEmEdicao) {
        if (linhaEmEdicao.id === `linha-projeto-${index}`) return;
        renderizarTabela();
    }

    const p =
        db[index];


    const tr =
        document.getElementById(
            `linha-projeto-${index}`
        );


    tr.classList.add(
        'em-edicao'
    );


    document
        .getElementById(
            `nome-container-${index}`
        )
        ?.remove();


    tr.innerHTML = `

        <td>

            <input
                id="edit-nome-${index}"
                class="input-inline-tabela"
                value="${escapeHTML(p.nome)}"
            >

        </td>


        <td>

            <select
                id="edit-rotulo-${index}"
                class="select-inline-tabela"
            >

                ${opcoesRotulos
                    .map(
                        r =>
                            `<option
                                ${r.nome === p.rotulo ? 'selected' : ''}
                            >
                                ${escapeHTML(r.nome)}
                            </option>`
                    )
                    .join('')
                }

            </select>

        </td>


        <td>

            <select
                id="edit-area-${index}"
                class="select-inline-tabela"
            >

                ${opcoesAreaHtml(p.area)}

            </select>

        </td>


        <td>

            <input
                type="date"
                id="edit-prazo-${index}"
                class="input-inline-tabela"
                value="${
                    p.prazo &&
                    p.prazo !== '---'
                        ? p.prazo
                        : ''
                }"
            >

        </td>


        <td class="col-acoes">

            <button
                class="btn-salvar-inline"
                onclick="salvarEdicaoCompleta(${index})"
            >
                Salvar
            </button>

        </td>

    `;

}


function salvarEdicaoCompleta(index) {

    const nome =
        document
            .getElementById(
                `edit-nome-${index}`
            )
            .value
            .trim();


    if (!nome) {

        alert(
            'O título do projeto não pode ser vazio.'
        );

        return;

    }


    db[index].nome =
        nome;


    db[index].rotulo =
        document
            .getElementById(
                `edit-rotulo-${index}`
            )
            .value;


    db[index].area =
        document
            .getElementById(
                `edit-area-${index}`
            )
            .value;


    db[index].prazo =
        document
            .getElementById(
                `edit-prazo-${index}`
            )
            .value ||
        '---';


    salvarBancoDeDados(db);

    renderizarTabela();

}


function deletarProjeto(index) {

    if (
        confirm(
            `Tem certeza que deseja deletar o projeto "${db[index].nome}"?`
        )
    ) {

        db.splice(
            index,
            1
        );


        salvarBancoDeDados(db);

        renderizarTabela();

    }

}
