// ===========================================
// SERVER.JS - Render Ready + Modal Histórico
// ===========================================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { openDb } from "./db.js";

const app = express();
app.use(express.json());

// ===== CORS =====
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://retirada.vercel.app"
  ],
  credentials: true
}));

// ===== Caminhos =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../public")));

// ====== Rotas ======

// Teste inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Usuário (login Google)
app.post("/api/pacientes/usuario", async (req, res) => {
  const { nome, email } = req.body;
  try {
    const db = await openDb();
    let usuario = await db.get("SELECT * FROM usuarios WHERE email = ?", [email]);
    if (!usuario) {
      await db.run("INSERT INTO usuarios (nome, email) VALUES (?, ?)", [nome, email]);
      usuario = await db.get("SELECT * FROM usuarios WHERE email = ?", [email]);
    }
    res.status(200).json(usuario);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Cadastro paciente
app.post("/api/pacientes/cadastrar", async (req, res) => {
  const { nome, cpf, isHospital, setor, criado_por } = req.body;
  try {
    const db = await openDb();
    const jaExiste = await db.get("SELECT * FROM pacientes WHERE cpf = ?", [cpf]);
    if (jaExiste) {
      return res.status(400).json({ erro: "Paciente já cadastrado com este CPF." });
    }
    await db.run(
      "INSERT INTO pacientes (nome, cpf, isHospital, setor, criado_por) VALUES (?, ?, ?, ?, ?)",
      [nome, cpf, isHospital ? 1 : 0, setor, criado_por]
    );
    res.status(200).json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Consultar pacientes
app.get("/api/pacientes/consultar", async (req, res) => {
  try {
    const db = await openDb();
    const pacientes = await db.all(`
      SELECT p.*, COUNT(s.id) AS total_retiradas
      FROM pacientes p
      LEFT JOIN saidas s ON s.paciente_id = p.id
      GROUP BY p.id
      ORDER BY p.nome ASC
    `);
    res.status(200).json(pacientes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Registrar saída
app.post("/api/pacientes/saida", async (req, res) => {
  const { paciente_id, medicamento, quantidade, tipo, entregue_por } = req.body;
  try {
    const db = await openDb();
    await db.run(
      "INSERT INTO saidas (paciente_id, medicamento, quantidade, tipo, entregue_por) VALUES (?, ?, ?, ?, ?)",
      [paciente_id, medicamento, quantidade, tipo, entregue_por]
    );
    res.status(200).json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Histórico com nome do responsável
app.get("/api/pacientes/historico/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const db = await openDb();
    const historico = await db.all(`
      SELECT s.medicamento, s.quantidade, s.tipo, s.data_entrega,
             u.nome AS entregue_por_nome
      FROM saidas s
      LEFT JOIN usuarios u ON u.id = s.entregue_por
      WHERE s.paciente_id = ?
      ORDER BY s.data_entrega DESC
    `, [id]);
    res.status(200).json(historico);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Logout
app.post("/api/pacientes/logout", (req, res) => {
  res.status(200).json({ sucesso: true });
});

// ===== Inicialização =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
