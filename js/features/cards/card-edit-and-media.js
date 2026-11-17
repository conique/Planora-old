function escaparAtributoCard(texto) {
    return String(texto || '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

async function ativarEdicaoCard(index) {
    const card = projetoAtual.cards[index];
    const container = document.getElementById(`card-conteudo-${index}`);
    if (!card || !container) return;
    if (container.querySelector('.rich-toolbar')) return;

    const botoes = document.getElementById(`btn-opcoes-${index}`);
    if (botoes) botoes.style.display = 'none';
    const menu = document.getElementById(`menu-card-${index}`);
    if (menu) menu.style.display = 'none';
    const notas = document.getElementById(`notas-${index}`);
    if (notas) notas.hidden = true;

    container.style.cursor = 'default';
    container.removeAttribute('ondblclick');
    container.removeAttribute('title');
    container.innerHTML = `
        <input id="edit-titulo-${index}" class="input-titulo-card" type="text"
            value="${escaparAtributoCard(card.titulo)}" placeholder="Título do card">
        ${Planora_RichText.toolbarHTML(`edit-card-${index}`)}
        <div id="edit-legenda-${index}" class="input-legenda-card rich-editor" contenteditable="true"
            role="textbox" aria-label="Texto do card" aria-multiline="true"
            data-placeholder="Escreva o texto do card..."></div>
        <div class="acoes-edicao-card">
            <button type="button" class="btn-cancelar-edicao" onclick="cancelarEdicaoCard(${index})">Cancelar edição</button>
            <button type="button" class="btn-enviar-card" onclick="salvarEdicaoCard(${index})" title="Salvar alterações">Salvar</button>
        </div>`;

    const editor = document.getElementById(`edit-legenda-${index}`);
    const toolbar = container.querySelector('.rich-toolbar');
    const arquivoInput = toolbar.querySelector('input[type="file"]');
    arquivoInput.id = `edit-novo-arquivo-${index}`;

    try {
        await Planora_RichText.prepararEdicao(editor, `edicao-${index}`, card);
        Planora_RichText.iniciar(editor, toolbar, arquivoInput, `edicao-${index}`);
        const campoTitulo = document.getElementById(`edit-titulo-${index}`);
        campoTitulo.focus();
        campoTitulo.select();
    } catch (erro) {
        console.error('Erro ao carregar editor do card:', erro);
        alert('Não foi possível carregar o conteúdo do card.\n\n' + (erro.message || erro));
        cancelarEdicaoCard(index);
    }
}

function cancelarEdicaoCard(index) {
    const container = document.getElementById(`card-conteudo-${index}`);
    Planora_RichText.liberar(`edicao-${index}`, container);
    renderizarTimeline();
}
