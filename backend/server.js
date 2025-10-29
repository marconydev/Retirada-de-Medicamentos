// ==============================================
// SERVER.JS - BACKEND COMPLETO E CORRIGIDO
// ==============================================

import express from "express";
import cors from "cors";
import { openDb } from "./db.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

// Diretórios para rodar no Render e local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================
// SERVE OS ARQUIVOS DO FRONTEND
// ==============================================
app.use(express.static(path.join(__dirname, "../public")));

// ==============================================
// ROTAS DE TESTE / STATUS
// ==============================================
app.get("/api/teste", (req, res) => {
  res.json({ ok: true, msg: "API funcionando corretamente ✅" });
});

// ==============================================
// ROTAS DE PACIENTES E SAÍDAS
// ==============================================

// CONSULTAR TODOS OS PACIENTES + TOTAL DE RETIRADAS
app.get("/consultar", async (req, res) => {
  try {
    const db = await openDb();
    const pacientes = await db.all(`
      SELECT p.*, COUNT(s.id) AS total_retiradas
      FROM pacientes p
      LEFT JOIN saidas s ON p.id = s.paciente_id
      GROUP BY p.id
      ORDER BY p.nome ASC
    `);
    res.json(pacientes);
  } catch (error) {
    console.error("Erro ao consultar pacientes:", error);
    res.status(500).send("Erro ao consultar pacientes.");
  }
});

// CADASTRAR PACIENTE
app.post("/cadastrar", async (req, res) => {
  try {
    const { nome, cpf, isHospital, setor, criado_por } = req.body;
    const db = await openDb();

    // Validação de CPF duplicado
    const existente = await db.get("SELECT * FROM pacientes WHERE cpf = ?", [cpf]);
    if (existente) {
      return res.status(400).send("Paciente já cadastrado.");
    }

    await db.run(
      "INSERT INTO pacientes (nome, cpf, isHospital, setor, criado_por) VALUES (?, ?, ?, ?, ?)",
      [nome, cpf, isHospital ? 1 : 0, setor || null, criado_por || null]
    );

    res.status(200).send("Paciente cadastrado com sucesso!");
  } catch (error) {
    console.error("Erro ao cadastrar paciente:", error);
    res.status(500).send("Erro ao cadastrar paciente.");
  }
});

// REGISTRAR SAÍDA DE MEDICAMENTO
app.post("/saida", async (req, res) => {
  try {
    const { paciente_id, medicamento, quantidade, tipo, entregue_por } = req.body;
    const db = await openDb();

    await db.run(
      "INSERT INTO saidas (paciente_id, medicamento, quantidade, tipo, entregue_por) VALUES (?, ?, ?, ?, ?)",
      [paciente_id, medicamento, quantidade, tipo, entregue_por]
    );

    res.status(200).send("Saída registrada com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar saída:", error);
    res.status(500).send("Erro ao registrar saída.");
  }
});

// HISTÓRICO DE RETIRADAS POR PACIENTE
app.get("/historico/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = await openDb();
    const historico = await db.all(
      "SELECT * FROM saidas WHERE paciente_id = ? ORDER BY data_entrega DESC",
      [id]
    );
    res.json(historico);
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    res.status(500).send("Erro ao carregar histórico.");
  }
});

// ==============================================
// ROTA FINAL (SPA FALLBACK)
// ==============================================
// Se nenhuma rota acima for atendida, envia o index.html do front
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ==============================================
// INICIALIZA O SERVIDOR
// ==============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
