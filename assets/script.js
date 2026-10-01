/* ==========================================================
   SkyCheck — protótipo mobile (sem backend: tudo em memória)
   ========================================================== */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const digits = s => (s || '').replace(/\D/g, '');

/* ---------- Dados e estado ---------- */
const COMPANIES = [
  { id: 'SK', name: 'Skyline Air',          sub: 'Voos nacionais' },
  { id: 'AB', name: 'Aerobrasil',           sub: 'Voos nacionais e Mercosul' },
  { id: 'NB', name: 'Nimbus Linhas Aéreas', sub: 'Voos nacionais' },
  { id: 'HZ', name: 'Horizonte Air',        sub: 'Voos regionais' },
];
const AIRPORTS = [
  ['GRU', 'São Paulo'], ['SDU', 'Rio de Janeiro'], ['BSB', 'Brasília'], ['CNF', 'Belo Horizonte'],
  ['SSA', 'Salvador'], ['REC', 'Recife'], ['POA', 'Porto Alegre'], ['CWB', 'Curitiba'],
];
const STATUS = ['Reserva confirmada', 'Check-in disponível', 'Check-in realizado', 'Bagagem despachada', 'Embarque', 'Voo concluído'];
const CHECKIN_STEPS = ['Companhia', 'Reserva', 'Voo', 'Assento', 'Bagagem', 'Confirmar'];
const BAG_FEE = 90;
const TAX = 42.9;

const S = {
  guest: false,
  user: { name: 'Maria Souza Lima', cpf: '123.456.789-09', email: 'maria.lima@email.com', phone: '(32) 99999-0000', born: '1998-04-12', addr: 'Rua das Flores, 120 — Juiz de Fora/MG' },
  ci: { code: '', seat: '14A', seatFee: 0, bag: null, bagCount: 1, done: false },
  flight: { id: 'SK', company: 'Skyline Air', no: 'SK 4321', from: ['GRU', 'São Paulo'], to: ['SDU', 'Rio de Janeiro'], date: '15 out 2026', time: '14:35', gate: 'B12', status: 'Confirmada' },
  statusIdx: 1,
  gateAlerted: false,
  saved: false,
  search: null,
  pick: null,
  pay: 'credit',
  tripSeg: 'next',
  verifyTarget: null,
  reservas: [{ code: 'ABC123', route: 'GRU → SDU', date: '15 out 2026', co: 'Skyline Air', total: 'R$ 432,90', status: 'Confirmada' }],
};

/* ---------- Visão (valores para data-bind) ---------- */
function view() {
  const f = S.flight, c = S.ci, u = S.user;
  const bagFee = c.bag === 'yes' ? Math.max(0, c.bagCount - 1) * BAG_FEE : 0;
  const bagText = c.bag === 'yes' ? `${c.bagCount} ${c.bagCount > 1 ? 'malas' : 'mala'} para despachar`
                : c.bag === 'no' ? 'Somente bagagem de mão' : 'Não informada';
  const bagStatus = c.bag === 'yes' ? (S.statusIdx >= 3 ? 'Despachada' : 'Aguardando despacho no balcão')
                  : c.bag === 'no' ? 'Sem bagagem para despachar' : 'Nenhuma bagagem registrada';
  return {
    userName: u.name, userFirst: u.name.split(' ')[0], userEmail: u.email, userCpf: u.cpf, userPhone: u.phone,
    userBorn: u.born.split('-').reverse().join('/'), userAddr: u.addr,
    coName: f.company, code: c.code || 'ABC123', flightNo: f.no, flightStatus: f.status,
    fromCode: f.from[0], fromCity: f.from[1], toCode: f.to[0], toCity: f.to[1],
    dateTime: `${f.date} · ${f.time}`, gate: f.gate,
    statusChip: STATUS[S.statusIdx], checkinText: c.done ? 'Realizado' : 'Pendente',
    seat: c.seat || '—', seatFeeTitle: `Assento ${c.seat}`,
    seatFeeText: c.seatFee ? `Taxa adicional de ${brl(c.seatFee)}` : 'Sem cobrança adicional',
    seatFeeMoney: brl(c.seatFee), bagFeeMoney: brl(bagFee), totalMoney: brl(c.seatFee + bagFee),
    bagText, bagStatus,
  };
}
function bind() {
  const v = view();
  $$('[data-bind]').forEach(el => { el.textContent = v[el.dataset.bind] ?? ''; });
}

/* ---------- Toast ---------- */
const TOAST_ICON = { info: 'i-info', success: 'i-check-circle', warning: 'i-alert', error: 'i-x' };
function toast(type, title, msg = '', ms = 4200) {
  const box = $('#toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  el.innerHTML = `<span class="t-ico"><svg class="i sm"><use href="#${TOAST_ICON[type]}"/></svg></span>
    <div><b></b><p></p></div><span class="bar" style="animation-duration:${ms}ms"></span>`;
  $('b', el).textContent = title;
  $('p', el).textContent = msg;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', close);
  setTimeout(close, ms);
  box.appendChild(el);
}

/* ---------- Navegação ---------- */
let stack = [];
function show(id, opts = {}) {
  const next = document.getElementById(id);
  if (!next) return;
  const cur = $('.screen.active');
  if (cur && cur !== next) {
    cur.classList.remove('active');
    if (opts.reset) stack = [...opts.reset];
    else if (!opts.replace) stack.push(cur.id);
  }
  next.classList.add('active');
  const c = $('.content', next);
  if (c) c.scrollTop = 0;
  $('#tabbar').hidden = !next.dataset.tab || S.guest;
  $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === next.dataset.tab));
  $$('#index button[data-id]').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  closeSheets();
  bind();
  (onEnter[id] || (() => {}))();
}
function back() {
  const prev = stack.pop();
  if (prev) show(prev, { replace: true });
}

/* ---------- Sheets ---------- */
function openSheet(id) { $('#backdrop').classList.add('on'); $('#' + id).classList.add('on'); }
function closeSheets() { $('#backdrop').classList.remove('on'); $$('.sheet').forEach(s => s.classList.remove('on')); }

/* ---------- Render: componentes ---------- */
function renderStepper() {
  $$('.stepper[data-step]').forEach(el => {
    const n = +el.dataset.step;
    el.innerHTML = `<div class="label"><span>Etapa <b>${n}</b> de ${CHECKIN_STEPS.length}</span><span>${CHECKIN_STEPS[n - 1]}</span></div>
      <div class="bars">${CHECKIN_STEPS.map((_, i) => `<i class="${i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}"></i>`).join('')}</div>`;
  });
}

function renderCompanies() {
  $('#companies').innerHTML = COMPANIES.map(c => `
    <button class="big-option" data-company="${c.id}">
      <div class="ph fixed" style="--w:48;--h:48" data-size="48×48"></div>
      <span>${c.name}<small>${c.sub}</small></span>
      <svg class="i" style="margin-left:auto"><use href="#i-chevron"/></svg>
    </button>`).join('');
}

const seatFee = row => (row <= 4 ? 25 : row === 10 || row === 11 ? 35 : 0);
const isOccupied = (row, col) => (row * 7 + col * 3) % 5 === 0;
function renderSeats() {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  let html = letters.slice(0, 3).map(l => `<span class="cols">${l}</span>`).join('') + '<span></span>' + letters.slice(3).map(l => `<span class="cols">${l}</span>`).join('');
  for (let r = 1; r <= 20; r++) {
    const seat = (col) => {
      const id = r + letters[col], fee = seatFee(r);
      const cls = ['seat', fee ? 'fee' : '', isOccupied(r, col) ? 'occ' : '', S.ci.seat === id ? 'sel' : ''].join(' ');
      return `<button class="${cls}" data-seat="${id}" aria-label="Assento ${id}${fee ? ', taxa ' + brl(fee) : ''}">${id}</button>`;
    };
    html += [0, 1, 2].map(seat).join('') + `<span class="rownum">${r}</span>` + [3, 4, 5].map(seat).join('');
  }
  $('#seatmap').innerHTML = html;
}

function renderTimeline() {
  $('#status-timeline').innerHTML = STATUS.map((s, i) =>
    `<li class="${i < S.statusIdx ? 'done' : i === S.statusIdx ? 'now' : ''}">${s}</li>`).join('');
  const btn = $('#trip-primary');
  btn.textContent = S.ci.done ? 'Ver cartão de embarque' : 'Fazer check-in';
}

function renderTrips() {
  const next = `
    <button class="card" data-trip="current" style="text-align:left;width:100%">
      <div class="row"><b class="grow">${S.flight.from[0]} → ${S.flight.to[0]}</b><span class="chip">${STATUS[S.statusIdx]}</span></div>
      <div class="small muted" style="margin-top:6px">${S.flight.company} · ${S.flight.no} · ${S.flight.date} ${S.flight.time}</div>
      <div class="small muted">Reserva ${S.ci.code || 'ABC123'} · Assento ${S.ci.seat} · Check-in ${S.ci.done ? 'realizado' : 'pendente'}</div>
    </button>`;
  const past = [
    ['SDU → GRU', 'Skyline Air · SK 1188 · 02 set 2026', 'Reserva QWE456 · Assento 9C · Sem bagagem despachada'],
    ['GRU → SSA', 'Nimbus · NB 902 · 10 ago 2026', 'Reserva ZXC789 · Assento 21F · 1 mala despachada'],
  ].map(p => `<button class="card" data-trip="past" style="text-align:left;width:100%"><div class="row"><b class="grow">${p[0]}</b><span class="chip muted">Voo concluído</span></div><div class="small muted" style="margin-top:6px">${p[1]}</div><div class="small muted">${p[2]}</div></button>`).join('');
  $('#trip-list').innerHTML = S.tripSeg === 'next' ? next : past;
  $$('#trip-seg button').forEach(b => b.classList.toggle('on', b.dataset.seg === S.tripSeg));
}

function renderReservas() {
  $('#res-list').innerHTML = S.reservas.map(r => `
    <div class="card"><div class="row"><b class="grow">${r.route}</b><span class="chip ok">${r.status}</span></div>
      <div class="small muted" style="margin-top:6px">${r.co} · ${r.date}</div>
      <div class="kv" style="margin-top:6px"><span>Localizador</span><span>${r.code}</span></div>
      <div class="kv"><span>Total</span><span>${r.total}</span></div></div>`).join('');
  $('#cards-list').innerHTML = S.saved
    ? `<div class="card row"><div class="ph fixed" style="--w:48;--h:48" data-size="48×48"></div><div class="grow"><b>${S.flight.from[0]} → ${S.flight.to[0]} · ${S.flight.no}</b><div class="small muted">Assento ${S.ci.seat} · ${S.flight.date}</div></div><button class="btn btn-ghost btn-sm" data-action="showSavedCard">Abrir</button></div>`
    : `<div class="card flat center muted small">Nenhum cartão salvo ainda. Faça o check-in para gerar o seu.</div>`;
}

function renderSearchOptions() {
  const opts = AIRPORTS.map(a => `<option value="${a[0]}">${a[1]} (${a[0]})</option>`).join('');
  $('#sr-from').innerHTML = opts; $('#sr-to').innerHTML = opts;
  $('#sr-from').value = 'GRU'; $('#sr-to').value = 'SDU';
  $('#cc-inst').innerHTML = [1, 2, 3, 4, 5, 6].map(n => `<option>${n}x sem juros</option>`).join('');
}

function renderIndex() {
  const groups = {};
  $$('.screen').forEach(s => (groups[s.dataset.group] ||= []).push(s));
  $('#index').innerHTML = `<h2>SkyCheck</h2><small>Protótipo navegável · clique para saltar entre telas</small>` +
    Object.entries(groups).map(([g, list]) => `<h3>${g}</h3>` + list.map(s => `<button data-id="${s.id}">${s.dataset.title}</button>`).join('')).join('') +
    `<button class="reset" id="reset">↺ Reiniciar protótipo</button>`;
}

/* ---------- Ao entrar em cada tela ---------- */
const onEnter = {
  's-ci-reserva': () => { $('#ci-cpf').value = S.user.cpf; },
  's-ci-assento': () => renderSeats(),
  's-ci-bagagem': () => syncBag(),
  's-ci-resumo': () => { $('#resumo-bag-alert').hidden = S.ci.bag !== 'yes'; },
  's-ci-cartao': () => { $('#cartao-bag-alert').hidden = S.ci.bag !== 'yes'; },
  's-viagens': () => renderTrips(),
  's-viagem': () => {
    renderTimeline();
    if (!S.gateAlerted) {
      S.gateAlerted = true;
      S.flight.gate = 'B14';
      bind();
      setTimeout(() => toast('warning', 'Portão alterado', 'Seu embarque agora será no portão B14.', 6000), 500);
    }
  },
  's-busca': () => { $('#guest-alert').hidden = !S.guest; },
  's-voos': () => { if (!S.search) S.search = defaultSearch(); renderFlights(); },
  's-pagamento': () => renderPayment(),
  's-reservas': () => renderReservas(),
  's-perfil-edit': () => {
    $('#pf-nome').value = S.user.name; $('#pf-cpf').value = S.user.cpf; $('#pf-email').value = S.user.email;
    $('#pf-tel').value = S.user.phone; $('#pf-addr').value = S.user.addr;
    ['pf-cpf', 'pf-doc'].forEach(id => { $('#' + id).readOnly = true; });
  },
  's-home': () => {},
};

/* ---------- Check-in: apoio ---------- */
function syncBag() {
  $$('#bag-options .big-option').forEach(b => b.classList.toggle('on', b.dataset.bag === S.ci.bag));
  $('#bag-yes').hidden = S.ci.bag !== 'yes';
  $('#bag-no').hidden = S.ci.bag !== 'no';
  $('#bag-count').textContent = S.ci.bagCount;
  $('#bag-continue').disabled = !S.ci.bag;
}

function resetCheckin() {
  Object.assign(S.ci, { code: '', seat: '14A', seatFee: 0, bag: null, bagCount: 1 });
}

/* ---------- Compra: apoio ---------- */
function defaultSearch() { return { from: 'GRU', to: 'SDU', d1: '2026-10-20', d2: '2026-10-27', pax: 1, round: true }; }
const fmtDay = iso => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const airportName = code => AIRPORTS.find(a => a[0] === code)?.[1] || code;

function flightsFor(sr) {
  const base = 250 + ((sr.from.charCodeAt(0) + sr.to.charCodeAt(1)) % 9) * 35;
  return [
    ['06:10', '07:25', COMPANIES[0], 1], ['09:40', '10:55', COMPANIES[1], 1.15],
    ['13:15', '14:30', COMPANIES[2], 0.95], ['18:50', '20:05', COMPANIES[3], 1.3],
  ].map(([dep, arr, co, m], i) => ({ dep, arr, co, price: Math.round(base * m), no: `${co.id} ${1200 + i * 137}`, dur: '1h15' }));
}
function renderFlights() {
  const sr = S.search;
  $('#voos-title').textContent = `${sr.from} → ${sr.to}`;
  $('#voos-sub').textContent = `${fmtDay(sr.d1)}${sr.round ? ' – ' + fmtDay(sr.d2) : ''} · ${sr.pax} passageiro${sr.pax > 1 ? 's' : ''} · ${sr.round ? 'ida e volta' : 'somente ida'}`;
  $('#voos-list').innerHTML = flightsFor(sr).map((f, i) => `
    <button class="flight-card" data-flight="${i}">
      <div class="row"><div class="ph fixed" style="--w:40;--h:40" data-size="40×40"></div><b class="grow">${f.co.name}</b><span class="small muted">${f.no}</span></div>
      <div class="times"><b>${f.dep}</b><span class="line"></span><b>${f.arr}</b></div>
      <div class="row"><span class="small muted grow">Duração ${f.dur} · direto</span><span class="price">${brl(f.price)}</span></div>
    </button>`).join('');
}
function renderPayment() {
  const sr = S.search || defaultSearch();
  const f = S.pick || flightsFor(sr)[0];
  S.pick = f;
  const legs = sr.round ? 2 : 1;
  const base = f.price * sr.pax * legs, tax = TAX * sr.pax * legs;
  S.total = base + tax;
  $('#pg-flight').textContent = `${f.co.name} · ${f.no}`;
  $('#pg-pax').textContent = `${sr.pax} pax`;
  $('#pg-route').textContent = `${airportName(sr.from)} → ${airportName(sr.to)} · ${fmtDay(sr.d1)}${sr.round ? ' / ' + fmtDay(sr.d2) : ''}`;
  $('#pg-base').textContent = brl(base); $('#pg-tax').textContent = brl(tax);
  $('#pg-total').textContent = brl(S.total); $('#pg-btn-total').textContent = brl(S.total);
  setPay(S.pay);
}
function setPay(p) {
  S.pay = p;
  $$('#pay-seg button').forEach(b => b.classList.toggle('on', b.dataset.pay === p));
  $('#pay-card').hidden = !(p === 'credit' || p === 'debit');
  $('#cc-inst-wrap').hidden = p !== 'credit';
  $('#pay-pix').hidden = p !== 'pix';
  $('#pay-wallet').hidden = p !== 'wallet';
}

/* ---------- Chat ---------- */
function addBubble(text, who) {
  const log = $('#chat-log');
  const b = document.createElement('div');
  b.className = `bubble ${who}`; b.textContent = text;
  log.appendChild(b); log.scrollTop = log.scrollHeight;
}
function botReply(q) {
  q = q.toLowerCase();
  if (q.includes('bagag')) return 'Cada passageiro pode despachar 1 mala de até 23 kg sem custo. Malas extras custam R$ 90,00.';
  if (q.includes('assento')) return 'Você pode trocar o assento durante o check-in. Alguns lugares têm taxa adicional.';
  if (q.includes('check')) return 'O check-in abre 48h antes do voo. Toque em "Fazer Check-in" na tela inicial.';
  return 'Recebi sua mensagem! Um atendente vai continuar a conversa em instantes.';
}

const INFO = {
  checkin:  ['Como fazer check-in', ['Toque em “Fazer Check-in” na tela inicial.', 'Escolha a companhia e informe o código da reserva.', 'Confirme o voo, escolha o assento e informe sua bagagem.', 'Receba o cartão de embarque digital.']],
  bagagem:  ['Orientações sobre bagagem', ['Bagagem de mão: 1 item de até 10 kg.', 'Despachada: 1 mala de até 23 kg inclusa.', 'Despache no balcão da companhia até 60 min antes do voo.', 'Não transporte líquidos acima de 100 ml na cabine.']],
  docs:     ['Documentos necessários', ['Voos nacionais: RG, CNH ou passaporte válidos.', 'Menores de idade: documento e autorização dos responsáveis.', 'Leve o cartão de embarque no celular ou impresso.']],
  embarque: ['Informações de embarque', ['O embarque abre 40 min antes do horário do voo.', 'O portão fecha 15 min antes da partida.', 'Acompanhe possíveis mudanças de portão pelos avisos do app.']],
};

/* ---------- Ações ---------- */
const actions = {
  guest() { S.guest = true; show('s-busca'); toast('info', 'Modo visitante', 'Você pode consultar voos, mas precisa entrar para comprar.'); },
  logout() { toast('info', 'Sessão encerrada', 'Até logo!'); show('s-login', { reset: [] }); },

  startCheckin() {
    if (S.ci.done) {
      toast('info', 'Check-in já realizado', 'Abrindo seu cartão de embarque.');
      return show('s-ci-cartao', { reset: ['s-home'] });
    }
    resetCheckin();
    show('s-ci-companhia');
  },
  confirmFlight() { toast('success', 'Voo confirmado', `${S.flight.no} · ${S.flight.from[0]} → ${S.flight.to[0]}`); show('s-ci-assento'); },
  wrongFlight() { toast('warning', 'Voo não confere', 'Revise o código da reserva e tente novamente.'); back(); },
  confirmSeat() {
    toast('success', `Assento ${S.ci.seat} confirmado`, S.ci.seatFee ? `Taxa de ${brl(S.ci.seatFee)} será cobrada.` : 'Sem custo adicional.');
    show('s-ci-bagagem');
  },
  confirmBag() { show('s-ci-resumo'); },
  confirmCheckin(el) {
    el.disabled = true; el.textContent = 'Confirmando…';
    const total = S.ci.seatFee + (S.ci.bag === 'yes' ? Math.max(0, S.ci.bagCount - 1) * BAG_FEE : 0);
    if (total) toast('info', 'Cobrança de taxas', `${brl(total)} serão cobrados no cartão cadastrado.`);
    setTimeout(() => {
      el.disabled = false; el.innerHTML = '<svg class="i"><use href="#i-check"/></svg> Confirmar check-in';
      S.ci.done = true; S.statusIdx = Math.max(S.statusIdx, 2);
      show('s-ci-cartao', { reset: ['s-home'] });
      toast('success', 'Check-in concluído!', 'Seu cartão de embarque está pronto. Boa viagem!');
      if (S.ci.bag === 'yes') setTimeout(() => toast('warning', 'Atenção: bagagem para despachar', 'Após finalizar o check-in, dirija-se ao balcão ou ponto de despacho de bagagem da sua companhia aérea antes de seguir para o embarque.', 9000), 900);
    }, 1200);
  },
  saveCard() { S.saved = true; toast('success', 'Cartão salvo', 'Disponível em Passagens e Reservas.'); },
  emailCard() { toast('info', 'Cartão enviado', `Enviamos para ${S.user.email}.`); },
  afterCard() { S.ci.bag === 'yes' ? show('s-ci-despacho') : show('s-home', { reset: [] }); },
  finishFlow() { toast('info', 'Bom embarque!', 'Siga para o despacho, depois raio-X e portão.'); show('s-home', { reset: [] }); },
  showSavedCard() { show('s-ci-cartao'); },

  fakeScan() {
    closeSheets();
    $('#ci-code').value = 'ABC123';
    toast('success', 'QR Code lido', 'Reserva ABC123 identificada.');
  },

  tripPrimary() { S.ci.done ? show('s-ci-cartao') : actions.startCheckin(); },
  nextStatus() {
    if (S.statusIdx >= STATUS.length - 1) return toast('info', 'Viagem concluída', 'Não há novos status.');
    S.statusIdx++;
    if (S.statusIdx >= 2) S.ci.done = true;
    if (S.statusIdx >= 3 && S.ci.bag == null) S.ci.bag = 'no';
    renderTimeline(); bind();
    const msg = {
      2: ['success', 'Check-in realizado', 'Seu cartão de embarque está disponível.'],
      3: ['success', 'Bagagem despachada', 'Sua bagagem foi recebida pela companhia.'],
      4: ['warning', 'Embarque iniciado', `Dirija-se ao portão ${S.flight.gate}.`],
      5: ['success', 'Voo concluído', 'Esperamos que tenha feito uma boa viagem!'],
    }[S.statusIdx];
    toast(...msg);
  },

  swap() { const a = $('#sr-from'), b = $('#sr-to'); [a.value, b.value] = [b.value, a.value]; },
  copyPix() { toast('success', 'Código PIX copiado', 'Cole no app do seu banco para pagar.'); },
  pay(el) {
    if (S.pay === 'credit' || S.pay === 'debit') {
      if (digits($('#cc-num').value).length < 13 || !$('#cc-name').value.trim() || $('#cc-exp').value.length < 5 || $('#cc-cvv').value.length < 3)
        return toast('error', 'Dados do cartão incompletos', 'Confira número, nome, validade e CVV.');
    }
    el.disabled = true;
    toast('info', S.pay === 'pix' ? 'Aguardando PIX…' : 'Processando pagamento…', 'Não feche o aplicativo.', 1600);
    setTimeout(() => {
      el.disabled = false;
      const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const sr = S.search || defaultSearch(), f = S.pick;
      S.reservas.unshift({ code, route: `${sr.from} → ${sr.to}`, date: fmtDay(sr.d1) + '/2026', co: f.co.name, total: brl(S.total), status: 'Confirmada' });
      $('#cf-code').textContent = code; $('#cf-flight').textContent = `${f.co.name} · ${f.no}`;
      $('#cf-route').textContent = `${airportName(sr.from)} → ${airportName(sr.to)}`; $('#cf-total').textContent = brl(S.total);
      show('s-confirmacao', { reset: ['s-home'] });
      toast('success', 'Pagamento aprovado', `Reserva ${code} confirmada.`);
      S.pick = null;
    }, 1700);
  },

  openChat() { show('s-chat'); toast('info', 'Atendimento 24 horas', 'Um atendente responde em poucos minutos.'); },

  verifyCode() {
    if ($('#vf-code').value !== '123456') return toast('error', 'Código inválido', 'Confira o código enviado ao seu e-mail.');
    const t = $('#' + S.verifyTarget);
    t.readOnly = false; closeSheets(); $('#vf-code').value = '';
    toast('success', 'Identidade validada', 'Agora você pode alterar este dado.'); t.focus();
  },
};

/* ---------- Formulários ---------- */
const submits = {
  login(f) {
    if (!f.user.value.trim() || !f.pass.value) return toast('error', 'Preencha os campos', 'Informe seu CPF/e-mail e a senha.');
    S.guest = false;
    show('s-home', { reset: [] });
    toast('success', `Bem-vindo, ${S.user.name.split(' ')[0]}!`, 'Login realizado com sucesso.');
    setTimeout(() => toast('info', 'Check-in disponível', `O voo ${S.flight.no} de ${S.flight.date} já aceita check-in.`, 5500), 1400);
  },
  register(f) {
    const missing = $$('[required]', f).filter(i => !i.value.trim());
    if (missing.length) { missing[0].focus(); return toast('error', 'Campos obrigatórios', `Preencha ${missing.length} campo(s) para continuar.`); }
    if (digits(f.cpf.value).length !== 11) return toast('error', 'CPF inválido', 'Digite os 11 números do CPF.');
    if (!/\S+@\S+\.\S+/.test(f.email.value)) return toast('error', 'E-mail inválido', 'Confira o endereço digitado.');
    if (f.senha.value.length < 6) return toast('warning', 'Senha curta', 'Use pelo menos 6 caracteres.');
    Object.assign(S.user, { name: f.nome.value, cpf: f.cpf.value, email: f.email.value, phone: f.tel.value, born: f.nasc.value, addr: `${f.rua.value}, ${f.num.value} — ${f.cidade.value}/${f.uf.value.toUpperCase()}` });
    S.guest = false;
    show('s-home', { reset: [] });
    toast('success', 'Cadastro criado!', 'Seus dados foram salvos com segurança.');
  },
  findReservation(f) {
    const code = f.code.value.trim().toUpperCase();
    if (!code) return toast('warning', 'Informe o código', 'Digite o localizador ou leia o QR Code.');
    if (code.length !== 6) return toast('error', 'Código inválido', 'O localizador tem 6 caracteres.');
    if (digits(f.cpf.value).length < 11) return toast('warning', 'Documento incompleto', 'Informe o CPF do passageiro.');
    if (code === 'ERRO00') return toast('error', 'Reserva não encontrada', 'Confira o código e a companhia escolhida.');
    S.ci.code = code;
    show('s-ci-validando');
    setTimeout(() => {
      if (!$('#s-ci-validando').classList.contains('active')) return;
      show('s-ci-voo', { replace: true });
      toast('success', 'Passageiro validado', 'Reserva encontrada. Confira os dados do voo.');
    }, 1800);
  },
  search(f) {
    const sr = { from: f.from.value, to: f.to.value, d1: f.d1.value, d2: f.d2.value, pax: +$('#sr-pax').textContent, round: !$('#sr-oneway').checked };
    if (sr.from === sr.to) return toast('error', 'Trecho inválido', 'Origem e destino precisam ser diferentes.');
    if (!sr.d1) return toast('warning', 'Escolha a data de ida', '');
    if (sr.round && (!sr.d2 || sr.d2 < sr.d1)) return toast('warning', 'Data de volta inválida', 'A volta deve ser depois da ida.');
    S.search = sr; S.pick = null;
    show('s-voos');
  },
  saveProfile(f) {
    if (!f.nome.value.trim()) return toast('error', 'Nome obrigatório', 'Informe seu nome completo.');
    if (!/\S+@\S+\.\S+/.test(f.email.value)) return toast('error', 'E-mail inválido', 'Confira o endereço digitado.');
    Object.assign(S.user, { name: f.nome.value, email: f.email.value, phone: f.tel.value, addr: f.addr.value, cpf: $('#pf-cpf').value });
    toast('success', 'Dados atualizados', 'Suas alterações foram salvas.');
    back();
  },
  sendChat() {
    const i = $('#chat-input'), q = i.value.trim();
    if (!q) return;
    addBubble(q, 'out'); i.value = '';
    setTimeout(() => addBubble(botReply(q), 'in'), 900);
  },
};

/* ---------- Máscaras ---------- */
const masks = {
  cpf: v => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  phone: v => digits(v).slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2'),
  cep: v => digits(v).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  card: v => digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '),
  exp: v => digits(v).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2'),
};

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-action]'))) return actions[el.dataset.action]?.(el, e);
  if ((el = t.closest('[data-tab-go]'))) return show(el.dataset.tabGo, { reset: [] });
  if ((el = t.closest('[data-go]'))) return show(el.dataset.go);
  if (t.closest('[data-back]')) return back();
  if ((el = t.closest('[data-toast]'))) { const [ty, ti, m] = el.dataset.toast.split('|'); return toast(ty, ti, m); }
  if ((el = t.closest('[data-sheet]'))) return openSheet(el.dataset.sheet);
  if (t.closest('[data-close-sheet]') || t.id === 'backdrop') return closeSheets();
  if ((el = t.closest('[data-company]'))) {
    const c = COMPANIES.find(x => x.id === el.dataset.company);
    Object.assign(S.flight, { id: c.id, company: c.name, no: `${c.id} 4321` });
    return show('s-ci-reserva');
  }
  if ((el = t.closest('[data-seat]'))) {
    const id = el.dataset.seat, row = parseInt(id, 10);
    S.ci.seat = id; S.ci.seatFee = seatFee(row);
    renderSeats(); bind();
    if (S.ci.seatFee) toast('warning', 'Assento com taxa', `${id}${row === 10 || row === 11 ? ' (saída de emergência)' : ' (fileiras à frente)'}: adicional de ${brl(S.ci.seatFee)}.`);
    return;
  }
  if ((el = t.closest('[data-bag]'))) {
    S.ci.bag = el.dataset.bag; syncBag(); bind();
    if (S.ci.bag === 'yes') toast('warning', 'Você tem bagagem para despachar', 'Dirija-se ao balcão da companhia após o check-in.', 5500);
    return;
  }
  if ((el = t.closest('[data-bagstep]'))) {
    S.ci.bagCount = Math.min(3, Math.max(1, S.ci.bagCount + +el.dataset.bagstep));
    syncBag(); bind();
    if (S.ci.bagCount > 1) toast('info', 'Mala adicional', `Cada mala extra custa ${brl(BAG_FEE)}.`);
    return;
  }
  if ((el = t.closest('[data-paxstep]'))) {
    const o = $('#sr-pax'); o.textContent = Math.min(9, Math.max(1, +o.textContent + +el.dataset.paxstep)); return;
  }
  if ((el = t.closest('[data-pay]'))) return setPay(el.dataset.pay);
  if ((el = t.closest('[data-seg]'))) { S.tripSeg = el.dataset.seg; return renderTrips(); }
  if ((el = t.closest('[data-trip]'))) {
    return el.dataset.trip === 'current' ? show('s-viagem') : toast('info', 'Viagem concluída', 'Este voo já foi realizado.');
  }
  if ((el = t.closest('[data-flight]'))) {
    const f = flightsFor(S.search)[+el.dataset.flight];
    if (S.guest) {
      toast('warning', 'Cadastro necessário', 'Entre ou crie uma conta para concluir a compra.');
      return setTimeout(() => show('s-login', { reset: [] }), 1200);
    }
    S.pick = f; return show('s-pagamento');
  }
  if ((el = t.closest('[data-verify]'))) {
    S.verifyTarget = el.dataset.verify;
    toast('warning', 'Validação necessária', 'Por segurança, alterar este dado exige nova validação.');
    return openSheet('sheet-verify');
  }
  if ((el = t.closest('[data-info]'))) {
    const [title, lines] = INFO[el.dataset.info];
    $('#info-title').textContent = title;
    $('#info-body').innerHTML = lines.map(l => `<div class="alert"><svg class="i"><use href="#i-info"/></svg><span>${l}</span></div>`).join('');
    return openSheet('sheet-info');
  }
  if ((el = t.closest('#index button[data-id]'))) {
    S.guest = false;
    return show(el.dataset.id, { reset: [] });
  }
  if (t.closest('#reset')) return location.reload();
});

document.addEventListener('submit', e => {
  const fn = submits[e.target.dataset.submit];
  if (!fn) return;
  e.preventDefault();
  fn(e.target);
});

document.addEventListener('input', e => {
  const m = e.target.dataset?.mask;
  if (m) e.target.value = masks[m](e.target.value);
});

$('#sr-oneway').addEventListener('change', e => { $('#sr-d2').disabled = e.target.checked; });

/* ---------- Início ---------- */
renderIndex();
renderStepper();
renderCompanies();
renderSearchOptions();
addBubble('Olá! Sou a assistente virtual do SkyCheck. Como posso ajudar?', 'in');
show('s-splash');
setTimeout(() => { if ($('#s-splash').classList.contains('active')) show('s-login', { reset: [] }); }, 1800);
