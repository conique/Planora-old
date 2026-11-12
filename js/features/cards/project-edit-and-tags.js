/* =========================================================
           SEMÁFORO DO CARD (verde → vermelho → amarelo) E NOTAS
        ========================================================= */
        const ORDEM_SEMAFORO = ['verde', 'vermelho', 'amarelo', 'cinza'];

        function escaparHTML(texto) {
            return String(texto).replace(/[&<>"']/g, c => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));
        }

        function alternarSemaforo(index) {
            const card = projetoAtual.cards[index];
            const atual = card.semaforo || 'verde';
            card.semaforo = ORDEM_SEMAFORO[(ORDEM_SEMAFORO.indexOf(atual) + 1) % ORDEM_SEMAFORO.length];
            db[projetoId] = projetoAtual;
            salvarBancoDeDados(db);
            const bola = document.getElementById(`semaforo-${index}`);
            bola.className = `btn-semaforo ${card.semaforo} pulo`;
            bola.title = `Status do card: ${card.semaforo} (clique para mudar)`;
            setTimeout(() => bola.classList.remove('pulo'), 350);
        }

        function renderizarNotas(index) {
            const area = document.getElementById(`notas-${index}`);
            if (!area) return;
            const notas = projetoAtual.cards[index].notas || [];
            const itens = notas.map((n, i) => `
                <div class="nota-item">
                    <span class="nota-avatar">EU</span>
                    <div class="nota-corpo">
                        <div class="nota-meta">
                            <span>${escaparHTML(n.data || '')}</span>
                            <button type="button" class="nota-apagar" title="Apagar nota" onclick="apagarNota(${index}, ${i})">×</button>
                        </div>
                        <p class="legenda-card">${formatarLegenda(n.texto)}</p>
                    </div>
                </div>`).join('');
            area.innerHTML = `
                <div class="notas-topo"><strong>Minhas notas</strong>${notas.length ? `<span>${notas.length}</span>` : ''}</div>
                ${itens ? `<div class="notas-lista">${itens}</div>` : ''}
                <div class="nota-nova">
                    <input type="text" id="nota-input-${index}" placeholder="Adicionar uma nota pessoal a este card..."
                        onkeydown="if (event.key === 'Enter') salvarNota(${index})">
                    <button type="button" onclick="salvarNota(${index})">Salvar</button>
                </div>`;
        }

        function salvarNota(index) {
            const campo = document.getElementById(`nota-input-${index}`);
            const texto = campo.value.trim();
            if (!texto) return;
            const card = projetoAtual.cards[index];
            const agora = new Date();
            (card.notas = card.notas || []).push({
                texto,
                data: `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
            });
            db[projetoId] = projetoAtual;
            salvarBancoDeDados(db);
            renderizarNotas(index);
            document.getElementById(`nota-input-${index}`).focus();
        }

        function apagarNota(index, notaIndex) {
            if (!confirm('Apagar esta nota?')) return;
            projetoAtual.cards[index].notas.splice(notaIndex, 1);
            db[projetoId] = projetoAtual;
            salvarBancoDeDados(db);
            renderizarNotas(index);
        }
