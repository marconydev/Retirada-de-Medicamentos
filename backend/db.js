import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function openDb() {
  const dbPath = path.join(__dirname, "farmacia.db");

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      email TEXT
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pacientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      cpf TEXT UNIQUE,
      isHospital INTEGER,
      setor TEXT,
      criado_por INTEGER,
      FOREIGN KEY (criado_por) REFERENCES usuarios(id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS saidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paciente_id INTEGER,
      medicamento TEXT,
      quantidade INTEGER,
      tipo TEXT,
      entregue_por INTEGER,
      data_entrega TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
      FOREIGN KEY (entregue_por) REFERENCES usuarios(id)
    )
  `);

  return db;
}
