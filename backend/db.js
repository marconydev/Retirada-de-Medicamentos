// ============================================================
// ARQUIVO: db.js
// Função: Responsável por criar e gerenciar o banco SQLite
// ============================================================
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

// Define o caminho absoluto para o banco de dados
const dbDir = path.resolve(__dirname); // pasta atual (backend/)
const dbPath = path.join(dbDir, "farmacia.db");

// Garante que a pasta exista (cria automaticamente se faltar)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log("📁 Pasta de banco criada:", dbDir);
}

// Conecta (ou cria) o banco de dados SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("❌ Erro ao abrir o banco de dados:", err.message);
  else console.log("✅ Banco conectado com sucesso em:", dbPath);
});

// Criação das tabelas (caso não existam)
db.serialize(() => {
  // === Tabela de usuários (login via Google) ===
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL
    )
  `);

  // === Tabela de pacientes ===
  db.run(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cpf TEXT UNIQUE NOT NULL,
      isHospital INTEGER DEFAULT 0,
      setor TEXT,
      criado_por INTEGER,
      FOREIGN KEY(criado_por) REFERENCES usuarios(id)
    )
  `);

  // === Tabela de saídas (retirada de medicamentos) ===
  db.run(`
    CREATE TABLE IF NOT EXISTS saidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paciente_id INTEGER NOT NULL,
      medicamento TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      tipo TEXT,
      data_entrega TEXT DEFAULT (datetime('now', 'localtime')),
      entregue_por INTEGER,
      FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
      FOREIGN KEY(entregue_por) REFERENCES usuarios(id)
    )
  `);
});

// Exporta a conexão para uso no server.js
module.exports = db;
