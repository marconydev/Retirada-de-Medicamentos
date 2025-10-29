// ===============================================
// SCRIPT PRINCIPAL - Retirada de Medicamentos
// ===============================================

// URL base da API (relativa para funcionar local e no Render)
const API_URL = "/api/pacientes";

// Elementos do DOM
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const nomeUsuarioSpan = document.getElementById("nomeUsuario");
const logoutBtn = document.getElementById("logoutBtn");
const toast = document.getElementById("torrada");

// Modais
const modalCadastro = document.getElementById("modalCadastro");
const modalSaida = document.getElementById("modalSaida");

// Botões
const abrirCadastroBtn = document.getElementById("abrirCadastroBtn");
const abrirSaidaBtn = document.getElementById("abrirSaidaBtn");
const fecharCadastro = document.getElementById("fecharCadastro");
const fecharSaida = document.getElementById("fecharSaida");

// Campos
const formCadastro = document.getElementById("formCadastroModal");
const formSaida = document.getElementById("formSaida");
const saidaPacienteSelect = document.getElementById("saidaPacienteSelect");
const tabelaPacientes = document.getElementById("tabelaPacientes").querySelector("tbody");

// ===================================================
// LOGIN COM GOOGLE
// ===================================================
function handleCredentialResponse(response) {
  try {
    // Decodifica o token JWT retornado pelo Google
    try {
      const base64Url = response.credential.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = atob(base64);
      const userData = JSON.parse(jsonPayload);

      // Nome e e-mail direto do token, sem conversões extras
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
      mostrarToast("Falha ao processar login do Google.", true);
    }
    // Envia ao backend
    fetch(`${API_URL}/usuario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email: userData.email })
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

// Inicializa o botão do Google
window.onload = () => {
  google.accounts.id.initialize({
    client_id: "888248677437-9blvld347207bc5tnnkse4c6n3r712b0.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.getElementById("googleLogin"), {
    theme: "outline",
    size: "large"
  });

  // Se já estiver logado, carrega direto
  const user = JSON.parse(localStorage.getItem("usuario"));
  if (user) carregarApp(user);
};

// ===================================================
// CARREGAMENTO DO APLICATIVO (PÓS LOGIN)
// ===================================================
function carregarApp(user) {
  loginSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  nomeUsuarioSpan.textContent = user.nome;

  atualizarTabela();
  carregarPacientesSelect();
}

// Logout
logoutBtn.onclick = () => {
  localStorage.removeItem("usuario");
  fetch(`${API_URL}/logout`, { method: "POST" });
  appSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  mostrarToast("Sessão encerrada.");
};

// ===================================================
// MODAIS (abrir / fechar)
// ===================================================
abrirCadastroBtn.onclick = () => {
  modalCadastro.classList.remove("hidden");
};
abrirSaidaBtn.onclick = () => {
  modalSaida.classList.remove("hidden");
  carregarPacientesSelect();
};
fecharCadastro.onclick = () => modalCadastro.classList.add("hidden");
fecharSaida.onclick = () => modalSaida.classList.add("hidden");

// ===================================================
// CADASTRAR PACIENTE
// ===================================================
formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem("usuario"));
  const nome = document.getElementById("cadNome").value.trim();
  const cpf = document.getElementById("cadCpf").value.replace(/\D/g, "");
  const isHospital = document.getElementById("cadHospital").checked;
  const setor = document.getElementById("cadSetor").value.trim();

  if (!nome || !cpf || (isHospital && !setor)) {
    return mostrarToast("Preencha todos os campos obrigatórios.", true);
  }

  const dados = { nome, cpf, isHospital, setor, criado_por: user.id };

  try {
    const res = await fetch(`${API_URL}/cadastrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const data = await res.json();

    if (data.erro) throw new Error(data.erro);
    mostrarToast("Paciente cadastrado com sucesso!");
    modalCadastro.classList.add("hidden");
    atualizarTabela();
  } catch (err) {
    mostrarToast(err.message, true);
  }
});

// ===================================================
// REGISTRAR SAÍDA DE MEDICAMENTO
// ===================================================
formSaida.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = JSON.parse(localStorage.getItem("usuario"));
  const paciente_id = saidaPacienteSelect.value;
  const medicamento = document.getElementById("saidaMedicamento").value.trim();
  const quantidade = document.getElementById("saidaQuantidade").value;
  const tipo = document.getElementById("saidaTipo").value.trim();

  if (!paciente_id || !medicamento || !quantidade || !tipo) {
    return mostrarToast("Preencha todos os campos obrigatórios.", true);
  }

  const dados = { paciente_id, medicamento, quantidade, tipo, entregue_por: user.id };

  try {
    const res = await fetch(`${API_URL}/saida`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados)
    });
    const data = await res.json();

    if (data.erro) throw new Error(data.erro);
    mostrarToast("Saída registrada com sucesso!");
    modalSaida.classList.add("hidden");
    atualizarTabela();
  } catch (err) {
    mostrarToast(err.message, true);
  }
});

// ===================================================
// CONSULTAS E ATUALIZAÇÕES
// ===================================================
async function atualizarTabela() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    tabelaPacientes.innerHTML = "";
    pacientes.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.nome}</td>
        <td>${p.cpf}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas || 0}</td>
      `;
      tr.onclick = () => carregarHistorico(p.id, p.nome);
      tabelaPacientes.appendChild(tr);
    });
  } catch (error) {
    console.error("Erro ao carregar tabela:", error);
    mostrarToast("Falha ao carregar pacientes.", true);
  }
}

// Preenche o select de pacientes no modal de saída
async function carregarPacientesSelect() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    saidaPacienteSelect.innerHTML = "<option value=''>Selecione um paciente</option>";
    pacientes.forEach(p => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.nome;
      saidaPacienteSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar lista de pacientes:", error);
  }
}

// Carrega histórico individual (ao clicar no nome)
async function carregarHistorico(id, nome) {
  try {
    const res = await fetch(`${API_URL}/historico/${id}`);
    const historico = await res.json();

    if (!historico.length) {
      return mostrarToast(`Nenhuma retirada encontrada para ${nome}.`);
    }

    const detalhes = historico
      .map(h => `${h.medicamento} - ${h.quantidade} ${h.tipo} (${h.data_entrega.split(" ")[0]})`)
      .join("\n");

    alert(`Histórico de ${nome}:\n\n${detalhes}`);
  } catch (err) {
    mostrarToast("Erro ao carregar histórico.", true);
  }
}

// ===================================================
// TOAST DE FEEDBACK
// ===================================================
function mostrarToast(msg, erro = false) {
  toast.textContent = msg;
  toast.className = erro ? "erro" : "sucesso";
  toast.classList.remove("hidden");

  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}
