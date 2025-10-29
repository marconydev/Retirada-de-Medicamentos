// ===============================
// CONFIGURAÇÕES INICIAIS
// ===============================
const API_URL = "/api/pacientes"; // URL base da API backend
let usuarioId = null; // Armazena o ID do usuário logado
let pacientesCache = []; // Cache com pacientes carregados (evita consultas repetidas)

// ===============================
// FUNÇÕES AUXILIARES (CPF, FORMATAÇÃO, ETC.)
// ===============================

// Remove tudo que não for número
const onlyDigits = s => (s || "").replace(/\D+/g, "");

// Formata CPF para o padrão 000.000.000-00
function formatCPF(cpfRaw) {
  const c = onlyDigits(cpfRaw);
  if (c.length !== 11) return cpfRaw || "";
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
}

// Valida CPF com base no cálculo oficial
function validateCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (!cpf || cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // elimina CPFs com números repetidos
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i-1, i)) * (11 - i);
  rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i-1, i)) * (12 - i);
  rest = (sum * 10) % 11; if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

// ===============================
// LOGIN GOOGLE E SESSÃO
// ===============================
window.addEventListener("load", async () => {
  try {
    // Tenta recuperar sessão existente
    const res = await fetch(`${API_URL}/me`, { credentials: "include" });
    if (res.ok) {
      const user = await res.json();
      usuarioId = user.id;

      // Atualiza interface
      document.getElementById("nomeUsuario").textContent = user.nome;
      document.getElementById("loginSection").classList.add("hidden");
      document.getElementById("appSection").classList.remove("hidden");
      document.getElementById("logoutBtn").classList.remove("hidden");

      // Carrega dados iniciais
      await carregarPacientes(true);
      await atualizarDashboard();
    }
  } catch {}

  // Inicializa login do Google
  google.accounts.id.initialize({
    client_id: "888248677437-9blvld347207bc5tnnkse4c6n3r712b0.apps.googleusercontent.com",
    callback: handleCredentialResponse,
  });
  google.accounts.id.renderButton(document.getElementById("googleLogin"), {
    theme: "filled_blue",
    size: "large",
  });
});

// Decodifica o token JWT retornado pelo Google
function parseJwt(token) {
  if (!token) return {};
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(json);
  } catch { return {}; }
}

// Executado quando o login do Google é bem-sucedido
async function handleCredentialResponse(response) {
  try {
    const data = parseJwt(response.credential);
    const nomeCorrigido = (data.name || "Usuário Google").normalize("NFC");

    // Envia dados para backend registrar usuário (ou recuperar existente)
    const res = await fetch(`${API_URL}/usuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      credentials: "include",
      body: JSON.stringify({ nome: nomeCorrigido, email: data.email }),
    });

    if (!res.ok) throw new Error("Falha ao registrar usuário.");
    const user = await res.json();

    usuarioId = user.id;
    document.getElementById("nomeUsuario").textContent = user.nome;
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("appSection").classList.remove("hidden");
    document.getElementById("logoutBtn").classList.remove("hidden");
    showToast(`Bem-vindo, ${user.nome}`);

    await carregarPacientes(true);
    await atualizarDashboard();
  } catch {
    showToast("Falha no login. Tente novamente.", true);
  }
}

// Logout (encerra sessão)
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try { await fetch(`${API_URL}/logout`, { method: "POST", credentials: "include" }); } catch {}
  usuarioId = null;
  document.getElementById("appSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
  showToast("Sessão encerrada.");
});

// ===============================
// FUNÇÃO DE MENSAGEM POPUP (TOAST)
// ===============================
function showToast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background = isError ? "#dc3545" : "#007bff"; // vermelho p/ erro, azul p/ sucesso
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

// ===============================
// CONTROLE DE MODAIS (ABRIR/FECHAR)
// ===============================
function abrirSomente(id) {
  ["modalCadastro", "modalSaida", "modalHistorico"].forEach(mid => {
    const el = document.getElementById(mid);
    if (mid === id) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}
function fecharTodosModais() { abrirSomente("__none__"); }

// Botões que abrem os modais
document.getElementById("abrirCadastroBtn").addEventListener("click", () => {
  document.getElementById("formCadastroModal").reset();
  document.getElementById("cadSetor").disabled = true;
  abrirSomente("modalCadastro");
});
document.getElementById("abrirSaidaBtn").addEventListener("click", async () => {
  if (!pacientesCache.length) await carregarPacientes(true);
  prepararAutocompletePacientes();
  document.getElementById("formSaida").reset();
  abrirSomente("modalSaida");
});

// ===============================
// CADASTRO DE PACIENTES
// ===============================
const cadFlag = document.getElementById("cadHospital");
const cadSetor = document.getElementById("cadSetor");

// Habilita campo "setor" apenas se a flag for marcada
cadFlag.addEventListener("change", () => {
  cadSetor.disabled = !cadFlag.checked;
  if (!cadFlag.checked) cadSetor.value = "";
});

// Formata CPF enquanto o usuário digita
const cadCpf = document.getElementById("cadCpf");
cadCpf.addEventListener("input", () => {
  const digits = onlyDigits(cadCpf.value).slice(0,11);
  let fmt = digits;
  if (digits.length > 9) fmt = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  else if (digits.length > 6) fmt = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
  else if (digits.length > 3) fmt = `${digits.slice(0,3)}.${digits.slice(3)}`;
  cadCpf.value = fmt;
});

// Submissão do cadastro
document.getElementById("formCadastroModal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("cadNome").value.trim();
  const cpfFmt = document.getElementById("cadCpf").value.trim();
  const cpfDigits = onlyDigits(cpfFmt);
  const isHospital = document.getElementById("cadHospital").checked;
  const setor = document.getElementById("cadSetor").value.trim();

  // Validações básicas
  if (!nome || !cpfDigits || (isHospital && !setor)) {
    showToast("Preencha os campos obrigatórios.", true);
    return;
  }
  if (!validateCPF(cpfDigits)) return showToast("CPF inválido.", true);

  // Envia dados para API
  try {
    const res = await fetch(`${API_URL}/cadastrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ nome, cpf: cpfDigits, isHospital, setor, criado_por: usuarioId }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.sucesso);
      fecharTodosModais();
      await carregarPacientes(true);
      await atualizarDashboard();
    } else showToast(data.erro || "Erro ao cadastrar.", true);
  } catch {
    showToast("Erro de conexão.", true);
  }
});

// ===============================
// AUTOCOMPLETE (PACIENTES NO MODAL DE SAÍDA)
// ===============================
function prepararAutocompletePacientes() {
  const inp = document.getElementById("saidaPacienteInput");
  const hid = document.getElementById("saidaPacienteId");
  const sug = document.getElementById("pacienteSuggestions");

  // Filtra pacientes conforme digita
  inp.addEventListener("input", () => {
    const termo = inp.value.toLowerCase();
    if (!termo) return (sug.innerHTML = "", sug.classList.add("hidden"));
    const filtrados = pacientesCache.filter(p =>
      p.nome.toLowerCase().includes(termo) || formatCPF(p.cpf).includes(termo)
    );
    // Monta lista suspensa
    sug.innerHTML = filtrados.map(p =>
      `<div class="item" data-id="${p.id}" data-label="${p.nome}">${p.nome} — ${formatCPF(p.cpf)}</div>`
    ).join("");
    sug.classList.remove("hidden");
  });

  // Ao clicar em um item, preenche campo
  sug.addEventListener("click", e => {
    const item = e.target.closest(".item");
    if (!item) return;
    hid.value = item.dataset.id;
    inp.value = item.dataset.label;
    sug.classList.add("hidden");
  });

  // Fecha a lista se clicar fora
  document.addEventListener("click", e => {
    if (!sug.contains(e.target) && e.target !== inp) sug.classList.add("hidden");
  });
}

// ===============================
// REGISTRAR SAÍDA DE MEDICAMENTO
// ===============================
document.getElementById("formSaida").addEventListener("submit", async e => {
  e.preventDefault();
  const paciente_id = document.getElementById("saidaPacienteId").value;
  const medicamento = document.getElementById("saidaMedicamento").value.trim();
  const quantidade = document.getElementById("saidaQuantidade").value.trim();
  const tipo = document.getElementById("saidaTipo").value.trim();

  if (!paciente_id || !medicamento || !quantidade || !tipo)
    return showToast("Preencha todos os campos.", true);

  try {
    const res = await fetch(`${API_URL}/saida`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ paciente_id, medicamento, quantidade, tipo, entregue_por: usuarioId }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.sucesso);
      fecharTodosModais();
      await carregarPacientes(true);
      await atualizarDashboard();
    } else showToast(data.erro || "Erro.", true);
  } catch {
    showToast("Erro de conexão.", true);
  }
});

// ===============================
// CARREGAR PACIENTES (AGRUPADOS)
// ===============================
async function carregarPacientes(updateCache = false) {
  try {
    const res = await fetch(`${API_URL}/consultar`, { credentials: "include" });
    const data = await res.json();
    const tbody = document.querySelector("#tabelaPacientes tbody");
    tbody.innerHTML = "";

    if (updateCache) pacientesCache = data;

    // Cria uma linha por paciente
    data.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="paciente-nome" data-id="${p.id}">${p.nome}</td>
        <td>${formatCPF(p.cpf)}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas}</td>
      `;
      tbody.appendChild(tr);
    });

    aplicarFiltroTabela();

    // Ao clicar no nome → abrir histórico
    document.querySelectorAll(".paciente-nome").forEach(td => {
      td.addEventListener("click", async () => {
        const pid = td.dataset.id;
        const nome = td.textContent;
        await abrirHistorico(pid, nome);
      });
    });

  } catch {
    showToast("Erro ao carregar pacientes.", true);
  }
}

// ===============================
// HISTÓRICO DE RETIRADAS POR PACIENTE
// ===============================
async function abrirHistorico(id, nome) {
  const modal = document.getElementById("modalHistorico");
  const div = document.getElementById("historicoConteudo");
  div.innerHTML = `<p>Carregando histórico...</p>`;
  modal.classList.remove("hidden");

  try {
    const res = await fetch(`${API_URL}/historico/${id}`, { credentials: "include" });
    const data = await res.json();
    if (!data.length) {
      div.innerHTML = `<p>Sem retiradas registradas para ${nome}.</p>`;
      return;
    }

    // Monta tabela de retiradas
    let html = `<h4>${nome}</h4><table class="tabela-historico">
      <thead><tr><th>Medicamento</th><th>Qtd</th><th>Tipo</th><th>Data</th><th>Entregue por</th></tr></thead><tbody>`;
    data.forEach(r => {
      html += `<tr>
        <td>${r.medicamento}</td>
        <td>${r.quantidade}</td>
        <td>${r.tipo}</td>
        <td>${r.data_entrega}</td>
        <td>${r.entregue_por || "-"}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    div.innerHTML = html;
  } catch {
    div.innerHTML = `<p>Erro ao carregar histórico.</p>`;
  }
}

// Botão "fechar" do modal de histórico
document.getElementById("fecharHistorico").addEventListener("click", () => {
  document.getElementById("modalHistorico").classList.add("hidden");
});

// ===============================
// FILTRO E DASHBOARD
// ===============================
document.getElementById("btnBuscar").addEventListener("click", () => carregarPacientes(true));
const filtroInput = document.getElementById("filtroTabela");
filtroInput.addEventListener("input", aplicarFiltroTabela);

// Filtra pacientes na tabela
function aplicarFiltroTabela() {
  const term = filtroInput.value.trim().toLowerCase();
  document.querySelectorAll("#tabelaPacientes tbody tr").forEach(row => {
    const nome = row.children[0].textContent.toLowerCase();
    const cpf = row.children[1].textContent.toLowerCase();
    row.style.display = !term || nome.includes(term) || cpf.includes(term) ? "" : "none";
  });
}

// Atualiza contadores do painel (total de pacientes e saídas)
async function atualizarDashboard() {
  try {
    const res = await fetch(`${API_URL}/consultar`, { credentials: "include" });
    const data = await res.json();
    const pacientesUnicos = new Set(data.map(p => p.id)).size;
    const totalSaidas = data.reduce((acc, p) => acc + p.total_retiradas, 0);
    document.getElementById("totalPacientes").textContent = pacientesUnicos;
    document.getElementById("totalSaidas").textContent = totalSaidas;
  } catch {}
}

// ===============================
// FECHAR MODAIS CLICANDO FORA
// ===============================
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) fecharTodosModais(); });
});
document.getElementById("fecharCadastro").addEventListener("click", fecharTodosModais);
document.getElementById("fecharSaida").addEventListener("click", fecharTodosModais);
