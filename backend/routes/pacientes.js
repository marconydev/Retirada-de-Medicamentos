const express = require("express");
const router = express.Router();
const db = require("../db");

/* ===================== Utils ===================== */
const onlyDigits = (s = "") => String(s).replace(/\D+/g, "");

// Validação oficial de CPF
function isValidCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (!cpf || cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;

  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

/* ===================== Auth / Sessão ===================== */
router.post("/usuario", async (req, res) => {
  try {
    let { nome, email } = req.body;
    if (!nome || !email) return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
    try { nome = String(nome).normalize("NFC"); } catch (_) {}

    const existente = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM usuarios WHERE email = ?", [email], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });

    let user;
    if (existente.length) {
      user = existente[0];
      if (user.nome !== nome) {
        await new Promise((resolve, reject) => {
          db.run("UPDATE usuarios SET nome = ? WHERE id = ?", [nome, user.id], (err) =>
            err ? reject(err) : resolve()
          );
        });
        user.nome = nome;
      }
    } else {
      await new Promise((resolve, reject) => {
        db.run("INSERT INTO usuarios (nome, email) VALUES (?, ?)", [nome, email], (err) =>
          err ? reject(err) : resolve()
        );
      });
      const novo = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM usuarios WHERE email = ?", [email], (err, rows) =>
          err ? reject(err) : resolve(rows)
        );
      });
      user = novo[0];
    }

    req.session.user = { id: user.id, nome: user.nome, email: user.email, loginAt: Date.now() };
    return res.json(req.session.user);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao registrar usuário: " + e.message });
  }
});

router.get("/me", (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  return res.status(401).json({ erro: "Sessão expirada ou inexistente." });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ sucesso: "Sessão encerrada." }));
});

/* ===================== Pacientes / Saídas ===================== */
// Cadastrar paciente (validação CPF + checagem duplicado; grava só dígitos)
router.post("/cadastrar", async (req, res) => {
  try {
    const { nome, cpf, isHospital, setor, criado_por } = req.body;
    const cpfDigits = onlyDigits(cpf);

    if (!nome || !cpf || (isHospital && !setor)) {
      return res.status(400).json({ erro: "Preencha todos os campos obrigatórios." });
    }
    if (!isValidCPF(cpfDigits)) {
      return res.status(400).json({ erro: "CPF inválido. Verifique e tente novamente." });
    }

    const duplicado = await new Promise((resolve, reject) => {
      db.all("SELECT id FROM pacientes WHERE cpf = ?", [cpfDigits], (err, rows) =>
        err ? reject(err) : resolve(rows)
      );
    });
    if (duplicado.length > 0) {
      return res.status(409).json({ erro: "Já existe um paciente cadastrado com este CPF." });
    }

    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO pacientes (nome, cpf, isHospital, setor, criado_por) VALUES (?, ?, ?, ?, ?)",
        [nome, cpfDigits, isHospital ? 1 : 0, setor || null, criado_por || (req.session.user && req.session.user.id) || null],
        (err) => err ? reject(err) : resolve()
      );
    });

    return res.json({ sucesso: "Paciente cadastrado com sucesso!" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao cadastrar paciente: " + e.message });
  }
});

// Consultar pacientes + saídas + quem liberou
router.get("/consultar", async (req, res) => {
  try {
    const { nome, cpf, setor } = req.query;
    let sql = `
      SELECT 
        p.id, p.nome, p.cpf, p.setor, p.isHospital,
        s.medicamento, s.quantidade, s.tipo, s.data_entrega,
        u.nome AS entregue_por
      FROM pacientes p
      LEFT JOIN saidas s ON p.id = s.paciente_id
      LEFT JOIN usuarios u ON s.entregue_por = u.id
      WHERE 1=1
    `;
    const params = [];
    if (nome) { sql += " AND p.nome LIKE ?"; params.push(`%${nome}%`); }
    if (cpf)  { sql += " AND p.cpf LIKE ?";  params.push(`%${onlyDigits(cpf)}%`); }
    if (setor){ sql += " AND p.setor LIKE ?";params.push(`%${setor}%`); }
    sql += " ORDER BY p.id DESC, s.data_entrega DESC";

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, params, (err, r) => err ? reject(err) : resolve(r));
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: "Erro ao consultar pacientes: " + e.message });
  }
});

// Registrar saída
router.post("/saida", async (req, res) => {
  try {
    const { paciente_id, medicamento, quantidade, tipo, entregue_por } = req.body;
    if (!paciente_id || !medicamento || !quantidade || !tipo) {
      return res.status(400).json({ erro: "Preencha todos os campos." });
    }
    const dataEntrega = new Date().toISOString().slice(0, 10);
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO saidas (paciente_id, medicamento, quantidade, tipo, data_entrega, entregue_por) VALUES (?, ?, ?, ?, ?, ?)",
        [Number(paciente_id), String(medicamento), Number(quantidade), String(tipo), dataEntrega, entregue_por || (req.session.user && req.session.user.id) || null],
        (err) => err ? reject(err) : resolve()
      );
    });
    res.json({ sucesso: "Saída de medicamento registrada com sucesso!" });
  } catch (e) {
    res.status(500).json({ erro: "Erro ao registrar saída: " + e.message });
  }
});

module.exports = router;
