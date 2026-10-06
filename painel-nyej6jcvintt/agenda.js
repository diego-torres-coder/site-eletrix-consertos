"use strict";
/* ================= armazenamento local ================= */
const KEY = "eletrix-agenda-v1";
const DEFAULTS = { max: 3, folga: [6], lastBackup: 0 };   // 0=domingo ... 6=sábado
let state = { items: [], settings: { ...DEFAULTS } };
let storageOk = true;

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(raw){ const s = JSON.parse(raw); state.items = Array.isArray(s.items) ? s.items : []; state.settings = { ...DEFAULTS, ...(s.settings||{}) }; }
  }catch(e){ storageOk = false; }
}
function persist(){
  try{ localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch(e){ storageOk = false; toast("Não consegui salvar neste navegador. Faça um backup agora."); }
}
// pede ao navegador para não apagar os dados quando faltar espaço
if(navigator.storage && navigator.storage.persist){ navigator.storage.persist().catch(()=>{}); }

/* ================= utilidades ================= */
const PER = {manha:"Manhã", tarde:"Tarde"};
const APARELHOS = ["Micro-ondas","Máquina de lavar","Lava e seca","Lava-louças","Cooktop","Air fryer","Outro"];
const SERVICOS = ["Conserto","Orçamento","Higienização","Conversão de gás","Máquina barulhenta","Retorno (garantia)"];
const MARCAS = ["Brastemp","Consul","Electrolux","LG","Samsung","Midea","Panasonic","Philco","Mondial","Britânia"];
const SITUACOES = {agendado:"Agendado", confirmado:"Confirmado", concluido:"Concluído", cancelado:"Cancelado"};
const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DOW_LONG = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const pad = n => String(n).padStart(2,"0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fromIso = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (s,n) => { const d = fromIso(s); d.setDate(d.getDate()+n); return iso(d); };
let TODAY = iso(new Date());
const fmtLong = s => fromIso(s).toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"});
const fmtShort = s => `${DOW[fromIso(s).getDay()]} ${s.slice(8)}/${s.slice(5,7)}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const isFolga = s => state.settings.folga.includes(fromIso(s).getDay());
const MAX = () => state.settings.max;

let sel = TODAY;
let weekStart = startOfWeek(TODAY);
function startOfWeek(s){ const d = fromIso(s); d.setDate(d.getDate()-d.getDay()); return iso(d); } // semana começa no domingo

const active = a => a.status !== "cancelado";
const inSlot = (date, per) => state.items.filter(a => a.data===date && a.periodo===per);
const used = (date, per, exceptId) => inSlot(date,per).filter(a => active(a) && a.id!==exceptId).length;
const sortSlot = arr => arr.slice().sort((a,b)=>(a.hora||"99").localeCompare(b.hora||"99",undefined,{numeric:true}) || (a.criado||0)-(b.criado||0));
const plural = (n, s, p) => `${n} ${n===1?s:p}`;

/* ================= tela ================= */
function render(){
  TODAY = iso(new Date());
  $("todayLbl").textContent = "Agenda · " + fmtLong(TODAY);

  // faixa da semana (sem os dias de folga)
  const days = [];
  for(let i=0;i<7;i++){ const d = addDays(weekStart,i); if(!isFolga(d)) days.push(d); }
  $("strip").style.gridTemplateColumns = `repeat(${days.length},1fr)`;
  $("strip").innerHTML = days.map(d => {
    const dt = fromIso(d);
    const cls = ["day", d===sel?"sel":"", d===TODAY?"today":"", d<TODAY?"past":""].join(" ");
    const row = (per,l) => { const u = used(d,per); return `<span class="pip-row ${u>=MAX()?"full":""}"><b>${l}</b>${Array.from({length:MAX()},(_,k)=>`<i class="pip ${k<u?"on":""}"></i>`).join("")}</span>`; };
    return `<button class="${cls}" data-d="${d}" aria-label="${fmtLong(d)}"><span class="dw">${DOW[dt.getDay()]}</span><span class="dn">${dt.getDate()}</span><span class="pips">${row("manha","M")}${row("tarde","T")}</span></button>`;
  }).join("");
  const m1 = fromIso(weekStart).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const m2 = fromIso(addDays(weekStart,6)).toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const cap = t => t.charAt(0).toUpperCase()+t.slice(1);
  $("monthLbl").textContent = cap(m1===m2 ? m1 : `${m1.split(" ")[0]} / ${m2}`);

  // dia escolhido
  $("dayTitle").textContent = (sel===TODAY ? "Hoje · " : "") + fmtLong(sel);
  if(isFolga(sel)){
    $("daySum").textContent = "";
    $("periods").innerHTML = `<div class="folga">Dia de folga. Bom descanso!</div>`;
  } else {
    const tot = used(sel,"manha")+used(sel,"tarde");
    const done = state.items.filter(a=>a.data===sel && a.status==="concluido").length;
    const free = 2*MAX()-tot;
    $("daySum").textContent = tot===0 ? "Nenhum atendimento marcado." :
      `${plural(tot,"atendimento","atendimentos")} · ${plural(done,"concluído","concluídos")} · ${plural(Math.max(0,free),"vaga livre","vagas livres")}`;
    let p = "";
    for(const per of ["manha","tarde"]){
      const list = sortSlot(inSlot(sel,per).filter(active));
      const canc = inSlot(sel,per).filter(a=>!active(a));
      const u = list.length;
      const chip = u>=MAX() ? `<span class="chip full">Lotado</span>` : u===0 ? `<span class="chip free">${plural(MAX(),"vaga","vagas")}</span>` : `<span class="chip part">${u}/${MAX()} · ${plural(MAX()-u,"vaga","vagas")}</span>`;
      p += `<section class="period"><div class="ph"><h3>${PER[per]}</h3>${chip}</div><div class="slots">`;
      list.forEach((a,i)=>{
        p += `<button class="appt ${a.status==="concluido"?"done":""}" data-id="${a.id}">
          <span class="n">${a.status==="concluido"?"✓":i+1}</span>
          <span>
            <span class="who">${esc(a.cliente)} ${a.hora?`<span class="tag time">${esc(a.hora)}</span>`:""} ${a.status==="concluido"?`<span class="tag done">Concluído</span>`:a.status==="confirmado"?`<span class="tag conf">Confirmado</span>`:""}</span>
            <span class="what">${esc([a.servico,a.aparelho,a.marca].filter(Boolean).join(" · "))}</span>
            ${a.endereco?`<span class="where">${esc(a.endereco)}</span>`:""}
          </span></button>`;
      });
      for(let k=u;k<MAX();k++) p += `<button class="empty" data-new="${per}"><span class="plus">+</span>Vaga ${k+1} livre · encaixar atendimento</button>`;
      p += `</div>`;
      if(canc.length) p += `<div class="cancelled">Cancelados: ${canc.map(a=>`<button data-id="${a.id}">${esc(a.cliente)}</button>`).join(", ")}</div>`;
      p += `</section>`;
    }
    $("periods").innerHTML = p;
  }

  // próximas vagas
  let f = "", count = 0;
  for(let i=0;i<90 && count<8;i++){
    const d = addDays(TODAY,i);
    if(isFolga(d)) continue;
    for(const per of ["manha","tarde"]){
      const u = used(d,per);
      if(u<MAX() && count<8){ count++; f += `<button class="free-item" data-d="${d}" data-per="${per}"><span><span class="d">${d===TODAY?"Hoje":fmtShort(d)}</span> <span class="p">· ${PER[per]}</span></span><span class="chip ${u===0?"free":"part"}">${plural(MAX()-u,"vaga","vagas")}</span></button>`; }
    }
  }
  $("freeList").innerHTML = f || `<div class="folga">Nenhuma vaga nos próximos 90 dias.</div>`;

  backupNotice();
}

function backupNotice(){
  const n = state.items.length, last = state.settings.lastBackup;
  const days = last ? Math.floor((Date.now()-last)/86400000) : null;
  let msg = "";
  if(!storageOk) msg = "Este navegador não está guardando os dados. Faça backup e abra a agenda pelo endereço do site.";
  else if(n>0 && (days===null || days>=7)) msg = days===null ? "Você ainda não fez nenhum backup da agenda." : `Último backup há ${days} dias.`;
  $("notice").hidden = !msg; $("noticeTxt").textContent = msg;
}

/* ================= folhas (formulário, detalhe, ajustes) ================= */
function closeSheet(){ $("sheetRoot").innerHTML = ""; }
function openSheet(html){
  $("sheetRoot").innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $("scrim").addEventListener("click", e => { if(e.target.id==="scrim") closeSheet(); });
}
const dl = (arr) => `<datalist id="${arr.id}">${arr.v.map(x=>`<option value="${esc(x)}">`).join("")}</datalist>`;

function openForm(a, pre={}){
  const v = a ? {...a} : {data: pre.data||sel, periodo: pre.periodo||"", status:"agendado"};
  const opt = (arr,cur) => `<option value="">—</option>` + arr.map(x=>`<option ${x===cur?"selected":""}>${esc(x)}</option>`).join("") + (cur && !arr.includes(cur) ? `<option selected>${esc(cur)}</option>` : "");
  openSheet(`
    <h3>${a?"Editar atendimento":"Novo atendimento"}<button class="x" data-close aria-label="Fechar">×</button></h3>
    <form id="frm" novalidate autocomplete="off">
      <div class="f"><label for="fData">Data</label><input type="date" id="fData" value="${v.data}"></div>
      <div class="f"><span class="lbl">Período</span><div class="seg" id="fPer"></div></div>
      <div class="f"><label for="fCli">Cliente</label><input id="fCli" value="${esc(v.cliente)}" placeholder="Nome do cliente"></div>
      <div class="row2">
        <div class="f"><label for="fTel">WhatsApp</label><input id="fTel" type="tel" inputmode="tel" value="${esc(v.telefone)}" placeholder="(11) 9…"></div>
        <div class="f"><label for="fHora">Horário</label><input id="fHora" value="${esc(v.hora)}" placeholder="ex.: 9h30"></div>
      </div>
      <div class="f"><label for="fEnd">Endereço / bairro</label><input id="fEnd" value="${esc(v.endereco)}" placeholder="Rua, nº, bairro"></div>
      <div class="row2">
        <div class="f"><label for="fAp">Aparelho</label><select id="fAp">${opt(APARELHOS,v.aparelho)}</select></div>
        <div class="f"><label for="fMar">Marca</label><input id="fMar" list="lMarcas" value="${esc(v.marca)}" placeholder="Brastemp, LG…">${dl({id:"lMarcas",v:MARCAS})}</div>
      </div>
      <div class="row2">
        <div class="f"><label for="fSrv">Serviço</label><select id="fSrv">${opt(SERVICOS,v.servico)}</select></div>
        <div class="f"><label for="fVal">Valor (R$)</label><input id="fVal" inputmode="decimal" value="${esc(v.valor)}" placeholder="opcional"></div>
      </div>
      <div class="f"><label for="fObs">Defeito / observações</label><textarea id="fObs" placeholder="O que o cliente relatou">${esc(v.obs)}</textarea></div>
      <div class="err" id="fErr"></div>
      <div class="actions"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Salvar</button></div>
    </form>`);
  let per = v.periodo;
  const paintPer = () => {
    const d = $("fData").value;
    if(d && isFolga(d)){ $("fPer").innerHTML = `<div class="err gridspan">${DOW_LONG[fromIso(d).getDay()]} é dia de folga. Escolha outra data.</div>`; per=""; return; }
    if(per && d && used(d,per,a&&a.id)>=MAX()) per = "";
    if(!per && d){ per = ["manha","tarde"].find(p=>used(d,p,a&&a.id)<MAX()) || ""; }
    $("fPer").innerHTML = ["manha","tarde"].map(p=>{
      const u = d ? used(d,p,a&&a.id) : 0, full = u>=MAX();
      return `<button type="button" data-p="${p}" class="${per===p?"on":""}" ${full?"disabled":""}>${PER[p]}<small>${full?"Lotado":plural(MAX()-u,"vaga","vagas")}</small></button>`;
    }).join("");
  };
  paintPer();
  $("fData").addEventListener("change", paintPer);
  $("fPer").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if(b && !b.disabled){ per = b.dataset.p; paintPer(); } });
  $("frm").addEventListener("submit", e => {
    e.preventDefault();
    const d = $("fData").value, cli = $("fCli").value.trim();
    if(!d) return $("fErr").textContent = "Escolha a data.";
    if(isFolga(d)) return $("fErr").textContent = "Esse dia é folga. Escolha outra data.";
    if(!per) return $("fErr").textContent = "Manhã e tarde estão lotadas nesse dia. Escolha outra data.";
    if(!cli) return $("fErr").textContent = "Coloque o nome do cliente.";
    if(used(d,per,a&&a.id)>=MAX()) return $("fErr").textContent = `${PER[per]} desse dia já tem ${MAX()} atendimentos.`;
    const body = { data:d, periodo:per, cliente:cli, telefone:$("fTel").value.trim(), hora:$("fHora").value.trim(),
      endereco:$("fEnd").value.trim(), aparelho:$("fAp").value, marca:$("fMar").value.trim(), servico:$("fSrv").value,
      valor:$("fVal").value.trim(), obs:$("fObs").value.trim(), status: a ? a.status : "agendado", criado: a ? (a.criado||Date.now()) : Date.now() };
    if(a) state.items = state.items.map(x => x.id===a.id ? {id:a.id, ...body} : x);
    else state.items.push({id:uid(), ...body});
    persist(); closeSheet(); sel = d; weekStart = startOfWeek(d); render();
    toast(a ? "Atendimento atualizado" : `Agendado: ${fmtShort(d)} · ${PER[per]}`);
  });
}

function openDetail(a){
  const digits = (a.telefone||"").replace(/\D/g,"");
  const wa = digits ? `https://wa.me/${digits.length<=11?"55":""}${digits}` : "";
  const map = a.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.endereco)}` : "";
  openSheet(`
    <div class="detail">
    <h3>${esc(a.cliente)}<button class="x" data-close aria-label="Fechar">×</button></h3>
    <dl>
      <dt>Quando</dt><dd>${fmtShort(a.data)} · ${PER[a.periodo]}${a.hora?" · "+esc(a.hora):""}</dd>
      ${a.servico?`<dt>Serviço</dt><dd>${esc(a.servico)}</dd>`:""}
      ${a.aparelho||a.marca?`<dt>Aparelho</dt><dd>${esc([a.aparelho,a.marca].filter(Boolean).join(" · "))}</dd>`:""}
      ${a.telefone?`<dt>Telefone</dt><dd>${esc(a.telefone)}</dd>`:""}
      ${a.endereco?`<dt>Endereço</dt><dd>${esc(a.endereco)}</dd>`:""}
      ${a.valor?`<dt>Valor</dt><dd>R$ ${esc(a.valor)}</dd>`:""}
      ${a.obs?`<dt>Obs.</dt><dd>${esc(a.obs)}</dd>`:""}
      <dt>Situação</dt><dd>${SITUACOES[a.status]||"Agendado"}</dd>
    </dl>
    <div class="contact">
      ${wa?`<a class="btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}
      ${digits?`<a class="btn" href="tel:${digits}">Ligar</a>`:""}
      ${map?`<a class="btn" href="${map}" target="_blank" rel="noopener">Mapa</a>`:""}
    </div>
    <div class="actions">
      ${a.status==="agendado"?`<button class="btn" data-st="confirmado">Cliente confirmou</button>`:""}
      ${a.status!=="concluido"?`<button class="btn ok" data-st="concluido">Marcar concluído</button>`:`<button class="btn" data-st="agendado">Reabrir</button>`}
    </div>
    <div class="actions">
      <button class="btn" data-edit>Editar / remarcar</button>
      ${a.status!=="cancelado"?`<button class="btn danger" data-st="cancelado">Cancelar</button>`:`<button class="btn" data-st="agendado">Reativar</button>`}
    </div>
    <div class="actions"><button class="btn danger" data-del>Excluir de vez</button></div>
    <div id="delBox"></div>
    </div>`);
  $("sheetRoot").querySelector(".sheet").addEventListener("click", e => {
    const st = e.target.closest("[data-st]");
    if(st){
      const ns = st.dataset.st;
      if(ns==="agendado" && a.status==="cancelado" && used(a.data,a.periodo,a.id)>=MAX()){ toast(`${PER[a.periodo]} já está lotado. Use Editar para remarcar.`); return; }
      state.items = state.items.map(x => x.id===a.id ? {...x, status:ns} : x);
      persist(); closeSheet(); render();
      toast({concluido:"Concluído ✓", cancelado:"Cancelado. A vaga foi liberada.", confirmado:"Marcado como confirmado", agendado:"Reaberto"}[ns]);
    }
    if(e.target.closest("[data-edit]")) openForm(a);
    if(e.target.closest("[data-del]")) $("delBox").innerHTML = `<div class="confirm"><p>Excluir de vez o atendimento de ${esc(a.cliente)}?</p><div class="actions"><button class="btn" data-nodel>Não</button><button class="btn danger" data-yesdel>Sim, excluir</button></div></div>`;
    if(e.target.closest("[data-nodel]")) $("delBox").innerHTML = "";
    if(e.target.closest("[data-yesdel]")){ state.items = state.items.filter(x=>x.id!==a.id); persist(); closeSheet(); render(); toast("Excluído"); }
  });
}

function openSettings(){
  const s = state.settings;
  openSheet(`
    <h3>Ajustes<button class="x" data-close aria-label="Fechar">×</button></h3>
    <div class="row2">
      <div class="f"><label for="sMax">Máx. por período</label><input id="sMax" type="number" min="1" max="8" inputmode="numeric" value="${s.max}"></div>
      <div class="f"><label for="sFolga">Dia de folga</label><select id="sFolga">${DOW_LONG.map((d,i)=>`<option value="${i}" ${s.folga[0]===i?"selected":""}>${d}</option>`).join("")}<option value="-1" ${!s.folga.length?"selected":""}>Nenhum</option></select></div>
    </div>
    <div class="actions"><button class="btn primary" id="sSave">Salvar ajustes</button></div>

    <div class="set-sec">
      <div class="lbl">Backup</div>
      <p>Os atendimentos ficam guardados só neste celular, dentro do navegador. Faça backup toda semana e guarde o arquivo no Google Drive ou mande para você no WhatsApp.</p>
      <div class="actions">
        <button class="btn primary" id="bExport">Baixar backup</button>
        <button class="btn" id="bImport">Restaurar backup</button>
      </div>
      <div class="actions"><button class="btn" id="bCsv">Exportar planilha (CSV para Excel)</button></div>
      <div id="impBox"></div>
      <p class="mt12">${plural(state.items.length,"atendimento salvo","atendimentos salvos")}${s.lastBackup?` · último backup em ${new Date(s.lastBackup).toLocaleDateString("pt-BR")}`:" · nenhum backup ainda"}.</p>
    </div>`);
  $("sSave").onclick = () => {
    const m = Math.max(1, Math.min(8, parseInt($("sMax").value,10) || 3));
    const fg = parseInt($("sFolga").value,10);
    state.settings.max = m; state.settings.folga = fg>=0 ? [fg] : [];
    persist(); closeSheet(); if(isFolga(sel)) sel = TODAY; render(); toast("Ajustes salvos");
  };
  $("bExport").onclick = exportJson;
  $("bCsv").onclick = exportCsv;
  $("bImport").onclick = () => $("importFile").click();
}

/* ================= backup ================= */
function download(name, text, type){
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}
function exportJson(){
  state.settings.lastBackup = Date.now(); persist();
  download(`agenda-eletrix-backup-${TODAY}.json`, JSON.stringify({app:"agenda-eletrix", versao:1, exportado:new Date().toISOString(), ...state}, null, 1), "application/json");
  closeSheet(); render(); toast("Backup baixado. Guarde o arquivo num lugar seguro.");
}
function exportCsv(){
  const cols = [["data","Data"],["periodo","Período"],["hora","Horário"],["cliente","Cliente"],["telefone","Telefone"],["endereco","Endereço"],["aparelho","Aparelho"],["marca","Marca"],["servico","Serviço"],["valor","Valor (R$)"],["status","Situação"],["obs","Observações"]];
  const cell = v => `"${String(v??"").replace(/"/g,'""')}"`;
  const rows = state.items.slice().sort((a,b)=>a.data.localeCompare(b.data)||a.periodo.localeCompare(b.periodo)).map(a => cols.map(([k])=>{
    if(k==="data") return cell(a.data.split("-").reverse().join("/"));
    if(k==="periodo") return cell(PER[a.periodo]);
    if(k==="status") return cell(SITUACOES[a.status]||"Agendado");
    return cell(a[k]);
  }).join(";"));
  download(`agenda-eletrix-${TODAY}.csv`, "﻿" + [cols.map(c=>cell(c[1])).join(";"), ...rows].join("\r\n"), "text/csv");
  toast("Planilha exportada");
}
$("importFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if(!file) return;
  let data;
  try{ data = JSON.parse(await file.text()); }catch{ toast("Esse arquivo não é um backup da agenda."); return; }
  if(!data || data.app!=="agenda-eletrix" || !Array.isArray(data.items)){ toast("Esse arquivo não é um backup da agenda."); return; }
  if(!$("impBox")) openSettings();
  $("impBox").innerHTML = `<div class="confirm"><p>O backup tem ${plural(data.items.length,"atendimento","atendimentos")}. O que fazer com o que já está aqui (${state.items.length})?</p>
    <div class="actions"><button class="btn" id="iMerge">Juntar os dois</button><button class="btn danger" id="iReplace">Substituir tudo</button></div></div>`;
  $("iMerge").onclick = () => { const ids = new Set(state.items.map(x=>x.id)); state.items.push(...data.items.filter(x=>!ids.has(x.id))); done(); };
  $("iReplace").onclick = () => { state.items = data.items; if(data.settings) state.settings = {...DEFAULTS, ...data.settings}; done(); };
  function done(){ persist(); closeSheet(); render(); toast("Backup restaurado"); }
});

let tt;
function toast(msg){ const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(()=>t.hidden=true, 2800); }

/* ================= eventos ================= */
document.addEventListener("click", e => {
  if(e.target.closest("[data-close]")) return closeSheet();
  if(e.target.closest(".sheet")) return;
  const day = e.target.closest(".day"); if(day){ sel = day.dataset.d; render(); return; }
  const ap = e.target.closest("[data-id]"); if(ap){ const a = state.items.find(x=>x.id===ap.dataset.id); if(a) openDetail(a); return; }
  const nw = e.target.closest("[data-new]"); if(nw){ openForm(null,{data:sel, periodo:nw.dataset.new}); return; }
  const fr = e.target.closest(".free-item"); if(fr){ sel = fr.dataset.d; weekStart = startOfWeek(sel); render(); openForm(null,{data:fr.dataset.d, periodo:fr.dataset.per}); }
});
$("prev").onclick = () => { weekStart = addDays(weekStart,-7); sel = addDays(sel,-7); if(isFolga(sel)) sel = addDays(sel,-1); render(); };
$("next").onclick = () => { weekStart = addDays(weekStart,7); sel = addDays(sel,7); if(isFolga(sel)) sel = addDays(sel,-1); render(); };
$("goToday").onclick = () => { sel = TODAY; weekStart = startOfWeek(TODAY); render(); };
$("openSet").onclick = openSettings;
$("noticeBtn").onclick = exportJson;
$("fab").onclick = () => { let d = sel<TODAY ? TODAY : sel; if(isFolga(d)) d = addDays(d,1); openForm(null,{data:d}); };
document.addEventListener("keydown", e => { if(e.key==="Escape") closeSheet(); });
// ao voltar para o app num outro dia, atualiza o "hoje"
document.addEventListener("visibilitychange", () => { if(!document.hidden && iso(new Date())!==TODAY && !$("sheetRoot").innerHTML){ sel = iso(new Date()); weekStart = startOfWeek(sel); render(); } });
// outra aba mudou os dados
window.addEventListener("storage", e => { if(e.key===KEY){ load(); render(); } });

load();
render();

/* funciona sem internet quando aberto pelo endereço do site */
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
