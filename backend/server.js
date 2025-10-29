// ============================================================
// SERVIDOR PRINCIPAL - Retirada de Medicamentos
// ============================================================

// Importação das dependências principais
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const db = require("./db"); // conexão com o banco SQLite

// Cria a aplicação Express
const app = express();

// ============================================================
// CONFIGURAÇÕES BÁSICAS DO SERVIDOR
// ============================================================
app.use(cors({
  origin: "http://localhost:3000", // permite acesso do front-end
  credentials: true
}));
app.use(express.json());
app.use(express.static("public"));
app.use(session({
  secret: "farmacia-secret", // chave de sessão
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 15 * 60 * 1000 } // 15 minutos de sessão
}));

// ============================================================
// ROTAS DE USUÁRIOS (LOGIN GOOGLE)
// ============================================================

// Cria ou recupera usuário logado
app.post("/api/pacientes/usuario", (req, res) => {
  const { nome, email } = req.body;
  console.log("🟢 Login de usuário recebido:", nome, email);

  db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, row) => {
    if (err) {
      console.error("❌ Erro ao consultar usuário:", err.message);
      return res.status(500).json({ erro: "Erro ao consultar usuário." });
    }
    if (row) {
      console.log("ℹ️ Usuário já existente:", row);
      req.session.usuario = row;
      return res.json(row);
    } else {
      db.run(
        "INSERT INTO usuarios (nome, email) VALUES (?,?)",
        [nome, email],
        function (err2) {
          if (err2) {
            console.error("❌ Erro ao criar usuário:", err2.message);
            return res.status(500).json({ erro: "Erro ao criar usuário." });
          }
          const novo = { id: this.lastID, nome, email };
          console.log("🆕 Novo usuário criado:", novo);
          req.session.usuario = novo;
          res.json(novo);
        }
      );
    }
  });
});

// Logout (encerra sessão)
app.post("/api/pacientes/logout", (req, res) => {
  req.session.destroy(() => res.json({ sucesso: "Logout efetuado." }));
});

// Retorna usuário logado
app.get("/api/pacientes/me", (req, res) => {
  if (!req.session.usuario)
    return res.status(401).json({ erro: "Sessão expirada." });
  res.json(req.session.usuario);
});

// ============================================================
// ROTAS DE PACIENTES E SAÍDAS
// ============================================================

// Cadastro de paciente
app.post("/api/pacientes/cadastrar", (req, res) => {
  const { nome, cpf, isHospital, setor, criado_por } = req.body;
  console.log("🟢 Tentando cadastrar paciente:", nome, cpf);

  db.get("SELECT * FROM pacientes WHERE cpf = ?", [cpf], (err, row) => {
    if (err) {
      console.error("❌ Erro ao verificar CPF:", err.message);
      return res.status(500).json({ erro: "Erro ao verificar CPF." });
    }
    if (row) return res.status(400).json({ erro: "Paciente já cadastrado." });

    db.run(
      "INSERT INTO pacientes (nome, cpf, isHospital, setor, criado_por) VALUES (?,?,?,?,?)",
      [nome, cpf, isHospital ? 1 : 0, setor || null, criado_por],
      function (err2) {
        if (err2) {
          console.error("❌ Erro ao cadastrar paciente:", err2.message);
          return res.status(500).json({ erro: "Erro ao cadastrar paciente." });
        }
        console.log("✅ Paciente cadastrado com ID:", this.lastID);
        res.json({ sucesso: "Paciente cadastrado com sucesso." });
      }
    );
  });
});

// Registrar saída de medicamento
app.post("/api/pacientes/saida", (req, res) => {
  const { paciente_id, medicamento, quantidade, tipo, entregue_por } = req.body;
  console.log("📦 Registrando saída:", paciente_id, medicamento, quantidade, tipo);

  db.run(
    `INSERT INTO saidas (paciente_id, medicamento, quantidade, tipo, entregue_por)
     VALUES (?,?,?,?,?)`,
    [paciente_id, medicamento, quantidade, tipo, entregue_por],
    function (err) {
      if (err) {
        console.error("❌ Erro ao registrar saída:", err.message);
        return res.status(500).json({ erro: "Erro ao registrar saída." });
      }
      console.log("✅ Saída registrada com ID:", this.lastID);
      res.json({ sucesso: "Saída registrada com sucesso." });
    }
  );
});

// Consultar pacientes agrupados (para o dashboard)
app.get("/api/pacientes/consultar", (req, res) => {
  const sql = `
    SELECT 
      p.id, 
      p.nome, 
      p.cpf, 
      p.setor, 
      COUNT(s.id) AS total_retiradas
    FROM pacientes p
    LEFT JOIN saidas s ON s.paciente_id = p.id
    GROUP BY p.id
    ORDER BY p.nome
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("❌ Erro ao consultar pacientes:", err.message);
      return res.status(500).json({ erro: "Erro ao consultar." });
    }
    console.log("📊 Pacientes retornados:", rows.length);
    res.json(rows);
  });
});

// Histórico de retiradas de um paciente
app.get("/api/pacientes/historico/:id", (req, res) => {
  const { id } = req.params;
  console.log("📜 Solicitando histórico do paciente ID:", id);

  const sql = `
    SELECT 
      s.medicamento, 
      s.quantidade, 
      s.tipo, 
      s.data_entrega,
      u.nome AS entregue_por
    FROM saidas s
    LEFT JOIN usuarios u ON u.id = s.entregue_por
    WHERE s.paciente_id = ?
    ORDER BY s.data_entrega DESC
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      console.error("❌ Erro ao carregar histórico:", err.message);
      return res.status(500).json({ erro: "Erro ao carregar histórico." });
    }
    console.log(`📦 Histórico retornado (${rows.length} registros) para paciente ${id}`);
    res.json(rows);
  });
});

// ============================================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
