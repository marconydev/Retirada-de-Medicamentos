/* ============================================================
   CONFIGURAÇÕES GERAIS
============================================================ */
const API_URL = window.location.origin; // funciona local e no Render
let usuarioLogado = null;

/* ============================================================
   LOGIN COM GOOGLE
============================================================ */
/* ============================================================
   LOGIN COM GOOGLE - VERSÃO ESTÁVEL
============================================================ */
window.onload = () => {
  const clientId = "888248677437-9blvld347207bc5tnnkse4c6n3r712b0.apps.googleusercontent.com";
  const divLogin = document.getElementById("googleLogin");

  let tentativas = 0;
  const maxTentativas = 15; // ~4.5 segundos no total

  function inicializarGoogle() {
    if (window.google && window.google.accounts && window.google.accounts.id && divLogin) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });

      google.accounts.id.renderButton(divLogin, {
        theme: "filled_blue",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
      });

      console.log("✅ Login Google inicializado com sucesso");
    } else if (tentativas < maxTentativas) {
      tentativas++;
      console.log("⏳ Aguardando SDK do Google carregar...");
      setTimeout(inicializarGoogle, 300);
    } else {
      console.error("❌ Falha ao inicializar o login do Google.");
    }
  }

  inicializarGoogle();
};

/**
 * Função chamada após o login com o Google
 */
async function handleCredentialResponse(response) {
  try {
    const token = response.credential;
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));

    usuarioLogado = {
      nome: payload.name,
      email: payload.email,
    };

    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
    mostrarApp();
  } catch (error) {
    console.error("Erro no login:", error);
    mostrarToast("Erro ao processar o login.", true);
  }
}

/**
 * Exibe a aplicação principal após login
 */
function mostrarApp() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("appSection").classList.remove("hidden");
  document.getElementById("logoutBtn").classList.remove("hidden");

  const user = JSON.parse(localStorage.getItem("usuario"));
  if (user) {
    document.getElementById("nomeUsuario").textContent = user.nome;
  }

  atualizarTabela();
}

/**
 * Logout
 */
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("usuario");
  usuarioLogado = null;
  document.getElementById("appSection").classList.add("hidden");
  document.getElementById("logoutBtn").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
});

/* ============================================================
   FUNÇÕES DE PACIENTES
============================================================ */

/**
 * Atualiza a tabela de pacientes cadastrados
 */
async function atualizarTabela() {
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();

    const tbody = document.querySelector("#tabelaPacientes tbody");
    tbody.innerHTML = "";

    pacientes.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="link">${p.nome}</td>
        <td>${p.cpf}</td>
        <td>${p.setor || "-"}</td>
        <td>${p.total_retiradas || 0}</td>
      `;
      tr.querySelector(".link").onclick = () => carregarHistorico(p.id, p.nome);
      tbody.appendChild(tr);
    });

    atualizarIndicadores(pacientes);
  } catch (err) {
    console.error("Erro ao carregar tabela:", err);
    mostrarToast("Falha ao carregar pacientes.", true);
  }
}

/**
 * Atualiza os indicadores de total de pacientes e saídas
 */
async function atualizarIndicadores(pacientes) {
  try {
    const totalPacientes = pacientes.length;
    document.getElementById("totalPacientes").textContent = totalPacientes;

    let totalSaidas = 0;
    pacientes.forEach((p) => {
      totalSaidas += p.total_retiradas ? parseInt(p.total_retiradas) : 0;
    });

    document.getElementById("totalSaidas").textContent = totalSaidas;
  } catch (error) {
    console.error("Erro ao atualizar indicadores:", error);
  }
}

/* ============================================================
   BUSCA DE PACIENTES
============================================================ */
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

document.getElementById("btnBuscar").addEventListener("click", atualizarTabela);

/* ============================================================
   MODAIS: ABRIR / FECHAR
============================================================ */
function abrirModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function fecharModal(id) {
  document.getElementById(id).classList.add("hidden");
}

document.getElementById("abrirCadastroBtn").onclick = () => abrirModal("modalCadastro");
document.getElementById("abrirSaidaBtn").onclick = () => abrirModal("modalSaida");
document.getElementById("fecharCadastro").onclick = () => fecharModal("modalCadastro");
document.getElementById("fecharSaida").onclick = () => fecharModal("modalSaida");
document.getElementById("fecharHistorico").onclick = () => fecharModal("modalHistorico");

/* ============================================================
   CADASTRO DE PACIENTES
============================================================ */
document.getElementById("cadHospital").addEventListener("change", function () {
  document.getElementById("cadSetor").disabled = !this.checked;
});

/**
 * Validação e envio do cadastro
 */
document.getElementById("formCadastroModal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("cadNome").value.trim();
  const cpf = document.getElementById("cadCpf").value.trim().replace(/\D/g, "");
  const isHospital = document.getElementById("cadHospital").checked;
  const setor = document.getElementById("cadSetor").value.trim();

  if (!nome || !cpf) {
    return mostrarToast("Preencha todos os campos obrigatórios.", true);
  }

  // Validação simples de CPF (tamanho)
  if (cpf.length !== 11) {
    return mostrarToast("CPF inválido.", true);
  }

  const dados = { nome, cpf, isHospital, setor, criado_por: usuarioLogado?.email };

  try {
    const res = await fetch(`${API_URL}/cadastrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    if (res.ok) {
      mostrarToast("Paciente cadastrado com sucesso!");
      e.target.reset();
      atualizarTabela();
      fecharModal("modalCadastro");
    } else {
      const erro = await res.text();
      if (erro.includes("UNIQUE constraint")) {
        mostrarToast("Paciente já cadastrado com este CPF.", true);
      } else {
        mostrarToast("Erro ao cadastrar paciente.", true);
      }
    }
  } catch (error) {
    console.error(error);
    mostrarToast("Erro de conexão ao cadastrar.", true);
  }
});

/* ============================================================
   SAÍDA DE MEDICAMENTOS
============================================================ */
// Ao abrir o modal de saída, carregar pacientes
document.getElementById("abrirSaidaBtn").addEventListener("click", async () => {
  abrirModal("modalSaida");
  try {
    const res = await fetch(`${API_URL}/consultar`);
    const pacientes = await res.json();
    const select = document.getElementById("saidaPacienteSelect");
    select.innerHTML = '<option value="">Selecione um paciente</option>';

    pacientes.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.nome} - ${p.cpf}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar pacientes:", error);
    mostrarToast("Erro ao carregar pacientes.", true);
  }
});

document.getElementById("formSaida").addEventListener("submit", async (e) => {
  e.preventDefault();
  const paciente_id = document.getElementById("saidaPacienteSelect").value;
  const medicamento = document.getElementById("saidaMedicamento").value.trim();
  const quantidade = document.getElementById("saidaQuantidade").value.trim();
  const tipo = document.getElementById("saidaTipo").value.trim();

  if (!paciente_id || !medicamento || !quantidade || !tipo) {
    return mostrarToast("Preencha todos os campos.", true);
  }

  const dados = {
    paciente_id,
    medicamento,
    quantidade,
    tipo,
    entregue_por: usuarioLogado?.email,
  };

  try {
    const res = await fetch(`${API_URL}/saida`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });

    if (res.ok) {
      mostrarToast("Saída registrada com sucesso!");
      e.target.reset();
      atualizarTabela();
      fecharModal("modalSaida");
    } else {
      mostrarToast("Erro ao registrar saída.", true);
    }
  } catch (error) {
    console.error("Erro ao registrar saída:", error);
    mostrarToast("Erro de conexão ao registrar saída.", true);
  }
});

/* ============================================================
   HISTÓRICO DE RETIRADAS
============================================================ */
async function carregarHistorico(pacienteId, nome) {
  try {
    const res = await fetch(`${API_URL}/historico/${pacienteId}`);
    const historico = await res.json();

    const tbody = document.querySelector("#tabelaHistorico tbody");
    tbody.innerHTML = "";

    document.getElementById("historicoPacienteNome").textContent = nome;

    historico.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.medicamento}</td>
        <td>${item.quantidade}</td>
        <td>${item.tipo}</td>
        <td>${new Date(item.data_entrega).toLocaleString("pt-BR")}</td>
        <td>${item.entregue_por || "-"}</td>
      `;
      tbody.appendChild(tr);
    });

    abrirModal("modalHistorico");
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    mostrarToast("Erro ao carregar histórico.", true);
  }
}

/* ============================================================
   TOAST / FEEDBACK VISUAL
============================================================ */
function mostrarToast(msg, erro = false) {
  const toast = document.getElementById("torrada");
  toast.textContent = msg;
  toast.className = erro ? "erro" : "sucesso";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}
