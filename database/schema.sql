-- ============================================================
--  TaskFlow — Schema do Banco de Dados (SQLite / PostgreSQL)
--  Linguagem: SQL
-- ============================================================

-- Extensão de UUID (PostgreSQL; remova para SQLite)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABELA: users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_username_len CHECK (LENGTH(username) >= 3),
    CONSTRAINT chk_email_format CHECK (email LIKE '%@%')
);

-- ─── TABELA: tasks ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR(200) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    completed   BOOLEAN      NOT NULL DEFAULT FALSE,
    priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    due_date    TIMESTAMP,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP,
    owner_id    INTEGER      NOT NULL,

    CONSTRAINT fk_tasks_user
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_title_len
        CHECK (LENGTH(TRIM(title)) > 0)
);

-- ─── ÍNDICES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id  ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(owner_id, completed);
CREATE INDEX IF NOT EXISTS idx_tasks_priority  ON tasks(owner_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date  ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);

-- ─── TRIGGER: atualizar updated_at ──────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ─── VIEW: resumo por usuário ────────────────────────────────
CREATE VIEW IF NOT EXISTS v_user_task_summary AS
SELECT
    u.id         AS user_id,
    u.username,
    COUNT(t.id)                                        AS total_tasks,
    SUM(CASE WHEN t.completed = TRUE  THEN 1 ELSE 0 END) AS completed,
    SUM(CASE WHEN t.completed = FALSE THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN t.priority = 'high' AND t.completed = FALSE THEN 1 ELSE 0 END) AS high_priority_pending
FROM users u
LEFT JOIN tasks t ON t.owner_id = u.id
GROUP BY u.id, u.username;

-- ─── SEED: dados de exemplo ──────────────────────────────────
-- (remova em produção)
INSERT OR IGNORE INTO users (username, email, hashed_password) VALUES
    ('demo', 'demo@taskflow.dev', '$2b$12$placeholder_hash_troque_isso');

-- Exemplo de query útil:
-- SELECT * FROM v_user_task_summary WHERE user_id = 1;
-- SELECT * FROM tasks WHERE owner_id = 1 AND completed = FALSE ORDER BY priority DESC, due_date ASC;
