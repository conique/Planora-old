/* ---------- login ---------- */
function telaLogin() {
    return new Promise(res => {
        const o = document.createElement('div');
        o.className = 'lg-overlay lg-pagina';
        document.body.appendChild(o);
        document.documentElement.dataset.auth = 'login';
        const concluirLogin = res;
        res = sessao => { delete document.documentElement.dataset.auth; concluirLogin(sessao); };
        let modo = 'entrar', email = '', senha = '', nome = '';
        const esc = t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const q = s => o.querySelector(s);
        const msg = (t, ok) => { const m = q('.lg-msg'); m.textContent = t; m.className = 'lg-msg' + (ok ? ' ok' : ''); };
        const traduz = e => {
            const m = (e.message || '').toLowerCase();
            if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
            if (m.includes('rate limit') || e.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
            if (m.includes('password')) return 'A senha precisa ter no mínimo 6 caracteres.';
            if (m.includes('invalid') && m.includes('email')) return 'Digite um e-mail válido.';
            return 'Não foi possível concluir: ' + e.message;
        };
        const ocupado = (btn, on, txt) => { btn.disabled = on; if (txt) btn.textContent = txt; };
        const entrar = async (btn, txtBtn) => {
            ocupado(btn, true, 'Entrando...');
            const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
            ocupado(btn, false, txtBtn);
            if (error) {
                if ((error.message || '').toLowerCase().includes('not confirmed')) { modo = 'confirmar'; return desenhar('Seu e-mail ainda não foi confirmado. Abra o link que enviamos.'); }
                return msg(traduz(error));
            }
            o.remove(); res(data.session);
        };

        function desenhar(aviso) {
            if (modo === 'confirmar') {
                o.innerHTML = `<div class="lg-card">
                    <div class="lg-logo ok">✉</div><h2>Confira seu e-mail</h2>
                    <p class="lg-sub">Enviamos um link de confirmação para <strong>${esc(email)}</strong>.</p>
                    <ol class="lg-passos"><li>Abra o e-mail (olhe também o spam e a lixeira).</li><li>Clique no link de confirmação.</li><li>Volte aqui e toque em “Já confirmei”.</li></ol>
                    <p class="lg-msg" role="alert"></p>
                    <button class="lg-principal" id="lg-ja" type="button">Já confirmei, entrar</button>
                    <div class="lg-links"><button id="lg-reenviar" type="button">Reenviar e-mail</button><button id="lg-voltar" type="button">Voltar</button></div></div>`;
                if (aviso) msg(aviso);
                q('#lg-ja').onclick = () => entrar(q('#lg-ja'), 'Já confirmei, entrar');
                q('#lg-voltar').onclick = () => { modo = 'entrar'; desenhar(); };
                q('#lg-reenviar').onclick = async () => {
                    const b = q('#lg-reenviar');
                    b.disabled = true;
                    const { error } = await sb.auth.resend({ type: 'signup', email });
                    if (error) { b.disabled = false; return msg(traduz(error)); }
                    msg('E-mail reenviado. Confira sua caixa de entrada.', true);
                    let s = 60; const t = setInterval(() => { b.textContent = s > 0 ? `Reenviar em ${s--}s` : 'Reenviar e-mail'; if (s < 0) { clearInterval(t); b.disabled = false; } }, 1000);
                };
                return;
            }
            const criar = modo === 'criar', rot = criar ? 'Criar conta' : 'Entrar';
            o.innerHTML = `<div class="lg-card">
                <div class="lg-logo"><img src="assets/planora-logo.png" alt="Planora"></div>
                <h2>${criar ? 'Criar sua conta' : 'Bem-vindo de volta'}</h2>
                <p class="lg-sub">${criar ? 'Guarde seus projetos na nuvem e acesse de qualquer computador.' : 'Entre para acessar seus projetos em qualquer computador.'}</p>
                <div class="lg-abas"><button type="button" data-m="entrar" class="${criar ? '' : 'on'}">Entrar</button><button type="button" data-m="criar" class="${criar ? 'on' : ''}">Criar conta</button></div>
                ${criar ? `<label>Nome de exibição<input id="lg-nome" type="text" maxlength="80" autocomplete="name" placeholder="Seu nome" value="${esc(nome)}"></label>` : ''}
                <label>E-mail<input id="lg-email" type="email" autocomplete="username" placeholder="voce@empresa.com" value="${esc(email)}"></label>
                <label>Senha<input id="lg-senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}" placeholder="Mínimo 6 caracteres"></label>
                ${criar ? '<label>Confirmar senha<input id="lg-senha2" type="password" autocomplete="new-password" placeholder="Repita a senha"></label>' : ''}
                <p class="lg-msg" role="alert"></p>
                <button class="lg-principal" id="lg-ok" type="button">${rot}</button></div>`;
            if (aviso) msg(aviso, true);
            o.querySelectorAll('.lg-abas button').forEach(b => b.onclick = () => {
                email = q('#lg-email').value.trim();
                if (criar) nome = q('#lg-nome').value.trim();
                modo = b.dataset.m;
                desenhar();
            });
            const enviar = async () => {
                email = q('#lg-email').value.trim(); senha = q('#lg-senha').value;
                if (criar) nome = q('#lg-nome').value.trim().replace(/\s+/g, ' ').slice(0, 80);
                if (!email || !senha) return msg('Preencha e-mail e senha.');
                if (!criar) return entrar(q('#lg-ok'), rot);
                if (!nome) return msg('Informe seu nome para identificar a autoria dos cards.');
                if (senha.length < 6) return msg('A senha precisa ter no mínimo 6 caracteres.');
                if (senha !== q('#lg-senha2').value) return msg('As senhas não conferem.');
                const btn = q('#lg-ok'); ocupado(btn, true, 'Criando...');
                const { data, error } = await sb.auth.signUp({
                    email,
                    password: senha,
                    options: { data: { full_name: nome } }
                });
                ocupado(btn, false, rot);
                if (error) return msg(traduz(error));
                if (data.session) { o.remove(); return res(data.session); }
                if (data.user && data.user.identities && data.user.identities.length === 0) { modo = 'entrar'; return desenhar('Este e-mail já tem conta. Digite sua senha para entrar.'); }
                modo = 'confirmar'; desenhar();
            };
            q('#lg-ok').onclick = enviar;
            o.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); }));
            q(criar ? '#lg-nome' : email ? '#lg-senha' : '#lg-email').focus();
        }
        desenhar();
    });
}
/* ---------- limpeza local (sair da conta) ---------- */
function limparCacheLocal() {
    const bases = [CHAVE_DB, CHAVE_PREFERENCIAS, PEND_FLAG, CHAVE_BASE_REGISTROS];
    for (const k of Object.keys(localStorage)) {
        if (bases.some(b => k === b || k.startsWith(b + ':'))) localStorage.removeItem(k);
    }
    for (const k of Object.keys(sessionStorage)) {
        if (k === CHAVE_HISTORICO || k.startsWith(CHAVE_HISTORICO + ':') || k === SESSAO_WS) sessionStorage.removeItem(k);
    }
    localStorage.removeItem('Planora_visao');
    localStorage.removeItem('Planora_ordenacao');
    localStorage.removeItem('Planora_kanban_colunas');
}
/* Garante que nada pendente fique para trás antes de sair/trocar. Devolve true se está tudo na nuvem. */
async function garantirEnvioPendente() {
    clearTimeout(timer);
    await fila;
    if (!nuvemAtiva() || localStorage.getItem(chavePend()) !== '1') return true;
    const enviado = (await descarregarNuvem()) === true;
    return enviado && localStorage.getItem(chavePend()) !== '1';
}
function existeAlteracaoPendenteLocal() {
    return Object.keys(localStorage).some(chave =>
        (chave === PEND_FLAG || chave.startsWith(PEND_FLAG + ':')) &&
        localStorage.getItem(chave) === '1');
}
async function sairDaConta() {
    if (!sb || !usuario) {
        alert('A nuvem não está ativa, então não há conta para sair. Seus dados continuam salvos neste navegador.');
        return;
    }
    /* Só sai (e limpa o cache local) depois de confirmar que tudo foi para a nuvem. */
    if (!await garantirEnvioPendente() || existeAlteracaoPendenteLocal()) {
        alert('Há alterações locais que ainda não foram enviadas. Elas foram preservadas e você não foi desconectado. Volte ao workspace correspondente e sincronize ou faça backup antes de sair.');
        return;
    }
    await sb.auth.signOut();
    limparCacheLocal();
    location.reload();
}

