/**
 * TaskFlow — TypeScript Type Definitions
 * Compile com: tsc --noEmit (apenas checagem de tipos)
 */

// ──── Enums ────
type Priority = "low" | "medium" | "high";
type FilterStatus = "all" | "pending" | "completed";
type ToastType = "success" | "error" | "info";

// ──── Entidades da API ────
interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string; // ISO 8601
}

interface Task {
  id: number;
  title: string;
  description: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null; // ISO 8601
  created_at: string;
  updated_at: string | null;
  owner_id: number;
}

// ──── Payloads de requisição ────
interface LoginResponse {
  access_token: string;
  token_type: "bearer";
}

interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: Priority;
  due_date?: string | null;
}

interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
  completed?: boolean;
}

interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
}

// ──── Estado da aplicação ────
interface AppState {
  token: string | null;
  user: User | null;
  tasks: Task[];
  filtered: Task[];
  filterStatus: FilterStatus;
  filterPriority: Priority | "all";
  searchQuery: string;
  deleteTargetId: number | null;
  ws: WebSocket | null;
}

// ──── WebSocket messages ────
interface WSMessage {
  type: "connected" | "task_created" | "task_updated" | "task_deleted" | "broadcast";
  payload?: unknown;
  user_id?: string;
}

// ──── Configuração da API ────
interface APIConfig {
  BASE: string;
  WS: string;
}

// ──── Elementos do DOM (para referência) ────
interface AppElements {
  authSection: HTMLDivElement;
  appSection: HTMLDivElement;
  taskList: HTMLDivElement;
  taskModal: HTMLDivElement;
  confirmModal: HTMLDivElement;
  notifications: HTMLDivElement;
  [key: string]: HTMLElement;
}
