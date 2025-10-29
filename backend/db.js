// ===========================================
// DB.JS - Conexão com SQLite (Render Ready)
// ===========================================
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "farmacia.db");

export async function openDb() {
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Criação automática das tabelas, caso não existam
    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        email TEXT
      );

      CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        cpf TEXT UNIQUE,
        isHospital INTEGER,
        setor TEXT,
        criado_por INTEGER,
        FOREIGN KEY(criado_por) REFERENCES usuarios(id)
      );

      CREATE TABLE IF NOT EXISTS saidas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER,
        medicamento TEXT,
        quantidade INTEGER,
        tipo TEXT,
        entregue_por INTEGER,
        data_entrega DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY(entregue_por) REFERENCES usuarios(id)
      );
    `);

    return db;
  } catch (error) {
    console.error("❌ Erro ao abrir o banco de dados:", error);
    throw error;
  }
}
