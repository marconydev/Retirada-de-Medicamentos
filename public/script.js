// ===============================================
// SCRIPT PRINCIPAL - Retirada de Medicamentos
// ===============================================

// URL base da API (Render)
const API_URL = "https://retirada-de-medicamentos.onrender.com/api/pacientes";

// Elementos principais
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const nomeUsuarioSpan = document.getElementById("nomeUsuario");
const logoutBtn = document.getElementById("logoutBtn");
const toast = document.getElementById("torrada");

// Modais
const modalCadastro = document.getElementById("modalCadastro");
const modalSaida = document.getElementById("modalSaida");
const modalHistorico = document.getElementById("modalHistorico");

// Botões
const abrirCadastroBtn = document.getElementById("abrirCadastroBtn");
const abrirSaidaBtn = document.getElementById("abrirSaidaBtn");
const fecharCadastro = document.getElementById("fecharCadastro");
const fecharSaida = document.getElementById("fecharSaida");
const fecharHistorico = document.getElementById("fecharHistorico");

// Campos de cadastro
const formCadastro = document.getElementById("formCadastroModal");
const cadHospitalCheckbox = document.getElementById("cadHospital");
const cadSetorInput = document.getElementById("cadSetor");

// Campos de saída
const formSaida = document.getElementById("formSaida");
const saidaPacienteSelect = document.getElementById("saidaPacienteSelect");
const tabelaPacientes = document.getElementById("tabelaPacientes").querySelector("tbody");

// Campos de histórico
const tabelaHistorico = document.getElementById("tabelaHistorico").querySelector("tbody");
const historicoPacienteNome = document.getElementById("historicoPacienteNome");

// ===================================================
// LOGIN COM GOOGLE
// ===================================================
function handleCredentialResponse(response) {
  try {
    const base64Url = response.credential.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const userData = JSON.parse(jsonPayload);

    const nome = userData.name;
    const email = userData.email;

    fetch(`${API_URL}/usuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email })
    })
      .then(res => res.json())
      .then(user => {
        if (user.erro) throw new Error(user.erro);
        localStorage.setItem("usuario", JSON.stringify(user));
        carregarApp(user);
      })
      .catch(err => {
        console.error("Erro no login:", err);
        mostrarToast("Erro ao realizar login.", true);
      });
  } catch (error) {
    console.error("Erro ao processar token Google:", error);
    mostrarToast("Falha no login Google.", true);
  }
}

window.onload = () => {
  google.accounts.id.initialize({
    client_id: "888248677437-9blvld347207bc5tnnkse4c6n3r712b0.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.getElementById("googleLogin"), {
    theme: "outline",
    size: "large"
  });

  const user = JSON.parse(localStorage.getItem("usuario"));
  if (user) carregarApp(user);
};

// ===================================================
// INTERFACE PÓS-LOGIN
// ===================================================
function carregarApp(user) {
  loginSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  nomeUsuarioSpan.textContent = user.nome;

  atualizarTabela();
  carregarPacientesSelect();
}

logoutBtn.onclick = () => {
  localStorage.removeItem("usuario");
  fetch(`${API_URL}/logout`, { method: "POST" });
  appSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  mostrarToast("Sessão encerrada.");
};

// ===================================================
// CHECKBOX SETOR
// ===================================================
cadHospitalCheckbox.addEventListener("change", () => {
  cadSetorInput.disabled = !cadHospitalCheckbox.checked;
  if (!cadHospitalCheckbox.checked) cadSetorInput.value = "";
});

// ===================================================
// MODAIS
// ===================================================
abrirCadastroBtn.onclick = () => modalCadastro.classList.remove("hidden");
abrirSaidaBtn.onclick = () => {
  modalSaida.classList.remove("hidden");
  carregarPacientesSelect();
};
fecharCadastro.onclick = () => modalCadastro.classList.add("hidden");
fecharSaida.onclick = () => modalSaida.classList.add("hidden");
fecharHistorico.onclick = () => modalHistorico.classList.add("hidden");

// ===================================================
// CADASTRAR PACIENTE
// ===================================================
formCadastro.addEventListener("submit", async e => {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem("usuario"));
  const nome = document.getElementById("cadNome").value.trim();
  const cpf = document.getElementById("cadCpf").value.replace(/\D/g, "");
  const isHospital = document.getElementById("cadHospital").checked;
  const setor = document.getElementById("cadSetor").value.trim();

  if (!nome || !cpf || (isHospital && !setor))
    return mostrarToast("Preencha todos os campos obrigatórios.", true);

  try {
    const res = await fetch(`${API_URL}/cadastrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        cpf,
        isHospital,
        setor: isHospital ? setor : null,
        criado_por: user.id
      })
    });
    const data = await res.json();
    if (!res.ok || data.erro) throw new Error(data.erro || "Erro ao cadastrar paciente.");
    mostrarToast("✅ Paciente cadastrado com sucesso!");
    modalCadastro.classList.add("hidden");
    formCadastro.reset();
    cadSetorInput.disabled = true;
    atualizarTabela();
  } catch (err) {
    console.error("Erro no cadastro:", err);
    mostrarToast(err.message, true);
  }
});

// ===================================================
// REGISTRAR SAÍDA
// ===================================================
formSaida.addEventListener("submit", async e => {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem("usuario"));
  const paciente_id = saidaPacienteSelect.value;
  const medicamento = document.getElementById("saidaMedicamento").value.trim();
  const quantidade = document.getElementById("saidaQuantidade").value;
  const tipo = document.getElementById("saidaTipo").value.trim();

  if (!paciente_id || !medicamento || !quantidade || !tipo)
    return mostrarToast("Preencha todos os campos obrigatórios.", true);

  try {
    const res = await fetch(`${API_URL}/saida`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paciente_id, medicamento, quantidade, tipo, entregue_por: user.id })
    });
    const data = await res.json();
    if (!res.ok || data.erro) throw new Error(data.erro || "Erro ao registrar saída.");
    mostrarToast("💊 Saída registrada com sucesso!");
    modalSaida.classList.add("hidden");
    atualizarTabela();
  } catch (err) {
    console.error("Erro na saída:", err);
    mostrarToast(err.message, true);
  }
});

// ===================================================
// CONSULTAS E HISTÓRICO
// ===================================================
async function atualizarTabela() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    tabelaPacientes.innerHTML = "";
    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="link">${p.nome}</td>
        <td>${p.cpf}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas || 0}</td>
      `;
      tr.querySelector(".link").onclick = () => carregarHistorico(p.id, p.nome);
      tabelaPacientes.appendChild(tr);
    });

    // Atualiza os totais do painel
    atualizarIndicadores(pacientes);
  } catch (err) {
    console.error("Erro ao carregar tabela:", err);
    mostrarToast("Falha ao carregar pacientes.", true);
  }
}

// ===================================================
// CONSULTAS E HISTÓRICO
// ===================================================
async function atualizarTabela() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    tabelaPacientes.innerHTML = "";
    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="link">${p.nome}</td>
        <td>${p.cpf}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas || 0}</td>
      `;
      tr.querySelector(".link").onclick = () => carregarHistorico(p.id, p.nome);
      tabelaPacientes.appendChild(tr);
    });

    // Atualiza os totais do painel
    atualizarIndicadores(pacientes);
  } catch (err) {
    console.error("Erro ao carregar tabela:", err);
    mostrarToast("Falha ao carregar pacientes.", true);
  }
}

// ===================================================
// CONSULTAS E HISTÓRICO
// ===================================================
async function atualizarTabela() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    tabelaPacientes.innerHTML = "";
    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="link">${p.nome}</td>
        <td>${p.cpf}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas || 0}</td>
      `;
      tr.querySelector(".link").onclick = () => carregarHistorico(p.id, p.nome);
      tabelaPacientes.appendChild(tr);
    });

    // Atualiza os totais do painel
    atualizarIndicadores(pacientes);
  } catch (err) {
    console.error("Erro ao carregar tabela:", err);
    mostrarToast("Falha ao carregar pacientes.", true);
  }
}

// ===================================================
// ATUALIZAR INDICADORES DO DASHBOARD
// ===================================================
async function atualizarIndicadores(pacientes) {
  try {
    // Total de pacientes (baseado na lista)
    const totalPacientes = pacientes.length;
    document.getElementById("totalPacientes").textContent = totalPacientes;

    // Buscar total de saídas
    const resSaidas = await fetch(`${API_URL}/consultar`);
    const lista = await resSaidas.json();
    let totalSaidas = 0;
    lista.forEach(p => {
      totalSaidas += p.total_retiradas ? parseInt(p.total_retiradas) : 0;
    });

    document.getElementById("totalSaidas").textContent = totalSaidas;
  } catch (error) {
    console.error("Erro ao atualizar indicadores:", error);
  }
}

// Busca dinâmica de pacientes
document.getElementById("buscaPaciente").addEventListener("input", (e) => {
  const termo = e.target.value.toLowerCase();
  const linhas = document.querySelectorAll("#tabelaPacientes tbody tr");
  linhas.forEach((linha) => {
    const nome = linha.children[0].textContent.toLowerCase();
    const cpf = linha.children[1].textContent.toLowerCase();
    linha.style.display =
      nome.includes(termo) || cpf.includes(termo) ? "" : "none";
  });
});



// ===================================================
// TOAST
// ===================================================
function mostrarToast(msg, erro = false) {
  toast.textContent = msg;
  toast.className = erro ? "erro" : "sucesso";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4000);
}
