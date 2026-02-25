/**
 * Default options extracted from historical data and Google Forms.
 * These can be expanded by the user and saved in localStorage.
 * Guard against multiple loads by only defining when undefined.
 */
if (typeof DEFAULT_DATA_OPTIONS === 'undefined') {
    var DEFAULT_DATA_OPTIONS = {
    unidades: [
        "Operadora", "CG24h", "CG Ambulatório", "Centro Pediátrico",
        "Medicina Preventiva", "WorkMed", "Centro Médico Bangu",
        "Centro Médico Sulacap", "Vila Nova", "Centro Social Bangu",
        "Quality Gold", "CETI", "CT - Areia Branca", "ITCM",
        "CM Seropédica", "HGSC", "Bangu"
    ],
    setores: [
        "Administrativo", "Atendimento", "Auditoria", "Cadastro",
        "Call Center", "Cobrança", "Comercial PJ", "Compras",
        "Contabilidade", "Contas Médicas", "Controladoria",
        "Credenciamento", "DEREG - OPME - Auditoria", "Diretoria",
        "Enfermagem", "Faturamento", "Fidelização", "Financeiro",
        "Juridico", "Manutenção", "Patrimônio", "Presidência",
        "Recuperação de Produtos", "Recursos Humanos",
        "Relacionamento Empresarial", "TI"
    ],
    locais: [
        "Campo Grande", "Bangu", "Sulacap", "Santa Cruz", "Itaguaí", "Seropédica"
    ],
    analistas: [
        { nome: "Marcus Vinicius de Oliveira", cargo: "Analista de TI" },
        { nome: "Tulio Maravilha", cargo: "Analista de TI" },
        { nome: "Kevin Vanucci", cargo: "Gestor de TI" },
        { nome: "Jonathan Villas Boas", cargo: "Assistente de TI" },
        { nome: "Romayne de Arruda Matos", cargo: "Analista de TI" }
    ],
    marcas: [
        "Dell", "HP", "Lenovo", "Unifi", "Jabra",
        "Ubiquiti", "Logitech", "Kingston", "Avaya", "Samsung", "LG"
    ],
    modelos: [
        "OPTIPLEX 3070", "OPTIPLEX 3020", "PRODESK 400 G5",
        "Latitude 3420", "MK120", "A400 SATA III", "U7-pro",
        "Precison 3551", "Vostro 3470", "G3 3500"
    ],
    itens: [
        "Placa mãe", "Processador", "Memória", "Disco (HD/SSD)", "Fonte",
        "Placa de Rede", "Monitor", "Teclado", "Mouse", "Nobreak",
        "Estabilizador", "Switch", "Telefone", "Impressora", "Câmera", "Office",
        "Acess Point / Unifi", "Adaptadores", "Headsets", "Computador", "SSD"
    ],
    cargos: [
        "Assistente de TI",
        "Analista de TI",
        "Gestor de TI",
        "Gerente de TI",
        "Técnico Responsável",
        "Coordenador de Infraestrutura"
    ]
    };
}

/**
 * Loads options from the backend or falls back to defaults.
 */
async function loadDataOptions() {
    try {
        console.log('[DEBUG data_options.js] Starting loadDataOptions()');
        const res = await fetch('/api/options');
        const json = await res.json();
        console.log('[DEBUG data_options.js] API response:', json);

        if (json.success && json.data && json.data.length > 0) {
            console.log('[DEBUG data_options.js] API returned', json.data.length, 'items');
            // Reconstruct the structure expected by the app
            const options = {
                unidades: [], setores: [], locais: [], analistas: [],
                marcas: [], modelos: [], itens: [], cargos: []
            };

            json.data.forEach(opt => {
                if (options[opt.category]) {
                    if (opt.category === 'analistas') {
                        options[opt.category].push({ nome: opt.value, cargo: opt.extra?.cargo || 'Analista de TI', id: opt.id });
                    } else if (opt.category === 'itens') {
                        options[opt.category].push({ nome: opt.value, code: opt.extra?.code || '', id: opt.id });
                    } else {
                        // Store everything as objects to keep the ID!
                        options[opt.category].push({ nome: opt.value, id: opt.id });
                    }
                }
            });

            console.log('[DEBUG data_options.js] Returning options object:', options);
            return options;
        } else {
            console.warn('[DEBUG data_options.js] API returned no data or success=false, using defaults');
        }
    } catch (e) {
        console.error("[ERROR data_options.js] Error loading options from backend:", e);
    }
    console.log('[DEBUG data_options.js] Returning DEFAULT_DATA_OPTIONS:', DEFAULT_DATA_OPTIONS);
    return { ...DEFAULT_DATA_OPTIONS };
}

/**
 * Saves a new option to the backend.
 */
async function addDataOption(category, value, extra = null) {
    try {
        const res = await fetch('/api/options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, value, extra })
        });
        const json = await res.json();
        return json.success;
    } catch (e) {
        console.error("Error adding option:", e);
        return false;
    }
}

/**
 * Deletes an option from the backend.
 * Note: This requires knowing the ID, which we'll need to handle in app.js.
 */
async function removeDataOption(id) {
    try {
        const res = await fetch(`/api/options/${id}`, {
            method: 'DELETE'
        });
        const json = await res.json();
        return json.success;
    } catch (e) {
        console.error("Error deleting option:", e);
        return false;
    }
}

/**
 * System Settings (Network Path, etc.)
 */
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const json = await res.json();
        return json.success ? json.data : {};
    } catch (e) {
        console.error("Error loading settings:", e);
        return {};
    }
}

async function saveSetting(key, value) {
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        const json = await res.json();
        return json.success;
    } catch (e) {
        console.error("Error saving setting:", e);
        return false;
    }
}
