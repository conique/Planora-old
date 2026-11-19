(function () {
    'use strict';

    const estados = new Map();

    const tagsPermitidas = new Set([
        'p', 'div', 'br', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
        'sub', 'sup', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote',
        'img', 'video'
    ]);

    /*
     * Essas cores podem ser usadas automaticamente pelo tema.
     * Elas só serão preservadas quando estiverem marcadas com:
     * data-cor-texto-manual="sim"
     */
    const coresAutomaticas = new Set([
        'rgb(0, 0, 0)',
        'rgb(17, 24, 39)',
        'rgb(23, 32, 51)',
        'rgb(28, 36, 48)',
        'rgb(228, 231, 236)',
        'rgb(255, 255, 255)'
    ]);

    function escapar(texto) {
        return String(texto).replace(/[&<>"']/g, caractere => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[caractere]);
    }

    function normalizarCorTexto(cor) {
        if (!cor) return '';

        const elemento = document.createElement('span');
        elemento.style.color = cor;

        return elemento.style.color;
    }

    function normalizarCor(cor) {
        if (!cor) return '';

        const elemento = document.createElement('span');
        elemento.style.backgroundColor = cor;

        return elemento.style.backgroundColor;
    }

    function corBranca(cor) {
        return normalizarCorTexto(cor) === 'rgb(255, 255, 255)';
    }

    function corPreta(cor) {
        return normalizarCorTexto(cor) === 'rgb(0, 0, 0)';
    }

    function corAutomatica(cor) {
        return coresAutomaticas.has(normalizarCorTexto(cor));
    }

    function corTransparente(cor) {
        if (!cor) return true;

        const elemento = document.createElement('span');
        elemento.style.backgroundColor = cor;

        return (
            elemento.style.backgroundColor === '' ||
            elemento.style.backgroundColor === 'transparent' ||
            elemento.style.backgroundColor === 'rgba(0, 0, 0, 0)'
        );
    }

    /*
     * Aplica uma cor marcada como manual.
     *
     * O "important" é necessário porque alguns temas podem utilizar
     * regras como ".card * { color: ... !important; }".
     */
    function aplicarCorManual(elemento, cor) {
        if (!(elemento instanceof HTMLElement)) return;

        const corNormalizada = normalizarCorTexto(cor);

        if (!corNormalizada) return;
        if (!CSS.supports('color', corNormalizada)) return;

        elemento.style.setProperty('color', corNormalizada, 'important');
        elemento.dataset.corTextoManual = 'sim';
    }

    function removerCorManual(elemento) {
        if (!(elemento instanceof HTMLElement)) return;

        elemento.style.removeProperty('color');
        delete elemento.dataset.corTextoManual;

        if (!elemento.getAttribute('style')) {
            elemento.removeAttribute('style');
        }
    }

    /*
     * Reforça as cores manuais depois de:
     * - carregar um card;
     * - trocar o tema;
     * - editar o conteúdo;
     * - sanitizar o HTML.
     */
    function protegerCoresManuais(container) {
        if (!(container instanceof HTMLElement) &&
            !(container instanceof DocumentFragment)) {
            return;
        }

        const elementos = [];

        if (
            container instanceof HTMLElement &&
            container.matches('[data-cor-texto-manual="sim"]')
        ) {
            elementos.push(container);
        }

        elementos.push(
            ...container.querySelectorAll('[data-cor-texto-manual="sim"]')
        );

        elementos.forEach(elemento => {
            const cor = normalizarCorTexto(elemento.style.color);

            if (!cor) {
                delete elemento.dataset.corTextoManual;
                return;
            }

            aplicarCorManual(elemento, cor);
        });
    }

    /*
     * Remove cores automáticas antigas que não foram selecionadas
     * manualmente pelo usuário.
     *
     * Isso permite que esses textos voltem a acompanhar o tema.
     */
    function limparCoresAutomaticas(container) {
        if (!(container instanceof HTMLElement) &&
            !(container instanceof DocumentFragment)) {
            return;
        }

        container.querySelectorAll('span[style]').forEach(span => {
            const cor = normalizarCorTexto(span.style.color);
            const corManual = span.dataset.corTextoManual === 'sim';

            if (!cor || corManual) return;

            if (corAutomatica(cor)) {
                span.style.removeProperty('color');

                if (!span.getAttribute('style')) {
                    span.removeAttribute('style');
                }
            }
        });
    }

    function sanitizar(html) {
        const modelo = document.createElement('template');
        modelo.innerHTML = String(html || '');

        function limpar(no, dentroDeMidia) {
            if (no.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(no.nodeValue);
            }

            if (no.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }

            const tag = no.tagName.toLowerCase();

            if (
                [
                    'script',
                    'style',
                    'iframe',
                    'object',
                    'embed',
                    'svg',
                    'math'
                ].includes(tag)
            ) {
                return null;
            }

            if (!tagsPermitidas.has(tag)) {
                const fragmento = document.createDocumentFragment();

                Array.from(no.childNodes).forEach(filho => {
                    const copia = limpar(filho, dentroDeMidia);

                    if (copia) {
                        fragmento.appendChild(copia);
                    }
                });

                return fragmento;
            }

            if (
                (tag === 'img' || tag === 'video') &&
                !dentroDeMidia
            ) {
                return null;
            }

            const elemento = document.createElement(tag);

            const wrapperMidia =
                tag === 'span' &&
                no.hasAttribute('data-card-media');

            if (wrapperMidia) {
                elemento.className = 'rich-media';
                elemento.setAttribute('data-card-media', '');

                [
                    'data-midia-id',
                    'data-midia-temp',
                    'data-tipo-midia'
                ].forEach(nome => {
                    const valor = no.getAttribute(nome);

                    if (
                        valor &&
                        /^[\w-]{1,160}$/.test(valor)
                    ) {
                        elemento.setAttribute(nome, valor);
                    }
                });
            } else if (
                tag === 'span' ||
                tag === 'p' ||
                tag === 'div' ||
                tag === 'h2' ||
                tag === 'h3' ||
                tag === 'blockquote'
            ) {
                const cor = normalizarCorTexto(no.style.color);
                const fundo = normalizarCor(no.style.backgroundColor);
                const alinhamento = no.style.textAlign;
                const corManual =
                    no.dataset.corTextoManual === 'sim';

                /*
                 * Cores de texto são aplicadas somente em spans.
                 *
                 * Quando a cor foi escolhida pelo usuário, inclusive
                 * preto ou branco, ela é salva como cor manual.
                 */
                if (
                    tag === 'span' &&
                    cor &&
                    CSS.supports('color', cor)
                ) {
                    if (corManual) {
                        aplicarCorManual(elemento, cor);
                    } else if (!corAutomatica(cor)) {
                        /*
                         * Compatibilidade com cards antigos:
                         * uma cor que não pertence ao conjunto automático
                         * é entendida como escolha manual.
                         */
                        aplicarCorManual(elemento, cor);
                    }
                }

                if (
                    tag === 'span' &&
                    fundo &&
                    CSS.supports('background-color', fundo) &&
                    !corTransparente(fundo)
                ) {
                    elemento.style.backgroundColor = fundo;
                }

                if (
                    ['left', 'center', 'right', 'justify']
                        .includes(alinhamento)
                ) {
                    elemento.style.textAlign = alinhamento;
                }
            }

            if (tag === 'img') {
                const alt = no.getAttribute('alt');

                if (alt) {
                    elemento.alt = alt.slice(0, 300);
                }
            }

            if (tag === 'video') {
                elemento.controls = true;
            }

            Array.from(no.childNodes).forEach(filho => {
                if (
                    filho.nodeType === Node.ELEMENT_NODE &&
                    filho.matches('button.rich-media-remove')
                ) {
                    return;
                }

                const copia = limpar(
                    filho,
                    dentroDeMidia || wrapperMidia
                );

                if (copia) {
                    elemento.appendChild(copia);
                }
            });

            return elemento;
        }

        const resultado = document.createElement('div');

        Array.from(modelo.content.childNodes).forEach(no => {
            const copia = limpar(no, false);

            if (copia) {
                resultado.appendChild(copia);
            }
        });

        protegerCoresManuais(resultado);

        return resultado.innerHTML;
    }

    function temConteudoSignificativo(no) {
        if (no.nodeType === Node.TEXT_NODE) {
            return Boolean(no.nodeValue.trim());
        }

        if (no.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        if (no.matches('.rich-media, img, video')) {
            return true;
        }

        return Array.from(no.childNodes)
            .some(temConteudoSignificativo);
    }

    function removerLinhasVaziasNoFinal(no) {
        while (no.lastChild) {
            const ultimo = no.lastChild;

            if (
                ultimo.nodeType === Node.TEXT_NODE &&
                !ultimo.nodeValue.trim()
            ) {
                ultimo.remove();
                continue;
            }

            if (ultimo.nodeType === Node.ELEMENT_NODE) {
                if (
                    ultimo.tagName === 'BR' ||
                    !temConteudoSignificativo(ultimo)
                ) {
                    ultimo.remove();
                    continue;
                }

                removerLinhasVaziasNoFinal(ultimo);
            }

            break;
        }
    }

    function removerMarcaTexto(editor) {
        const selecao = window.getSelection();

        const range =
            selecao && selecao.rangeCount
                ? selecao.getRangeAt(0)
                : null;

        const coresPretasDoMarca = new Set();

        if (
            range &&
            editor.contains(range.commonAncestorContainer)
        ) {
            editor.querySelectorAll('span[style]').forEach(span => {
                if (
                    !corPreta(span.style.color) ||
                    !range.intersectsNode(span)
                ) {
                    return;
                }

                /*
                 * Não remove o preto se ele foi escolhido
                 * manualmente pelo usuário.
                 */
                if (span.dataset.corTextoManual === 'sim') {
                    return;
                }

                let ancestral = span;

                while (ancestral && ancestral !== editor) {
                    if (
                        ancestral.tagName === 'SPAN' &&
                        ancestral.style.backgroundColor &&
                        !corTransparente(
                            ancestral.style.backgroundColor
                        )
                    ) {
                        coresPretasDoMarca.add(span);
                        break;
                    }

                    ancestral = ancestral.parentElement;
                }
            });
        }

        document.execCommand(
            'hiliteColor',
            false,
            'transparent'
        );

        editor.querySelectorAll('span[style]').forEach(span => {
            if (
                !corTransparente(span.style.backgroundColor)
            ) {
                return;
            }

            span.style.removeProperty('background-color');

            if (!span.getAttribute('style')) {
                span.removeAttribute('style');
            }
        });

        coresPretasDoMarca.forEach(span => {
            if (
                !span.isConnected ||
                !corPreta(span.style.color)
            ) {
                return;
            }

            if (span.dataset.corTextoManual === 'sim') {
                return;
            }

            span.style.removeProperty('color');

            if (!span.getAttribute('style')) {
                span.removeAttribute('style');
            }
        });

        protegerCoresManuais(editor);
    }

    function marcarCorTextoManual(editor, estado) {
        if (!estado.corTextoManual) return;

        const selecao = window.getSelection();

        if (!selecao || !selecao.rangeCount) return;

        const range = selecao.getRangeAt(0);

        if (!editor.contains(range.commonAncestorContainer)) {
            return;
        }

        const corManual = normalizarCorTexto(
            estado.corTextoManual
        );

        if (!range.collapsed) {
            editor.querySelectorAll('span[style]').forEach(span => {
                if (
                    range.intersectsNode(span) &&
                    normalizarCorTexto(span.style.color) ===
                        corManual
                ) {
                    aplicarCorManual(span, corManual);
                }
            });

            protegerCoresManuais(editor);
            return;
        }

        let ancestral =
            range.startContainer.nodeType === Node.ELEMENT_NODE
                ? range.startContainer
                : range.startContainer.parentElement;

        while (ancestral && ancestral !== editor) {
            if (
                ancestral.tagName === 'SPAN' &&
                normalizarCorTexto(ancestral.style.color) ===
                    corManual
            ) {
                aplicarCorManual(ancestral, corManual);
                protegerCoresManuais(editor);
                return;
            }

            ancestral = ancestral.parentElement;
        }

        /*
         * Em alguns navegadores, execCommand pode criar o span
         * somente depois que o usuário começar a digitar.
         */
        editor.querySelectorAll('span[style]').forEach(span => {
            if (
                normalizarCorTexto(span.style.color) ===
                corManual
            ) {
                aplicarCorManual(span, corManual);
            }
        });

        protegerCoresManuais(editor);
    }

    function instalarProtecaoDeTema() {
        if (
            document.getElementById(
                'planora-rich-text-cor-manual'
            )
        ) {
            return;
        }

        const estilo = document.createElement('style');

        estilo.id = 'planora-rich-text-cor-manual';

        estilo.textContent = `
            [data-cor-texto-manual="sim"] {
                color: inherit;
            }

            .rich-editor [data-cor-texto-manual="sim"],
            .rich-content [data-cor-texto-manual="sim"],
            .card [data-cor-texto-manual="sim"] {
                color: var(
                    --planora-cor-texto-manual,
                    inherit
                ) !important;
            }
        `;

        document.head.appendChild(estilo);
    }

    function atualizarVariaveisDeCorManual(container) {
        if (!container) return;

        container
            .querySelectorAll(
                '[data-cor-texto-manual="sim"]'
            )
            .forEach(elemento => {
                const cor = normalizarCorTexto(
                    elemento.style.color
                );

                if (!cor) return;

                elemento.style.setProperty(
                    '--planora-cor-texto-manual',
                    cor
                );

                elemento.style.setProperty(
                    'color',
                    cor,
                    'important'
                );
            });
    }

    function toolbarHTML(id) {
        const acoes = [
            ['bold', '<strong>B</strong>', 'Negrito'],
            ['italic', '<em>I</em>', 'Itálico'],
            ['underline', '<u>U</u>', 'Sublinhado'],
            ['strikeThrough', '<s>S</s>', 'Tachado'],
            [
                'insertUnorderedList',
                '• Lista',
                'Lista com marcadores'
            ],
            [
                'insertOrderedList',
                '1. Lista',
                'Lista numerada'
            ],
            [
                'justifyLeft',
                'Esquerda',
                'Alinhar à esquerda'
            ],
            [
                'justifyCenter',
                'Centro',
                'Centralizar'
            ],
            [
                'justifyRight',
                'Direita',
                'Alinhar à direita'
            ]
        ];

        return `
            <div
                class="rich-toolbar"
                role="toolbar"
                aria-label="Formatação do texto"
            >
                ${acoes.map(
                    ([comando, texto, titulo]) => `
                        <button
                            type="button"
                            data-command="${comando}"
                            title="${titulo}"
                            aria-label="${titulo}"
                        >
                            ${texto}
                        </button>
                    `
                ).join('')}

                <select
                    data-block
                    aria-label="Estilo do parágrafo"
                    title="Estilo do parágrafo"
                >
                    <option value="P">Texto</option>
                    <option value="H2">Título</option>
                    <option value="H3">Subtítulo</option>
                    <option value="BLOCKQUOTE">
                        Citação
                    </option>
                </select>

                <span
                    class="rich-palette-grupo"
                    role="group"
                    aria-label="Cores do texto"
                >
                    <button
                        type="button"
                        class="rich-text-cor"
                        data-text-color="#111827"
                        style="--cor-texto: #111827"
                        title="Texto preto"
                        aria-label="Texto preto"
                    ></button>

                    <button
                        type="button"
                        class="rich-text-cor"
                        data-text-color="#ffffff"
                        style="--cor-texto: #ffffff"
                        title="Texto branco"
                        aria-label="Texto branco"
                    ></button>

                    <button
                        type="button"
                        class="rich-text-cor"
                        data-text-color="#2563eb"
                        style="--cor-texto: #2563eb"
                        title="Texto azul"
                        aria-label="Texto azul"
                    ></button>

                    <button
                        type="button"
                        class="rich-text-cor"
                        data-text-color="#dc2626"
                        style="--cor-texto: #dc2626"
                        title="Texto vermelho"
                        aria-label="Texto vermelho"
                    ></button>

                    <button
                        type="button"
                        class="rich-text-cor"
                        data-text-color="#15803d"
                        style="--cor-texto: #15803d"
                        title="Texto verde"
                        aria-label="Texto verde"
                    ></button>
                </span>

                <span
                    class="rich-palette-grupo"
                    role="group"
                    aria-label="Cores do marca-texto"
                >
                    <span>Grifar</span>

                    <button
                        type="button"
                        class="rich-marca-cor"
                        data-highlight-color="#fff19c"
                        style="--cor-marca: #fff19c"
                        title="Amarelo"
                        aria-label="Marca-texto amarelo"
                    ></button>

                    <button
                        type="button"
                        class="rich-marca-cor"
                        data-highlight-color="#b9f6ca"
                        style="--cor-marca: #b9f6ca"
                        title="Verde"
                        aria-label="Marca-texto verde"
                    ></button>

                    <button
                        type="button"
                        class="rich-marca-cor"
                        data-highlight-color="#bbdefb"
                        style="--cor-marca: #bbdefb"
                        title="Azul"
                        aria-label="Marca-texto azul"
                    ></button>

                    <button
                        type="button"
                        class="rich-marca-cor"
                        data-highlight-color="#f8bbd0"
                        style="--cor-marca: #f8bbd0"
                        title="Rosa"
                        aria-label="Marca-texto rosa"
                    ></button>

                    <button
                        type="button"
                        class="rich-marca-limpar"
                        data-action="clear-highlight"
                        title="Remover marca-texto"
                        aria-label="Remover marca-texto"
                    >
                        ×
                    </button>
                </span>

                <button
                    type="button"
                    data-action="media"
                    title="Inserir imagem ou vídeo"
                >
                    Inserir Mídia
                </button>

                <input
                    id="${id}-arquivo"
                    class="input-file-culto"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                >
            </div>
        `;
    }

    function criarWrapper(
        tipo,
        identificador,
        url,
        temporario
    ) {
        const wrapper = document.createElement('span');

        wrapper.className = 'rich-media';
        wrapper.setAttribute('data-card-media', '');

        wrapper.dataset.tipoMidia =
            tipo.startsWith('video')
                ? 'video'
                : 'image';

        wrapper.setAttribute(
            temporario
                ? 'data-midia-temp'
                : 'data-midia-id',
            identificador
        );

        wrapper.contentEditable = 'false';

        const midia = document.createElement(
            tipo.startsWith('video')
                ? 'video'
                : 'img'
        );

        if (midia.tagName === 'VIDEO') {
            midia.controls = true;
        } else {
            midia.alt = 'Imagem anexada';
        }

        if (url) {
            midia.src = url;
            midia.dataset.objectUrl = url;
        }

        wrapper.appendChild(midia);

        const remover = document.createElement('button');

        remover.className = 'rich-media-remove';
        remover.type = 'button';
        remover.textContent = '×';
        remover.title = 'Remover mídia';
        remover.setAttribute(
            'aria-label',
            'Remover mídia'
        );

        wrapper.appendChild(remover);

        return wrapper;
    }

    function guardarSelecao(editor, estado) {
        const selecao = window.getSelection();

        if (!selecao || !selecao.rangeCount) return;

        const range = selecao.getRangeAt(0);

        if (
            editor.contains(range.commonAncestorContainer)
        ) {
            estado.range = range.cloneRange();
        }
    }

    function restaurarSelecao(editor, estado) {
        editor.focus();

        const selecao = window.getSelection();

        if (
            estado.range &&
            editor.contains(
                estado.range.commonAncestorContainer
            )
        ) {
            selecao.removeAllRanges();
            selecao.addRange(estado.range);
        } else {
            const range = document.createRange();

            range.selectNodeContents(editor);
            range.collapse(false);

            selecao.removeAllRanges();
            selecao.addRange(range);

            estado.range = range.cloneRange();
        }
    }

    function inserirNoCursor(
        editor,
        estado,
        elemento
    ) {
        restaurarSelecao(editor, estado);

        const selecao = window.getSelection();
        const range = selecao.getRangeAt(0);

        range.deleteContents();
        range.insertNode(elemento);
        range.setStartAfter(elemento);
        range.collapse(true);

        selecao.removeAllRanges();
        selecao.addRange(range);

        guardarSelecao(editor, estado);
    }

    async function inserirArquivos(
        editor,
        estado,
        arquivos
    ) {
        for (const arquivo of arquivos) {
            if (
                !/^(image|video)\//i.test(
                    arquivo.type || ''
                )
            ) {
                continue;
            }

            const tempId =
                'tmp_' +
                Date.now() +
                '_' +
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            const url = URL.createObjectURL(arquivo);

            estado.arquivos.set(tempId, {
                blob: arquivo,
                tipo: arquivo.type,
                url
            });

            inserirNoCursor(
                editor,
                estado,
                criarWrapper(
                    arquivo.type,
                    tempId,
                    url,
                    true
                )
            );

            const espaco =
                document.createTextNode('\u00a0');

            inserirNoCursor(
                editor,
                estado,
                espaco
            );
        }
    }

    async function hidratar(editor, editavel) {
        instalarProtecaoDeTema();

        const wrappers = Array.from(
            editor.querySelectorAll(
                '.rich-media[data-midia-id]'
            )
        );

        for (const wrapper of wrappers) {
            if (
                wrapper.querySelector('[data-object-url]')
            ) {
                continue;
            }

            try {
                const registro = await obterMidiaBlob(
                    wrapper.dataset.midiaId
                );

                if (!registro || !registro.blob) {
                    throw new Error(
                        'Arquivo não encontrado: ' +
                        wrapper.dataset.midiaId
                    );
                }

                const url = URL.createObjectURL(
                    registro.blob
                );

                const tipo =
                    registro.tipo ||
                    wrapper.dataset.tipoMidia ||
                    '';

                const midia = criarWrapper(
                    tipo,
                    wrapper.dataset.midiaId,
                    url,
                    false
                );

                wrapper.replaceWith(midia);

                if (!editavel) {
                    const botaoRemover =
                        midia.querySelector(
                            '.rich-media-remove'
                        );

                    if (botaoRemover) {
                        botaoRemover.remove();
                    }
                }
            } catch (erro) {
                console.error(
                    'Não foi possível carregar mídia do card:',
                    erro
                );
            }
        }

        protegerCoresManuais(editor);
        atualizarVariaveisDeCorManual(editor);

        if (!editavel) {
            linkificar(editor);
        }
    }

    function ids(html) {
        const modelo = document.createElement('template');

        modelo.innerHTML = sanitizar(html);

        return Array.from(
            new Set(
                Array.from(
                    modelo.content.querySelectorAll(
                        '.rich-media[data-midia-id]'
                    )
                ).map(
                    elemento =>
                        elemento.dataset.midiaId
                )
            )
        );
    }

    function appendAtEnd(editor, wrapper) {
        if (editor.childNodes.length) {
            editor.appendChild(
                document.createTextNode(' ')
            );
        }

        editor.appendChild(wrapper);
        editor.appendChild(
            document.createTextNode(' ')
        );
    }

    function linkificar(editor) {
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT
        );

        const nosTexto = [];

        while (walker.nextNode()) {
            const no = walker.currentNode;

            if (
                !no.parentElement.closest(
                    'a, .rich-media'
                )
            ) {
                nosTexto.push(no);
            }
        }

        const padraoURL =
            /https?:\/\/[^\s<>]+|www\.[^\s<>]+/gi;

        nosTexto.forEach(no => {
            const texto = no.nodeValue;
            const fragmento =
                document.createDocumentFragment();

            let cursor = 0;
            let encontrou = false;
            let correspondencia;

            while (
                (
                    correspondencia =
                        padraoURL.exec(texto)
                )
            ) {
                let url = correspondencia[0];

                const pontuacao =
                    url.match(/[.,;:!?)\]]+$/);

                const final =
                    correspondencia.index +
                    url.length;

                if (pontuacao) {
                    url = url.slice(
                        0,
                        -pontuacao[0].length
                    );
                }

                if (!url) continue;

                const href =
                    /^www\./i.test(url)
                        ? `https://${url}`
                        : url;

                let destino;

                try {
                    destino = new URL(href);
                } catch (erro) {
                    continue;
                }

                if (
                    !['http:', 'https:'].includes(
                        destino.protocol
                    ) ||
                    !destino.hostname
                ) {
                    continue;
                }

                fragmento.appendChild(
                    document.createTextNode(
                        texto.slice(
                            cursor,
                            correspondencia.index
                        )
                    )
                );

                const ancora =
                    document.createElement('a');

                ancora.href = destino.href;
                ancora.textContent = url;
                ancora.target = '_blank';
                ancora.rel = 'noopener noreferrer';

                ancora.addEventListener(
                    'dblclick',
                    event =>
                        event.stopPropagation()
                );

                fragmento.appendChild(ancora);

                if (pontuacao) {
                    fragmento.appendChild(
                        document.createTextNode(
                            pontuacao[0]
                        )
                    );
                }

                cursor = final;
                encontrou = true;
            }

            if (encontrou) {
                fragmento.appendChild(
                    document.createTextNode(
                        texto.slice(cursor)
                    )
                );

                no.replaceWith(fragmento);
            }

            padraoURL.lastIndex = 0;
        });
    }

    async function prepararEdicao(
        editor,
        chave,
        card
    ) {
        instalarProtecaoDeTema();

        const estado = {
            editor,
            range: null,
            arquivos: new Map(),
            corTextoManual: null
        };

        estados.set(chave, estado);

        const legado = String(
            card.legenda || ''
        ).replace(/<br\s*\/?>/gi, '\n');

        editor.innerHTML = sanitizar(
            card.conteudoHtml ||
            escapar(legado).replace(
                /\n/g,
                '<br>'
            )
        );

        limparCoresAutomaticas(editor);
        protegerCoresManuais(editor);
        atualizarVariaveisDeCorManual(editor);

        await hidratar(editor, true);

        const existentes = new Set(
            ids(editor.innerHTML)
        );

        if (
            card.midiaId &&
            !existentes.has(card.midiaId)
        ) {
            appendAtEnd(
                editor,
                criarWrapper(
                    card.tipoMidia || '',
                    card.midiaId,
                    '',
                    false
                )
            );

            await hidratar(editor, true);
        } else if (
            card.midia &&
            !card.conteudoHtml
        ) {
            const resposta = await fetch(card.midia);

            if (!resposta.ok) {
                throw new Error(
                    'Não foi possível recuperar a mídia antiga do card.'
                );
            }

            const blob = await resposta.blob();

            const tipo =
                card.tipoMidia ||
                blob.type ||
                'image/*';

            const tempId =
                'tmp_' +
                Date.now() +
                '_' +
                Math.random()
                    .toString(36)
                    .slice(2, 10);

            const url = URL.createObjectURL(blob);

            estado.arquivos.set(tempId, {
                blob,
                tipo,
                url
            });

            appendAtEnd(
                editor,
                criarWrapper(
                    tipo,
                    tempId,
                    url,
                    true
                )
            );
        }

        return estado;
    }

    function iniciar(
        editor,
        toolbar,
        arquivoInput,
        chave
    ) {
        instalarProtecaoDeTema();

        const estado =
            estados.get(chave) || {
                editor,
                range: null,
                arquivos: new Map(),
                corTextoManual: null
            };

        estado.editor = editor;
        estados.set(chave, estado);

        document.execCommand(
            'styleWithCSS',
            false,
            true
        );

        protegerCoresManuais(editor);
        atualizarVariaveisDeCorManual(editor);

        editor.addEventListener(
            'keyup',
            () => {
                guardarSelecao(editor, estado);
                marcarCorTextoManual(
                    editor,
                    estado
                );
                atualizarVariaveisDeCorManual(
                    editor
                );
            }
        );

        editor.addEventListener(
            'mouseup',
            () => guardarSelecao(
                editor,
                estado
            )
        );

        editor.addEventListener(
            'input',
            () => {
                guardarSelecao(editor, estado);
                marcarCorTextoManual(
                    editor,
                    estado
                );
                protegerCoresManuais(editor);
                atualizarVariaveisDeCorManual(
                    editor
                );
            }
        );

        editor.addEventListener(
            'paste',
            event => {
                const itens =
                    event.clipboardData &&
                    Array.from(
                        event.clipboardData.items ||
                        []
                    );

                const arquivos = (itens || [])
                    .filter(
                        item =>
                            /^(image|video)\//i
                                .test(item.type)
                    )
                    .map(
                        item =>
                            item.getAsFile()
                    )
                    .filter(Boolean);

                if (arquivos.length) {
                    event.preventDefault();

                    inserirArquivos(
                        editor,
                        estado,
                        arquivos
                    );

                    return;
                }

                const texto =
                    event.clipboardData &&
                    event.clipboardData.getData(
                        'text/plain'
                    );

                if (texto) {
                    event.preventDefault();

                    restaurarSelecao(
                        editor,
                        estado
                    );

                    document.execCommand(
                        'insertText',
                        false,
                        texto
                    );

                    guardarSelecao(
                        editor,
                        estado
                    );
                }
            }
        );

        toolbar.addEventListener(
            'pointerdown',
            event => {
                if (
                    event.target.closest(
                        'button,select,input'
                    )
                ) {
                    guardarSelecao(
                        editor,
                        estado
                    );
                }
            }
        );

        toolbar.addEventListener(
            'dblclick',
            event => {
                event.preventDefault();
                event.stopPropagation();
            }
        );

        toolbar.addEventListener(
            'click',
            event => {
                const acaoMidia =
                    event.target.closest(
                        '[data-action="media"]'
                    );

                if (acaoMidia) {
                    guardarSelecao(
                        editor,
                        estado
                    );

                    arquivoInput.click();
                    return;
                }

                const limparMarca =
                    event.target.closest(
                        '[data-action="clear-highlight"]'
                    );

                if (limparMarca) {
                    restaurarSelecao(
                        editor,
                        estado
                    );

                    removerMarcaTexto(editor);

                    guardarSelecao(
                        editor,
                        estado
                    );

                    return;
                }

                const texto =
                    event.target.closest(
                        '[data-text-color]'
                    );

                if (texto) {
                    restaurarSelecao(
                        editor,
                        estado
                    );

                    estado.corTextoManual =
                        normalizarCorTexto(
                            texto.dataset.textColor
                        );

                    document.execCommand(
                        'foreColor',
                        false,
                        texto.dataset.textColor
                    );

                    marcarCorTextoManual(
                        editor,
                        estado
                    );

                    protegerCoresManuais(editor);
                    atualizarVariaveisDeCorManual(
                        editor
                    );

                    guardarSelecao(
                        editor,
                        estado
                    );

                    return;
                }

                const marca =
                    event.target.closest(
                        '[data-highlight-color]'
                    );

                if (marca) {
                    restaurarSelecao(
                        editor,
                        estado
                    );

                    const cor =
                        marca.dataset
                            .highlightColor;

                    const corAtual =
                        normalizarCor(
                            document
                                .queryCommandValue(
                                    'hiliteColor'
                                )
                        );

                    const removendo =
                        corAtual ===
                        normalizarCor(cor);

                    if (removendo) {
                        removerMarcaTexto(editor);
                    } else {
                        document.execCommand(
                            'hiliteColor',
                            false,
                            cor
                        );
                    }

                    protegerCoresManuais(editor);

                    guardarSelecao(
                        editor,
                        estado
                    );

                    return;
                }

                const botao =
                    event.target.closest(
                        '[data-command]'
                    );

                if (
                    !botao ||
                    botao.type !== 'button'
                ) {
                    return;
                }

                restaurarSelecao(
                    editor,
                    estado
                );

                document.execCommand(
                    botao.dataset.command,
                    false,
                    null
                );

                protegerCoresManuais(editor);

                guardarSelecao(
                    editor,
                    estado
                );
            }
        );

        const seletorBloco =
            toolbar.querySelector(
                '[data-block]'
            );

        if (seletorBloco) {
            seletorBloco.addEventListener(
                'change',
                event => {
                    restaurarSelecao(
                        editor,
                        estado
                    );

                    document.execCommand(
                        'formatBlock',
                        false,
                        event.target.value
                    );

                    protegerCoresManuais(editor);

                    guardarSelecao(
                        editor,
                        estado
                    );
                }
            );
        }

        arquivoInput.addEventListener(
            'change',
            () => {
                inserirArquivos(
                    editor,
                    estado,
                    Array.from(
                        arquivoInput.files ||
                        []
                    )
                );

                arquivoInput.value = '';
            }
        );

        editor.addEventListener(
            'click',
            event => {
                const botao =
                    event.target.closest(
                        '.rich-media-remove'
                    );

                if (!botao) return;

                event.preventDefault();

                const wrapper =
                    botao.closest(
                        '.rich-media'
                    );

                const tempId =
                    wrapper &&
                    wrapper.dataset.midiaTemp;

                if (tempId) {
                    const arquivo =
                        estado.arquivos.get(
                            tempId
                        );

                    if (arquivo) {
                        URL.revokeObjectURL(
                            arquivo.url
                        );
                    }

                    estado.arquivos.delete(
                        tempId
                    );
                }

                if (wrapper) {
                    wrapper.remove();
                }
            }
        );

        return estado;
    }

    function aprimorarNovoCard() {
        instalarProtecaoDeTema();

        const textarea =
            document.getElementById(
                'inputLegendaCard'
            );

        if (!textarea) return;

        if (textarea.isContentEditable) {
            const toolbarExistente =
                textarea.previousElementSibling;

            const arquivoExistente =
                toolbarExistente &&
                toolbarExistente.querySelector(
                    'input[type="file"]'
                );

            if (
                !toolbarExistente ||
                !arquivoExistente
            ) {
                throw new Error(
                    'A barra de ferramentas do editor do card não foi encontrada.'
                );
            }

            if (!estados.has('novo')) {
                iniciar(
                    textarea,
                    toolbarExistente,
                    arquivoExistente,
                    'novo'
                );
            }

            return;
        }

        const campoTitulo =
            document.getElementById(
                'inputTituloCard'
            );

        if (campoTitulo) {
            campoTitulo.removeAttribute(
                'onpaste'
            );
        }

        const editor =
            document.createElement('div');

        editor.id = textarea.id;
        editor.className =
            'input-legenda-card rich-editor';

        editor.contentEditable = 'true';

        editor.setAttribute(
            'role',
            'textbox'
        );

        editor.setAttribute(
            'aria-label',
            'Texto do card'
        );

        editor.setAttribute(
            'aria-multiline',
            'true'
        );

        editor.dataset.placeholder =
            'Escreva o texto do card...';

        const barra =
            document.createElement('div');

        barra.innerHTML =
            toolbarHTML('novo-card');

        const toolbar =
            barra.firstElementChild;

        const inputAntigo =
            document.getElementById(
                'inputMidiaCard'
            );

        const input =
            toolbar.querySelector(
                'input[type="file"]'
            );

        input.id = 'inputMidiaCard';
        input.multiple = true;

        const wrapperAntigo =
            inputAntigo &&
            inputAntigo.closest('div');

        if (wrapperAntigo) {
            wrapperAntigo.remove();
        }

        const previewAntigo =
            document.getElementById(
                'container-preview-novo'
            );

        if (previewAntigo) {
            previewAntigo.remove();
        }

        textarea.before(toolbar);
        textarea.replaceWith(editor);

        iniciar(
            editor,
            toolbar,
            input,
            'novo'
        );

        editor.innerHTML = '';
    }

    async function serializar(
        editor,
        chave
    ) {
        const estado = estados.get(chave);

        if (!estado) {
            throw new Error(
                'O editor do card não foi inicializado.'
            );
        }

        protegerCoresManuais(editor);
        atualizarVariaveisDeCorManual(
            editor
        );

        for (
            const wrapper of Array.from(
                editor.querySelectorAll(
                    '.rich-media[data-midia-temp]'
                )
            )
        ) {
            const tempId =
                wrapper.dataset.midiaTemp;

            const arquivo =
                estado.arquivos.get(tempId);

            if (!arquivo) {
                throw new Error(
                    'Uma mídia temporária do card não está disponível.'
                );
            }

            const id = await salvarMidiaBlob(
                arquivo.blob,
                arquivo.tipo
            );

            if (!id) {
                throw new Error(
                    'Não foi possível salvar uma mídia do card.'
                );
            }

            wrapper.dataset.midiaId = id;
            delete wrapper.dataset.midiaTemp;

            wrapper.dataset.tipoMidia =
                arquivo.tipo.startsWith(
                    'video'
                )
                    ? 'video'
                    : 'image';
        }

        const modelo =
            document.createElement(
                'template'
            );

        modelo.innerHTML =
            editor.innerHTML;

        removerLinhasVaziasNoFinal(
            modelo.content
        );

        protegerCoresManuais(
            modelo.content
        );

        return sanitizar(
            modelo.innerHTML
        );
    }

    function liberar(chave, container) {
        const estado = estados.get(chave);

        if (estado) {
            estado.arquivos.forEach(
                arquivo =>
                    URL.revokeObjectURL(
                        arquivo.url
                    )
            );
        }

        estados.delete(chave);

        if (container) {
            container
                .querySelectorAll(
                    '[data-object-url]'
                )
                .forEach(elemento => {
                    URL.revokeObjectURL(
                        elemento.dataset.objectUrl
                    );

                    elemento.removeAttribute(
                        'data-object-url'
                    );
                });
        }
    }

    function liberarUrls(container) {
        if (!container) return;

        const urls = new Set(
            Array.from(
                container.querySelectorAll(
                    '[data-object-url]'
                )
            ).map(
                elemento =>
                    elemento.dataset.objectUrl
            )
        );

        container
            .querySelectorAll(
                'img[src^="blob:"], video[src^="blob:"]'
            )
            .forEach(elemento => {
                urls.add(elemento.src);
            });

        urls.forEach(
            url => URL.revokeObjectURL(url)
        );
    }

    /*
     * Observa mudanças de tema e reaplica as cores escolhidas
     * manualmente. O observer não define a cor dos textos comuns.
     * Esses continuam seguindo o CSS normal do tema.
     */
    function observarMudancaDeTema() {
        const reaplicar = () => {
            document
                .querySelectorAll(
                    '.rich-editor, .rich-content, [data-card-rich-text]'
                )
                .forEach(container => {
                    protegerCoresManuais(
                        container
                    );

                    atualizarVariaveisDeCorManual(
                        container
                    );
                });
        };

        const observer =
            new MutationObserver(reaplicar);

        observer.observe(
            document.documentElement,
            {
                attributes: true,
                attributeFilter: [
                    'class',
                    'data-theme',
                    'theme'
                ]
            }
        );

        if (document.body) {
            observer.observe(
                document.body,
                {
                    attributes: true,
                    attributeFilter: [
                        'class',
                        'data-theme',
                        'theme'
                    ]
                }
            );
        }

        const preferenciaEscura =
            window.matchMedia(
                '(prefers-color-scheme: dark)'
            );

        if (
            typeof preferenciaEscura
                .addEventListener ===
            'function'
        ) {
            preferenciaEscura
                .addEventListener(
                    'change',
                    reaplicar
                );
        }

        reaplicar();
    }

    instalarProtecaoDeTema();

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            observarMudancaDeTema
        );
    } else {
        observarMudancaDeTema();
    }

    window.Planora_RichText = {
        aprimorarNovoCard,
        toolbarHTML,
        iniciar,
        prepararEdicao,
        serializar,
        sanitizar,
        ids,
        linkificar,
        hidratar,
        liberar,
        liberarUrls,
        protegerCoresManuais,
        limparCoresAutomaticas
    };
})();