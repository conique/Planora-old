/* Planora — dados no Supabase por workspace, com cache local (localStorage + IndexedDB)
   Cada conta pode ter vários workspaces (Planora_workspaces); os dados de cada um ficam em
   Planora_workspace_data, e o cache local usa chaves com o id do workspace.
   A tabela legada Planora_dados foi aposentada e não é mais consultada pelo aplicativo. */
const CHAVE_DB = 'Planora_db';
const CHAVE_PREFERENCIAS = 'Planora_preferencias';
const BUCKET = 'midias';
const PEND_FLAG = 'Planora_pendente';
const TABELA_WS = 'Planora_workspaces';
const TABELA_DADOS = 'Planora_workspace_data';
const TABELA_REGISTROS = 'Planora_workspace_records';
const TABELA_MEMBROS = 'Planora_workspace_members';
const SESSAO_WS = 'Planora_ws_ativo';           // sessionStorage: workspace aberto nesta aba
const ULTIMO_WS = 'Planora_ultimo_ws';          // localStorage: último workspace usado (por usuário)
const CHAVE_BASE_REGISTROS = 'Planora_registros_base';
let seq = 0;
let sb = null, usuario = null, versao = null, timer = null, fila = Promise.resolve(), ultimoStatus = '';
let workspaceAtual = null, listaWorkspaces = [];
let usarRegistrosIndividuais = false;
let preferenciasSincronizadas = null;
let dadosWorkspacePersistidos = null;
let pessoasWorkspace = new Map();
let avisoVisualizadorExibido = false;

/* Sem workspace ativo (modo local), as chaves continuam as de sempre. */
const sufixoWs = () => workspaceAtual ? ':' + workspaceAtual.id : '';
const chaveDb = () => CHAVE_DB + sufixoWs();
const chavePreferencias = () => CHAVE_PREFERENCIAS + sufixoWs();
const chavePend = () => PEND_FLAG + sufixoWs();
const chaveBaseRegistros = () => CHAVE_BASE_REGISTROS + sufixoWs();
const nuvemAtiva = () => !!(sb && usuario && workspaceAtual);

function lerBancoDeDados() { return JSON.parse(localStorage.getItem(chaveDb())) || []; }
function lerBaseRegistros() {
    const texto = localStorage.getItem(chaveBaseRegistros());
    if (texto === null) return null;
    const registros = JSON.parse(texto);
    if (!Array.isArray(registros)) throw new Error('A base local de registros do workspace está inválida.');
    return registros;
}
function salvarBaseRegistros(registros) {
    if (!Array.isArray(registros)) throw new TypeError('A base de registros precisa ser uma lista.');
    localStorage.setItem(chaveBaseRegistros(), JSON.stringify(registros));
}
function definirPessoasWorkspace(pessoas) {
    pessoasWorkspace = new Map((Array.isArray(pessoas) ? pessoas : [])
        .filter(pessoa => pessoa && pessoa.user_id)
        .map(pessoa => [pessoa.user_id, pessoa.display_name || 'Membro']));
}
function nomePessoaWorkspace(userId) {
    return userId ? pessoasWorkspace.get(userId) || 'Membro' : '';
}
function aplicarAutoriaRegistro(registro, metadados) {
    registro._createdBy = metadados.created_by || null;
    registro._createdAt = metadados.created_at || null;
    registro._updatedBy = metadados.updated_by || null;
    registro._updatedAt = metadados.updated_at || null;
    registro._createdByName = nomePessoaWorkspace(registro._createdBy);
    registro._updatedByName = nomePessoaWorkspace(registro._updatedBy);
}
function aplicarMetadadosRegistrosLocal(registros) {
    const porId = new Map((Array.isArray(registros) ? registros : [])
        .map(registro => [registro.record_id, registro]));
    const itens = lerBancoDeDados();
    itens.forEach(item => {
        const metadadosItem = porId.get(item._recordId);
        if (metadadosItem) aplicarAutoriaRegistro(item, metadadosItem);
        (Array.isArray(item.cards) ? item.cards : []).forEach(card => {
            const metadadosCard = porId.get(card._recordId);
            if (metadadosCard) aplicarAutoriaRegistro(card, metadadosCard);
        });
    });
    localStorage.setItem(chaveDb(), JSON.stringify(itens));
    if (typeof atualizarHistoricoSemAcao === 'function') atualizarHistoricoSemAcao(itens);
    window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', {
        detail: { dados: itens }
    }));
}
function prepararRegistrosLocais(itens) {
    if (!Array.isArray(itens)) throw new TypeError('Os registros do workspace precisam ser uma lista.');
    const base = new Map((lerBaseRegistros() || []).map(registro => [registro.record_id, registro]));
    const ids = new Set();
    const preparar = registro => {
        if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
            throw new TypeError('Foi encontrado um registro inválido no workspace.');
        }
        if (!registro._recordId) registro._recordId = crypto.randomUUID();
        if (ids.has(registro._recordId)) throw new Error('Há IDs de registro duplicados no workspace.');
        ids.add(registro._recordId);
        const salvo = base.get(registro._recordId);
        if (salvo) registro._revision = Number(salvo.revision);
        else delete registro._revision;
    };
    itens.forEach(item => {
        preparar(item);
        if (Array.isArray(item.cards)) item.cards.forEach(preparar);
    });
    return itens;
}
function payloadRegistro(registro, itemWorkspace) {
    return Object.fromEntries(Object.entries(registro).filter(([chave]) =>
        !['_recordId', '_revision', '_createdBy', '_createdAt', '_updatedBy', '_updatedAt',
            '_createdByName', '_updatedByName'].includes(chave) &&
        !(itemWorkspace && chave === 'cards')));
}
function registrosParaPersistir(itens) {
    prepararRegistrosLocais(itens);
    const pastas = new Map(itens.filter(item => item.tipo === 'pasta' && item.id)
        .map(item => [String(item.id), item._recordId]));
    const registros = [];
    itens.forEach((item, position) => {
        registros.push({
            record_id: item._recordId,
            parent_record_id: item.pai ? pastas.get(String(item.pai)) || null : null,
            kind: item.tipo === 'pasta' ? 'folder' : 'project',
            position,
            payload: payloadRegistro(item, true)
        });
        (Array.isArray(item.cards) ? item.cards : []).forEach((card, cardPosition) => {
            registros.push({
                record_id: card._recordId,
                parent_record_id: item._recordId,
                kind: 'card',
                position: cardPosition,
                payload: payloadRegistro(card, false)
            });
        });
    });
    return registros;
}
function itensDeRegistros(registros) {
    if (!Array.isArray(registros)) throw new TypeError('Os registros recebidos do workspace precisam ser uma lista.');
    const itens = [];
    const porId = new Map();
    registros.filter(registro => registro.kind !== 'card')
        .sort((a, b) => a.position - b.position)
        .forEach(registro => {
            const payload = registro.payload && typeof registro.payload === 'object' && !Array.isArray(registro.payload)
                ? { ...registro.payload }
                : {};
            payload._recordId = registro.record_id;
            payload._revision = Number(registro.revision);
            aplicarAutoriaRegistro(payload, registro);
            if (registro.kind === 'folder') payload.tipo = 'pasta';
            else if (registro.kind !== 'project') throw new Error(`Tipo de registro desconhecido: ${registro.kind}`);
            if (registro.kind === 'project') payload.cards = [];
            itens.push(payload);
            porId.set(registro.record_id, payload);
        });
    registros.filter(registro => registro.kind === 'card')
        .sort((a, b) => a.position - b.position)
        .forEach(registro => {
            const projeto = porId.get(registro.parent_record_id);
            if (!projeto) throw new Error(`O card ${registro.record_id} não possui um projeto válido.`);
            const payload = registro.payload && typeof registro.payload === 'object' && !Array.isArray(registro.payload)
                ? { ...registro.payload }
                : {};
            payload._recordId = registro.record_id;
            payload._revision = Number(registro.revision);
            aplicarAutoriaRegistro(payload, registro);
            projeto.cards.push(payload);
        });
    return itens;
}
function instalarRegistrosWorkspace(registros) {
    const itens = itensDeRegistros(registros);
    localStorage.setItem(chaveDb(), JSON.stringify(itens));
    salvarBaseRegistros(registros);
    sincronizarHistoricoComBanco();
    window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', {
        detail: { dados: itens }
    }));
    return itens;
}
function instalarItensLegadosWorkspace(dados) {
    const itens = Array.isArray(dados) ? dados : dados && Array.isArray(dados.itens) ? dados.itens : null;
    if (!itens) throw new Error('Os dados legados do workspace têm um formato inválido.');
    salvarBaseRegistros([]);
    prepararRegistrosLocais(itens);
    localStorage.setItem(chaveDb(), JSON.stringify(itens));
    sincronizarHistoricoComBanco();
    window.dispatchEvent(new CustomEvent('Planora-dados-restaurados', {
        detail: { dados: itens }
    }));
    return itens;
}
function instalarPreferenciasWorkspace(dados) {
    const preferencias = dados && !Array.isArray(dados) && dados.preferencias &&
        typeof dados.preferencias === 'object' && !Array.isArray(dados.preferencias)
        ? dados.preferencias
        : {};
    localStorage.setItem(chavePreferencias(), JSON.stringify(preferencias));
    preferenciasSincronizadas = JSON.parse(JSON.stringify(preferencias));
    return preferencias;
}
function lerPreferenciasBanco() {
    try {
        const preferencias = JSON.parse(localStorage.getItem(chavePreferencias()));
        if (preferencias && typeof preferencias === 'object' && !Array.isArray(preferencias)) return preferencias;
    } catch (e) { /* migra preferências antigas */ }

    const preferencias = {};
    const visao = localStorage.getItem('Planora_visao');
    if (visao === 'tabela' || visao === 'kanban') preferencias.visao = visao;
    try {
        const ordenacao = JSON.parse(localStorage.getItem('Planora_ordenacao'));
        if (ordenacao && ['nome', 'rotulo', 'area', 'prazo'].includes(ordenacao.tipo)) {
            preferencias.ordenacao = { tipo: ordenacao.tipo, dir: ordenacao.dir === -1 ? -1 : 1 };
        }
    } catch (e) { /* sem ordenação antiga salva */ }
    try {
        const colunas = JSON.parse(localStorage.getItem('Planora_kanban_colunas'));
        if (Array.isArray(colunas)) preferencias.kanbanColunas = colunas;
    } catch (e) { /* sem ordem antiga de colunas salva */ }
    localStorage.setItem(chavePreferencias(), JSON.stringify(preferencias));
    return preferencias;
}
function salvarPreferenciasBanco(preferencias) {
    if (!preferencias || typeof preferencias !== 'object' || Array.isArray(preferencias)) {
        throw new TypeError('As preferências precisam ser um objeto.');
    }
    localStorage.setItem(chavePreferencias(), JSON.stringify(preferencias));
    if (workspaceAtual && workspaceAtual.role === 'viewer') return false;
    salvarBancoDeDados(lerBancoDeDados());
    return true;
}
function carregarDadosPersistidos(dados) {
    const preferenciasLocais = lerPreferenciasBanco();
    if (Array.isArray(dados)) {
        localStorage.setItem(chaveDb(), JSON.stringify(dados));
        localStorage.setItem(chavePreferencias(), JSON.stringify(preferenciasLocais));
        sincronizarHistoricoComBanco();
        return true;
    }
    if (!dados || typeof dados !== 'object' || !Array.isArray(dados.itens)) {
        throw new Error('Os dados recebidos da nuvem têm um formato inválido.');
    }
    localStorage.setItem(chaveDb(), JSON.stringify(dados.itens));
    localStorage.setItem(chavePreferencias(), JSON.stringify(
        dados.preferencias && typeof dados.preferencias === 'object' && !Array.isArray(dados.preferencias)
            ? dados.preferencias
            : {}
    ));
    sincronizarHistoricoComBanco();
    return false;
}
function montarDadosPersistidos() {
    return { itens: lerBancoDeDados(), preferencias: lerPreferenciasBanco() };
}
