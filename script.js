import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = { databaseURL: "https://dashboard-fleury-default-rtdb.firebaseio.com" };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let cached = [];
let filtered = [];
let currentView = 'list';
let pendingColetaSelb = null;

// Escuta do Banco de Dados
onValue(ref(db, 'printers'), (snap) => { 
    cached = snap.val() ? Object.values(snap.val()) : []; 
    updateNotifications();
    applyFilter();
});

function updateNotifications() {
    const count = cached.filter(p => ((p.vaziosK||0) + (p.vaziosC||0) + (p.vaziosM||0) + (p.vaziosY||0)) > 0).length;
    const badge = document.getElementById('notif-badge');
    if(badge) {
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
    }
}

// Lógica de Filtro
const searchInput = document.getElementById('main_search');
if(searchInput) {
    searchInput.addEventListener('input', applyFilter);
}

function applyFilter() {
    const term = document.getElementById('main_search').value.toLowerCase();
    filtered = cached.filter(p => p.selb.toLowerCase().includes(term) || p.setor.toLowerCase().includes(term));
    render();
}

// Funções Globais (Anexadas ao window para acesso via onclick no HTML)
window.showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    const content = document.getElementById('toast-content');
    content.className = `flex items-center gap-3 px-8 py-4 rounded-full shadow-2xl font-black text-xs text-white uppercase tracking-widest min-w-[300px] justify-center ${type === 'success' ? 'bg-slate-900' : 'bg-red-600'}`;
    document.getElementById('toast-icon').className = `fas ${type === 'success' ? 'fa-check-circle text-emerald-400' : 'fa-trash'}`;
    document.getElementById('toast-msg').innerText = msg;
    toast.classList.remove('translate-y-24');
    setTimeout(() => toast.classList.add('translate-y-24'), 3000);
};

window.bar = (l, v, c) => `<div class="flex items-center gap-1 mb-1"><span class="text-[8px] font-black w-2 text-slate-400">${l}</span><div class="flex-grow bg-slate-100 h-1.5 rounded-full overflow-hidden"><div class="${c} h-full transition-all duration-500" style="width:${v||0}%"></div></div><span class="text-[8px] font-bold w-5 text-right text-slate-500">${v||0}%</span></div>`;

window.toggleEstoque = () => {
    const type = document.getElementById('m_type').value;
    const grid = document.getElementById('m_estoque_grid');
    if(type === 'COLOR') {
        grid.className = "grid grid-cols-4 gap-2";
        grid.innerHTML = `
            <input type="number" id="m_e_k" placeholder="k" class="border p-2 rounded-lg text-center font-bold text-xs">
            <input type="number" id="m_e_c" placeholder="C" class="border p-2 rounded-lg text-center font-bold text-xs text-cyan-600">
            <input type="number" id="m_e_m" placeholder="M" class="border p-2 rounded-lg text-center font-bold text-xs text-pink-600">
            <input type="number" id="m_e_y" placeholder="Y" class="border p-2 rounded-lg text-center font-bold text-xs text-amber-600">`;
    } else {
        grid.className = "grid grid-cols-1";
        grid.innerHTML = `<input type="number" id="m_e_k" placeholder="Estoque Inicial" class="border p-2 rounded-lg text-center font-bold text-xs">`;
    }
};

window.render = () => { currentView === 'list' ? renderList() : renderGrid(); };

function renderList() {
    document.getElementById('table-body').innerHTML = filtered.map(p => {
        const totalVazios = (p.vaziosK||0) + (p.vaziosC||0) + (p.vaziosM||0) + (p.vaziosY||0);
        const fmtCounter = new Intl.NumberFormat('pt-BR').format(p.counter || 0);
        return `<tr>
            <td class="p-5">
                <div class="flex flex-col items-center gap-1">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="h-1.5 w-1.5 rounded-full ${p.status==='Online'?'bg-green-500 animate-pulse':'bg-red-500'}"></span>
                        <span class="text-[8px] font-black ${p.status==='Online'?'text-slate-400':'text-red-500'} tracking-widest uppercase">${p.status}</span>
                    </div>
                    <div class="bg-slate-950 text-[9px] font-mono text-emerald-400 px-3 py-2.5 rounded-lg border border-slate-800 w-36 text-center leading-tight shadow-inner uppercase overflow-hidden whitespace-nowrap text-ellipsis" title="${p.message || 'Aguardando primeira coleta...'}">
                        ${p.message || 'AGUARDANDO...'}
                    </div>
                </div>
            </td>
            <td class="p-5"><div class="font-black text-slate-800 leading-none">${p.selb}</div><div class="text-[9px] font-bold text-slate-400 uppercase mt-1">${p.setor}</div></td>
            <td class="p-5 text-center"><span class="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-600">${fmtCounter}</span></td>
            <td class="p-5"><a href="http://${p.ip}" target="_blank" class="text-xs font-mono font-bold text-blue-500 hover:underline">${p.ip}</a></td>
            <td class="p-5 w-40">${window.bar('K',p.tonerK,'bg-slate-800')}${p.type==='COLOR'?window.bar('C',p.tonerC,'bg-cyan-500')+window.bar('M',p.tonerM,'bg-pink-500')+window.bar('Y',p.tonerY,'bg-yellow-400'):''}</td>
            <td class="p-5 text-center bg-emerald-50/20 font-bold text-[9px]">${p.estoqueK||0} PRETO${p.type === 'COLOR' ? `<br>${p.estoqueC||0} CIANO<br>${p.estoqueM||0} MAGENTA<br>${p.estoqueY||0} AMARELO` : ''}</td>
            <td class="p-5 text-center bg-amber-50/20 relative group">
                <div class="font-bold text-[10px] text-amber-700">${totalVazios} Un.</div>
                ${totalVazios > 0 ? `<button onclick="coletarVazios('${p.selb}')" title="Registrar Coleta / Dar Baixa" class="absolute right-2 top-1/2 -translate-y-1/2 bg-amber-600 hover:bg-amber-700 text-white w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg flex items-center justify-center"><i class="fas fa-truck-loading text-[10px]"></i></button>` : ''}
            </td>
            <td class="p-5 text-center">
                <button onclick="openModal('${p.selb}')" class="text-slate-300 hover:text-blue-600 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="deleteFromFirebase('${p.selb}')" class="text-slate-300 hover:text-red-500"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function renderGrid() {
    document.getElementById('view-grid').innerHTML = filtered.map(p => {
        const totalVazios = (p.vaziosK||0) + (p.vaziosC||0) + (p.vaziosM||0) + (p.vaziosY||0);
        const fmtCounter = new Intl.NumberFormat('pt-BR').format(p.counter || 0);
        return `<div class="bg-white p-7 rounded-[2.5rem] border-2 border-slate-100 relative overflow-hidden shadow-sm card-animate">
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-2xl font-black text-slate-900 leading-none">${p.selb}</h3>
                <div class="bg-slate-900 text-white text-[8px] px-2 py-1 rounded-lg font-black">${fmtCounter}</div>
            </div>
            <p class="text-[9px] font-bold text-slate-400 uppercase mb-4">${p.model} • ${p.setor}</p>
            <div class="bg-slate-950 text-[9px] font-mono text-emerald-400 px-3 py-2.5 rounded-2xl border border-slate-800 w-full mb-5 text-center leading-tight shadow-inner uppercase overflow-hidden whitespace-nowrap text-ellipsis" title="${p.message || 'Aguardando primeira coleta...'}">
                ${p.message || 'AGUARDANDO...'}
            </div>
            <div class="space-y-1">${window.bar('K',p.tonerK,'bg-slate-800')}${p.type==='COLOR'?window.bar('C',p.tonerC,'bg-cyan-500')+window.bar('M',p.tonerM,'bg-pink-500')+window.bar('Y',p.tonerY,'bg-yellow-400'):''}</div>
            ${totalVazios > 0 ? `
            <div class="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
                <div class="flex flex-col">
                    <span class="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cartuchos Vazios</span>
                    <span class="text-sm font-black text-amber-600">${totalVazios} Un.</span>
                </div>
                <button onclick="coletarVazios('${p.selb}')" class="bg-amber-600 text-white px-4 py-2 rounded-xl text-[9px] font-black shadow-md hover:bg-amber-700 transition-all uppercase tracking-tighter">Baixar Coleta</button>
            </div>` : ''}
        </div>`;
    }).join('');
}

window.filterVazios = () => {
    const listWithVazios = cached.filter(p => ((p.vaziosK||0) + (p.vaziosC||0) + (p.vaziosM||0) + (p.vaziosY||0)) > 0);
    if(listWithVazios.length === 0) return window.showToast("Nenhuma coleta pendente", "success");
    
    filtered = listWithVazios;
    document.getElementById('main_search').value = "";
    render();
    window.showToast(`Exibindo ${listWithVazios.length} setores para coleta`);
};

window.switchView = (v) => { currentView = v; document.getElementById('view-list').classList.toggle('hidden', v!=='list'); document.getElementById('view-grid').classList.toggle('hidden', v!=='grid'); render(); };
window.toggleView = () => {
    const nextView = currentView === 'list' ? 'grid' : 'list';
    window.switchView(nextView);
};

window.closeModal = () => document.getElementById('modal').classList.add('hidden');

window.syncNow = () => {
    window.showToast("Sincronizando com as impressoras...", "success");
    // Como o onValue já mantém os dados em tempo real, 
    // forçamos o re-processamento do filtro para atualizar a UI.
    applyFilter();
};

window.openModal = (selb = null) => {
    document.getElementById('formPrinter').reset();
    if(selb) {
        const p = cached.find(x => x.selb === selb);
        document.getElementById('m_selb').value = p.selb; document.getElementById('m_selb').disabled = true;
        document.getElementById('m_setor').value = p.setor; document.getElementById('m_ip').value = p.ip;
        document.getElementById('m_model').value = p.model; document.getElementById('m_type').value = p.type;
        document.getElementById('m_counter').value = p.counter || 0;
        window.toggleEstoque();
    } else { document.getElementById('m_selb').disabled = false; window.toggleEstoque(); }
    document.getElementById('modal').classList.remove('hidden');
};

window.coletarVazios = (selb) => {
    pendingColetaSelb = selb;
    document.getElementById('coleta-selb-display').innerText = selb;
    document.getElementById('modal-coleta').classList.remove('hidden');
};

window.closeColetaModal = () => document.getElementById('modal-coleta').classList.add('hidden');

window.confirmarColeta = async () => {
    if(pendingColetaSelb) {
        await update(ref(db, 'printers/' + pendingColetaSelb), { vaziosK: 0, vaziosC: 0, vaziosM: 0, vaziosY: 0 });
        window.showToast("Coleta registrada!", "success");
        window.closeColetaModal();
    }
};

window.deleteFromFirebase = (id) => { if(confirm(`Remover ${id}?`)) { remove(ref(db, 'printers/'+id)); window.showToast(`${id} removido`, "error"); } };

// Submit do Formulário
const form = document.getElementById('formPrinter');
if(form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('m_selb').value.toUpperCase();
        const type = document.getElementById('m_type').value;
        const existing = cached.find(x => x.selb === id) || {};
        set(ref(db, 'printers/'+id), {
            ...existing,
            selb: id, type: type, setor: document.getElementById('m_setor').value,
            ip: document.getElementById('m_ip').value, model: document.getElementById('m_model').value,
            counter: parseInt(document.getElementById('m_counter').value) || 0,
            estoqueK: parseInt(document.getElementById('m_e_k').value)||0,
            estoqueC: type === 'COLOR' ? parseInt(document.getElementById('m_e_c').value)||0 : 0,
            estoqueM: type === 'COLOR' ? parseInt(document.getElementById('m_e_m').value)||0 : 0,
            estoqueY: type === 'COLOR' ? parseInt(document.getElementById('m_e_y').value)||0 : 0
        });
        window.closeModal();
        window.showToast("Salvo com sucesso!");
    });

    
}