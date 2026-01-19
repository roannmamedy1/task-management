import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type AdminRow = {
  id: number;
  title: string;
  status: boolean;
  statusLabel: string;
  createdAt?: string;
  updatedAt?: string;
  priority?: string | number | null;
  assignee?: string | null;
  raw: Record<string, unknown>;
};

export default function Admin() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const navigate = useNavigate();

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem("sb-access-token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/auth/check`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error("Not authenticated");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const token = localStorage.getItem("sb-access-token");
    const streamUrl = token
      ? `${API_BASE}/stream/admin?access_token=${encodeURIComponent(token)}`
      : `${API_BASE}/stream/admin`;

    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      setConnectionStatus("connected");
      setIsLoading(false);
      setIsError(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (Array.isArray(payload)) {
          const parsedRows = payload.map((row, idx) => {
            const statusValue = (row as Record<string, unknown>)?.status;
            const status =
              statusValue === true ||
              statusValue === "done" ||
              statusValue === "completed";
            const statusLabel =
              typeof statusValue === "string"
                ? statusValue
                : status
                  ? "done"
                  : "open";

            const idRaw =
              (row as Record<string, unknown>)?.id ??
              (row as Record<string, unknown>)?.task_id;
            const id = Number(idRaw ?? idx + 1);

            const title =
              (row as Record<string, unknown>)?.title ||
              (row as Record<string, unknown>)?.name ||
              "Untitled task";

            const createdAt =
              ((row as Record<string, unknown>)?.created_at as
                | string
                | undefined) ||
              ((row as Record<string, unknown>)?.createdAt as
                | string
                | undefined);

            const updatedAt =
              ((row as Record<string, unknown>)?.updated_at as
                | string
                | undefined) ||
              ((row as Record<string, unknown>)?.updatedAt as
                | string
                | undefined);

            const priority = (row as Record<string, unknown>)?.priority as
              | string
              | number
              | null;
            const assignee = (row as Record<string, unknown>)?.assignee as
              | string
              | null;

            return {
              id,
              title: String(title),
              status,
              statusLabel: String(statusLabel),
              createdAt,
              updatedAt,
              priority,
              assignee,
              raw: row as Record<string, unknown>,
            };
          });

          setRows(parsedRows);
        }
      } catch (err) {
        console.error("Failed to parse stream data:", err);
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus("disconnected");
      setIsError(true);
      setError(new Error("Connection lost. Reconnecting..."));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((row) => row.status).length;
    const open = total - completed;
    const statuses = new Set(rows.map((row) => row.statusLabel));
    return { total, completed, open, variants: statuses.size };
  }, [rows]);

  const handleReconnect = () => {
    setConnectionStatus("connecting");
    setIsError(false);
    setError(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div
          className="absolute inset-x-0 top-[-12rem] -z-10 transform-gpu blur-3xl"
          aria-hidden
        >
          <div className="mx-auto h-[26rem] w-[42rem] bg-gradient-to-r from-fuchsia-500/30 via-indigo-500/25 to-cyan-400/25 opacity-70" />
        </div>

        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Admin surface
              </p>
              <h1 className="text-4xl md:text-5xl font-semibold mt-2">
                Task Intelligence Desk
              </h1>
              <p className="mt-3 text-slate-400 max-w-2xl">
                Full visibility into raw Supabase records via real-time SSE
                stream. Inspect statuses, metadata, and the exact payload
                returned by the backend.
              </p>
              <div className="mt-4 flex gap-3 text-sm text-cyan-200/80">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 hover:border-cyan-400/70 hover:text-white"
                >
                  ← Back to dashboard
                </Link>
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1.5 hover:border-cyan-400/70 hover:text-white"
                >
                  Admin view
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold ${
                  connectionStatus === "connected"
                    ? "bg-emerald-500/20 text-emerald-100"
                    : connectionStatus === "connecting"
                      ? "bg-amber-500/20 text-amber-100"
                      : "bg-rose-500/20 text-rose-100"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    connectionStatus === "connected"
                      ? "bg-emerald-400"
                      : connectionStatus === "connecting"
                        ? "bg-amber-400"
                        : "bg-rose-400"
                  }`}
                />
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "connecting"
                    ? "Connecting..."
                    : "Disconnected"}
              </div>
              {isError && (
                <button
                  onClick={handleReconnect}
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:scale-[1.02]"
                >
                  Reconnect
                </button>
              )}
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Total records"
              value={stats.total}
              accent="bg-cyan-500/20 text-cyan-100"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              accent="bg-emerald-500/20 text-emerald-100"
            />
            <StatCard
              label="Open"
              value={stats.open}
              accent="bg-amber-500/20 text-amber-100"
            />
            <StatCard
              label="Status variants"
              value={stats.variants}
              accent="bg-indigo-500/20 text-indigo-100"
            />
          </section>

          <section className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Records</h2>
                <p className="text-sm text-slate-400">
                  Raw rows from SSE stream with normalized insights. Updates
                  instantly.
                </p>
              </div>
              {connectionStatus === "connected" && (
                <span className="text-xs text-cyan-300">
                  Live updates enabled
                </span>
              )}
            </div>

            {isLoading ? (
              <AdminSkeleton />
            ) : isError ? (
              <ErrorCard
                message={
                  error instanceof Error
                    ? error.message
                    : "Unable to reach backend"
                }
                onRetry={handleReconnect}
              />
            ) : rows.length === 0 ? (
              <EmptyState onRetry={handleReconnect} />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30">
                <div className="max-h-[70vh] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">ID</th>
                        <th className="px-4 py-3 text-left">Title</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-left">Assignee</th>
                        <th className="px-4 py-3 text-left">Created</th>
                        <th className="px-4 py-3 text-left">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-800/50 transition"
                        >
                          <td className="px-4 py-3 text-slate-200 font-semibold">
                            #{row.id}
                          </td>
                          <td className="px-4 py-3 text-slate-100">
                            {row.title}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill
                              done={row.status}
                              label={row.statusLabel}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-200">
                            {row.priority ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-200">
                            {row.assignee ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {row.createdAt ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {row.updatedAt ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {rows.length > 0 && (
            <section className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">
                  Raw payload (first 1)
                </h3>
                <span className="text-xs text-slate-400">
                  Inspect exact JSON from backend
                </span>
              </div>
              <pre className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200 shadow-inner shadow-black/30">
                {JSON.stringify(rows[0].raw, null, 2)}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/30">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-3xl font-semibold ${accent}`}>{value}</span>
        <span className="text-xs text-slate-500">live</span>
      </div>
    </div>
  );
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition ${
        done
          ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30"
          : "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${done ? "bg-emerald-400" : "bg-amber-400"}`}
      />
      {label}
    </span>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-inner shadow-black/30"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-800" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-400/40 bg-rose-900/30 p-6 text-rose-50 shadow-lg shadow-rose-900/30">
      <p className="text-lg font-semibold">Connection Lost</p>
      <p className="mt-2 text-sm text-rose-100/80">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full bg-rose-400 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-rose-300"
      >
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-200 shadow-lg shadow-black/30">
      <p className="text-lg font-semibold">No admin data</p>
      <p className="mt-2 text-sm text-slate-400">
        Backend responded with an empty list. Add data in Supabase or refresh.
      </p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-full border border-cyan-400/70 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/10"
      >
        Refresh
      </button>
    </div>
  );
}
