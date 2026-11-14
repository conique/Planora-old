const CHAVE_HISTORICO = 'Planora_historico';
const chaveHistorico = () => CHAVE_HISTORICO + sufixoWs();
const LIMITE_HISTORICO = 20;
let estadosHistorico = [];
let indiceHistorico = -1;
let aplicandoHistorico = false;
let erroPersistenciaHistorico = false;

function notificarHistorico() {
    window.dispatchEvent(new Event('Planora-historico-atualizado'));
}
function persistirHistorico() {
    try {
        sessionStorage.setItem(chaveHistorico(), JSON.stringify({
            estados: estadosHistorico,
            indice: indiceHistorico
        }));
        erroPersistenciaHistorico = false;
    } catch (erro) {
        if (!erroPersistenciaHistorico) {
            console.error('Não foi possível persistir o histórico de alterações nesta sessão:', erro);
            setStatus('Histórico temporário: limite de armazenamento atingido');
        }
        erroPersistenciaHistorico = true;
    }
}
function inicializarHistorico() {
    const estadoAtual = localStorage.getItem(chaveDb()) || '[]';
    try {
        const salvo = JSON.parse(sessionStorage.getItem(chaveHistorico()) || 'null');
        if (salvo && Array.isArray(salvo.estados)
            && salvo.estados.every(estado => typeof estado === 'string')
            && Number.isInteger(salvo.indice)
            && salvo.indice >= 0
            && salvo.indice < salvo.estados.length
            && salvo.estados[salvo.indice] === estadoAtual) {
            const inicio = Math.max(0, salvo.estados.length - LIMITE_HISTORICO);
            estadosHistorico = salvo.estados.slice(inicio);
            indiceHistorico = salvo.indice - inicio;
            if (indiceHistorico < 0) indiceHistorico = -1;
        }
    } catch (erro) {
        console.error('Não foi possível carregar o histórico de alterações:', erro);
    }
    if (indiceHistorico < 0) {
        estadosHistorico = [estadoAtual];
        indiceHistorico = 0;
        persistirHistorico();
    }
    notificarHistorico();
}
function registrarEstadoHistorico(estadoAnterior, estadoNovo) {
    if (estadoAnterior === estadoNovo) return;
    if (estadosHistorico[indiceHistorico] !== estadoAnterior) {
        estadosHistorico = [estadoAnterior];
        indiceHistorico = 0;
    }
    estadosHistorico = estadosHistorico.slice(0, indiceHistorico + 1);
    estadosHistorico.push(estadoNovo);
    if (estadosHistorico.length > LIMITE_HISTORICO) estadosHistorico.shift();
    indiceHistorico = estadosHistorico.length - 1;
    persistirHistorico();
    notificarHistorico();
}
function sincronizarHistoricoComBanco() {
    const estadoAtual = localStorage.getItem(chaveDb()) || '[]';
    if (estadosHistorico[indiceHistorico] === estadoAtual) return;
    estadosHistorico = [estadoAtual];
    indiceHistorico = 0;
    persistirHistorico();
    notificarHistorico();
}
function atualizarHistoricoSemAcao(dados) {
    if (indiceHistorico < 0 || indiceHistorico >= estadosHistorico.length) return;
    estadosHistorico[indiceHistorico] = JSON.stringify(dados);
    persistirHistorico();
}
function aplicarEstadoHistorico(indice) {
    if (workspaceAtual && workspaceAtual.role === 'viewer') return;
    const dados = JSON.parse(estadosHistorico[indice]);
    aplicandoHistorico = true;
    try {
        salvarBancoDeDados(dados);
    } finally {
        aplicandoHistorico = false;
    }
    indiceHistorico = indice;
    persistirHistorico();
    window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', { detail: { dados } }));
    notificarHistorico();
}
window.Planora_Historico = {
    podeDesfazer: () => !(workspaceAtual && workspaceAtual.role === 'viewer') && indiceHistorico > 0,
    podeRefazer: () => !(workspaceAtual && workspaceAtual.role === 'viewer') &&
        indiceHistorico >= 0 && indiceHistorico < estadosHistorico.length - 1,
    desfazer: () => {
        if (!(workspaceAtual && workspaceAtual.role === 'viewer') && indiceHistorico > 0) aplicarEstadoHistorico(indiceHistorico - 1);
    },
    refazer: () => {
        if (!(workspaceAtual && workspaceAtual.role === 'viewer') &&
            indiceHistorico >= 0 && indiceHistorico < estadosHistorico.length - 1) aplicarEstadoHistorico(indiceHistorico + 1);
    }
};
function salvarBancoDeDados(dados) {
    if (workspaceAtual && workspaceAtual.role === 'viewer') {
        setStatus('Modo visualizador: alterações desativadas');
        if (!avisoVisualizadorExibido) {
            avisoVisualizadorExibido = true;
            alert('Este workspace está em modo de visualização. Suas alterações não foram salvas.');
        }
        window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', {
            detail: { dados: lerBancoDeDados() }
        }));
        return false;
    }
    prepararRegistrosLocais(dados);
    const estadoAnterior = localStorage.getItem(chaveDb()) || '[]';
    const estadoNovo = JSON.stringify(dados);
    localStorage.setItem(chaveDb(), estadoNovo);
    if (!aplicandoHistorico) registrarEstadoHistorico(estadoAnterior, estadoNovo);
    if (nuvemAtiva()) { localStorage.setItem(chavePend(), '1'); seq++; }
    agendarEnvio();
    return true;
}
function setStatus(t) {
    ultimoStatus = t;
    const e = document.getElementById('status-nuvem');
    if (!e) return;
    const estado = t.includes('Salvando') ? 'salvando'
        : t.includes('Erro') || t.includes('Conflito') || t.includes('limite') ? 'erro'
            : t.includes('Salvo na nuvem') ? 'salvo'
                : 'local';
    const descricoes = {
        salvando: 'Salvando alterações',
        salvo: 'Tudo salvo na nuvem',
        erro: t,
        local: t
    };
    const icone = estado === 'salvando'
        ? '<svg class="status-nuvem-spinner" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="32 12"></circle></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.2A4.5 4.5 0 0 0 18.5 7.4 6.5 6.5 0 0 0 6 9a4 4 0 0 0 .5 8H19"></path></svg>';
    e.dataset.estado = estado;
    e.title = descricoes[estado];
    e.setAttribute('aria-label', descricoes[estado]);
    e.innerHTML = icone;
}

