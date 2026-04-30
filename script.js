import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = { databaseURL: "https://dashboard-fleury-default-rtdb.firebaseio.com" };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let cached = [];
let filtered = [];
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
    content.className = `flex items-center gap-3 px-8 py-4 rounded-full shadow-2xl font-black text-sm text-white uppercase tracking-widest min-w-[300px] justify-center ${type === 'success' ? 'bg-slate-900' : 'bg-red-600'}`;
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
        grid.className = "grid grid-cols-4 gap-2"; // Grid para os inputs de estoque e código
        grid.innerHTML = `
            <input type="number" id="m_e_k" placeholder="Estoque K" class="border p-2 rounded-lg text-center font-bold text-sm">
            <input type="number" id="m_e_c" placeholder="Estoque C" class="border p-2 rounded-lg text-center font-bold text-sm text-cyan-600">
            <input type="number" id="m_e_m" placeholder="Estoque M" class="border p-2 rounded-lg text-center font-bold text-sm text-pink-600">
            <input type="number" id="m_e_y" placeholder="Estoque Y" class="border p-2 rounded-lg text-center font-bold text-sm text-amber-600">
            <input type="text" id="m_cartridge_code_k" placeholder="Cód. Cartucho K" class="border p-2 rounded-lg text-center font-bold text-sm">
            <input type="text" id="m_cartridge_code_c" placeholder="Cód. Cartucho C" class="border p-2 rounded-lg text-center font-bold text-sm text-cyan-600">
            <input type="text" id="m_cartridge_code_m" placeholder="Cód. Cartucho M" class="border p-2 rounded-lg text-center font-bold text-sm text-pink-600">
            <input type="text" id="m_cartridge_code_y" placeholder="Cód. Cartucho Y" class="border p-2 rounded-lg text-center font-bold text-sm text-amber-600">
        `;
    } else {
        grid.className = "grid grid-cols-1 gap-2";
        grid.innerHTML = `
            <input type="number" id="m_e_k" placeholder="Estoque K" class="border p-2 rounded-lg text-center font-bold text-sm">
            <input type="text" id="m_cartridge_code_k" placeholder="Cód. Cartucho K" class="border p-2 rounded-lg text-center font-bold text-sm">
        `;
    }
};

window.render = () => { renderGrid(); };

function renderGrid() {
    document.getElementById('view-grid').innerHTML = filtered.map(p => {
        const totalVazios = (p.vaziosK||0) + (p.vaziosC||0) + (p.vaziosM||0) + (p.vaziosY||0);
        
        // Exibir códigos de cartucho se disponíveis
        const cartridgeCodesHtml = (p.cartridgeCodeK || p.cartridgeCodeC || p.cartridgeCodeM || p.cartridgeCodeY) ? `
            <div class="flex flex-wrap gap-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-2">
                <i class="fas fa-barcode mr-1 opacity-50"></i>
                ${p.cartridgeCodeK ? `<span class="bg-slate-100 px-1 rounded">K:${p.cartridgeCodeK}</span>` : ''}
                ${p.type === 'COLOR' && p.cartridgeCodeC ? `<span class="bg-cyan-50 text-cyan-700 px-1 rounded">C:${p.cartridgeCodeC}</span>` : ''}
                ${p.type === 'COLOR' && p.cartridgeCodeM ? `<span class="bg-pink-50 text-pink-700 px-1 rounded">M:${p.cartridgeCodeM}</span>` : ''}
                ${p.type === 'COLOR' && p.cartridgeCodeY ? `<span class="bg-amber-50 text-amber-700 px-1 rounded">Y:${p.cartridgeCodeY}</span>` : ''}
            </div>
        ` : '';

        return `<div class="bg-white rounded-[2.5rem] border-2 border-slate-100 shadow-sm card-animate flex flex-col h-full overflow-hidden">
            <div class="p-6 pb-4">
                <div class="flex justify-between items-start mb-1">
                    <h3 class="text-3xl font-black text-slate-900 tracking-tighter">${p.selb}</h3>
                    <a href="http://${p.ip}" target="_blank" class="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold font-mono hover:bg-blue-100 transition-colors">${p.ip}</a>
                </div>
                <div class="flex items-center gap-1.5 text-slate-400">
                    <i class="fas fa-map-marker-alt text-[10px]"></i>
                    <p class="text-[11px] font-bold uppercase tracking-wide truncate">${p.setor}</p>
                </div>
            </div>

            <div class="px-6 space-y-3 flex-grow">
                <div class="bg-slate-50 px-4 py-2 rounded-xl flex items-center justify-between border border-slate-100">
                    <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Modelo</span>
                    <span class="text-[11px] font-bold text-slate-600 truncate ml-2">${p.model}</span>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-emerald-50/30 p-3 rounded-2xl border border-emerald-100">
                        <span class="text-[9px] font-black text-emerald-700 uppercase tracking-widest block mb-2">Estoque</span>
                        <div class="flex gap-1.5 flex-wrap">
                            <div class="w-6 h-6 bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-black text-white" title="Preto">${p.estoqueK||0}</div>
                            ${p.type === 'COLOR' ? `
                                <div class="w-6 h-6 bg-cyan-500 rounded-lg flex items-center justify-center text-[10px] font-black text-white" title="Cyan">${p.estoqueC||0}</div>
                                <div class="w-6 h-6 bg-pink-500 rounded-lg flex items-center justify-center text-[10px] font-black text-white" title="Magenta">${p.estoqueM||0}</div>
                                <div class="w-6 h-6 bg-amber-400 rounded-lg flex items-center justify-center text-[10px] font-black text-white" title="Yellow">${p.estoqueY||0}</div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="p-3 rounded-2xl border ${totalVazios > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'} transition-colors">
                        <span class="text-[9px] font-black ${totalVazios > 0 ? 'text-amber-700' : 'text-slate-400'} uppercase tracking-widest block mb-1">Vazios</span>
                        <div class="flex items-center justify-between">
                            <span class="text-xl font-black ${totalVazios > 0 ? 'text-amber-600' : 'text-slate-300'}">${totalVazios}</span>
                            ${totalVazios > 0 ? `
                                <button onclick="coletarVazios('${p.selb}')" class="bg-amber-600 text-white w-7 h-7 rounded-lg flex items-center justify-center shadow-md hover:bg-amber-700 transition-all">
                                    <i class="fas fa-arrow-down text-[10px]"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-6 pt-4">
                <div class="border-t border-slate-100 pt-4">
                    ${cartridgeCodesHtml}
                    <div class="flex justify-between items-center">
                        <span class="text-[9px] font-black text-slate-300 uppercase tracking-widest">${p.type}</span>
                        <div class="flex gap-1">
                            <button onclick="openModal('${p.selb}')" class="text-slate-300 hover:text-blue-500 p-2 transition-colors"><i class="fas fa-edit text-sm"></i></button>
                            <button onclick="deleteFromFirebase('${p.selb}')" class="text-slate-300 hover:text-red-500 p-2 transition-colors"><i class="fas fa-trash text-sm"></i></button>
                        </div>
                    </div>
                </div>
            </div>
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

window.closeModal = () => document.getElementById('modal').classList.add('hidden');

window.openModal = (selb = null) => {
    document.getElementById('formPrinter').reset();
    if(selb) {
        const p = cached.find(x => x.selb === selb);
        document.getElementById('m_selb').value = p.selb; document.getElementById('m_selb').disabled = true;
        document.getElementById('m_setor').value = p.setor; document.getElementById('m_ip').value = p.ip;
        document.getElementById('m_model').value = p.model; document.getElementById('m_type').value = p.type;
        window.toggleEstoque();
        // Preencher campos criados dinamicamente
        document.getElementById('m_e_k').value = p.estoqueK || 0;
        document.getElementById('m_cartridge_code_k').value = p.cartridgeCodeK || '';
        if (p.type === 'COLOR') {
            document.getElementById('m_e_c').value = p.estoqueC || 0;
            document.getElementById('m_e_m').value = p.estoqueM || 0;
            document.getElementById('m_e_y').value = p.estoqueY || 0;
            document.getElementById('m_cartridge_code_c').value = p.cartridgeCodeC || '';
            document.getElementById('m_cartridge_code_m').value = p.cartridgeCodeM || '';
            document.getElementById('m_cartridge_code_y').value = p.cartridgeCodeY || '';
        }
    } else { document.getElementById('m_selb').disabled = false; window.toggleEstoque(); }
    document.getElementById('modal').classList.remove('hidden');
};

window.coletarVazios = (selb) => {
    pendingColetaSelb = selb;
    document.getElementById('coleta-selb-display').innerText = selb;
    document.getElementById('modal-coleta').classList.remove('hidden');
};

// Funções para o Modal de Relatório de Cartuchos
window.openReportModal = () => {
    const totalsByCode = {}; // Nova estrutura: Código -> { total: X, models: Set, colors: Set }

    cached.forEach(p => {
        const modelName = p.model ? p.model.trim().toUpperCase() : 'MODELO NÃO INFORMADO';
        
        const add = (code, quantity, colorType) => { // Adicionado colorType
            if (code && code.trim() !== '' && quantity > 0) {
                const cleanCode = code.trim().toUpperCase();
                if (!totalsByCode[cleanCode]) {
                    totalsByCode[cleanCode] = { total: 0, models: new Set(), colors: new Set() };
                }
                totalsByCode[cleanCode].total += quantity;
                totalsByCode[cleanCode].models.add(modelName);
                totalsByCode[cleanCode].colors.add(colorType); // Adiciona a cor ao Set
            }
        };

        add(p.cartridgeCodeK, p.estoqueK || 0, 'K');
        if (p.type === 'COLOR') {
            add(p.cartridgeCodeC, p.estoqueC || 0, 'C');
            add(p.cartridgeCodeM, p.estoqueM || 0, 'M');
            add(p.cartridgeCodeY, p.estoqueY || 0, 'Y');
        }
    });

    let reportHtml = '';
    const sortedCodes = Object.keys(totalsByCode).sort();

    if (sortedCodes.length === 0) {
        reportHtml = '<p class="text-center text-slate-500 font-bold">Nenhum cartucho com código registrado ou em estoque.</p>';
    } else {
        reportHtml = sortedCodes.map(code => {
            const data = totalsByCode[code];
            const modelsList = Array.from(data.models).sort().join(', ');
            const colorsArray = Array.from(data.colors).sort(); // Ordena as cores para exibição consistente

            let colorDisplayHtml = '';
            if (colorsArray.length > 0) {
                const colorMap = {
                    'K': { name: 'Preto', class: 'bg-slate-100 text-slate-700' },
                    'C': { name: 'Ciano', class: 'bg-cyan-50 text-cyan-700' },
                    'M': { name: 'Magenta', class: 'bg-pink-50 text-pink-700' },
                    'Y': { name: 'Amarelo', class: 'bg-amber-50 text-amber-700' }
                };
                const displayedColors = colorsArray.map(c => {
                    const colorInfo = colorMap[c];
                    return `<span class="${colorInfo.class} px-1 rounded">${c}: ${colorInfo.name}</span>`;
                }).join('');
                colorDisplayHtml = `<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-1 flex flex-wrap gap-1">Cor(es): ${displayedColors}</p>`;
            }
            
            return `
                <div class="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm">
                    <div class="flex-grow pr-4">
                        <h3 class="text-xl font-black text-slate-900 tracking-tighter">${code}</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-1">Compatível: ${modelsList}</p>
                        ${colorDisplayHtml}
                    </div>
                    <div class="text-right min-w-[80px]">
                        <span class="text-3xl font-black text-blue-600">${data.total}</span>
                        <span class="text-[9px] font-black text-slate-400 block uppercase tracking-tighter">Unidades</span>
                    </div>
                </div>
            `;
        }).join('<div class="h-3"></div>');
    }

    document.getElementById('report-content').innerHTML = reportHtml;
    document.getElementById('modal-report').classList.remove('hidden');
};
window.closeReportModal = () => {
    document.getElementById('modal-report').classList.add('hidden');
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
            estoqueK: parseInt(document.getElementById('m_e_k').value)||0,
            cartridgeCodeK: document.getElementById('m_cartridge_code_k').value,
            ...(type === 'COLOR' ? {
                estoqueC: parseInt(document.getElementById('m_e_c').value)||0,
                estoqueM: parseInt(document.getElementById('m_e_m').value)||0,
                estoqueY: parseInt(document.getElementById('m_e_y').value)||0,
                cartridgeCodeC: document.getElementById('m_cartridge_code_c').value,
                cartridgeCodeM: document.getElementById('m_cartridge_code_m').value,
                cartridgeCodeY: document.getElementById('m_cartridge_code_y').value,
            } : {
                // Garante que campos específicos de cor não sejam salvos para impressoras MONO
                // Isso é importante se uma impressora era COLOR e foi alterada para MONO
                estoqueC: 0,
                estoqueM: 0,
                estoqueY: 0,
                cartridgeCodeC: '',
                cartridgeCodeM: '',
                cartridgeCodeY: '',
            })
        });
        window.closeModal();
        window.showToast("Salvo com sucesso!");
    });

    
} 