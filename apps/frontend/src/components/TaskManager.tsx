import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Trash2, Edit2, Plus, AlertCircle } from 'lucide-react';

type Task = {
  id: number;
  title: string;
  status: boolean;
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE}/stream/tasks`);

    eventSource.onopen = () => {
      setConnectionStatus('connected');
      setIsLoading(false);
      setIsError(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setTasks(
            data.map((task) => ({
              id: Number(task.id),
              title: task.title ?? 'Untitled task',
              status: task.status === true || task.status === 'done',
            }))
          );
        }
      } catch (err) {
        console.error('Failed to parse stream data:', err);
      }
    };

    eventSource.onerror = () => {
      setConnectionStatus('disconnected');
      setIsError(true);
      setError(new Error('Connection lost. Reconnecting...'));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status).length;
    const open = total - completed;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, open, completionRate };
  }, [tasks]);

  const handleReconnect = () => {
    setConnectionStatus('connecting');
    setIsError(false);
    setError(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu blur-3xl" aria-hidden>
          <div className="mx-auto h-[24rem] w-[36rem] bg-gradient-to-r from-indigo-500/40 via-cyan-400/30 to-emerald-400/40 opacity-60" />
        </div>

        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                Live Supabase Data (Real-time via SSE)
              </p>
              <h1 className="text-4xl md:text-5xl font-semibold mt-2">Task Control Room</h1>
              <p className="mt-3 text-slate-400 max-w-xl">
                Powered by NestJS + Supabase + Server-Sent Events. Manage your tasks in real-time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-100'
                    : connectionStatus === 'connecting'
                      ? 'bg-amber-500/20 text-amber-100'
                      : 'bg-rose-500/20 text-rose-100'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full animate-pulse ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400'
                      : connectionStatus === 'connecting'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                  }`}
                />
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Disconnected'}
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

          <section className="grid gap-4 md:grid-cols-4 mb-10">
            <StatCard
              label="Total tasks"
              value={stats.total}
              accent="bg-cyan-500/20 text-cyan-100"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              accent="bg-emerald-500/20 text-emerald-100"
            />
            <StatCard label="Open" value={stats.open} accent="bg-amber-500/20 text-amber-100" />
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Completion</span>
                <span className="text-slate-200 font-semibold">{stats.completionRate}%</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-300 transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Real-time from SSE stream</p>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Tasks</h2>
                {connectionStatus === 'connected' && (
                  <span className="text-xs text-cyan-300 mt-1 block">Live updates enabled</span>
                )}
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm">
                    <Plus className="w-4 h-4" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add New Task</DialogTitle>
                  </DialogHeader>
                  <AddTaskForm onSuccess={() => setIsAddDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <TaskSkeletonList />
            ) : isError ? (
              <ErrorCard message={error instanceof Error ? error.message : 'Unable to reach backend'} onRetry={handleReconnect} />
            ) : tasks.length === 0 ? (
              <EmptyState onRetry={handleReconnect} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={(t) => {
                      setEditingTask(t);
                      setIsEditDialogOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {editingTask && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="bg-slate-900 border-slate-800">
                <DialogHeader>
                  <DialogTitle className="text-white">Edit Task</DialogTitle>
                </DialogHeader>
                <EditTaskForm
                  task={editingTask}
                  onSuccess={() => {
                    setIsEditDialogOpen(false);
                    setEditingTask(null);
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/task/${task.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusToggle = async () => {
    try {
      const newStatus = task.status ? 'open' : 'done';
      const response = await fetch(`${API_BASE}/task/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update task');
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg shadow-black/30 transition hover:-translate-y-1 hover:border-cyan-400/60 animate-in fade-in duration-300">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-60" />
      <div className="flex items-start gap-3">
        <span className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${task.status ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100'}`}>
          #{task.id}
        </span>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${task.status ? 'line-through text-slate-400' : 'text-white'}`}>
            {task.title}
          </h3>
          <p className="text-sm text-slate-400 mt-1">Real-time from Supabase</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill done={task.status} onClick={handleStatusToggle} />
        </div>
      </div>
      <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(task)}
          className="flex-1 border-slate-700 text-black hover:bg-slate-800"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="flex-1"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </div>
    </article>
  );
}

function AddTaskForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create task');
      }

      setTitle('');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Task Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Enter task title..."
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          disabled={isLoading}
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}

function EditTaskForm({ task, onSuccess }: { task: Task; onSuccess: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState(task.status ? 'done' : 'open');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/task/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), status }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update task');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Task Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setError(null);
          }}
          placeholder="Enter task title..."
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          disabled={isLoading}
        >
          <option value="open">Open</option>
          <option value="done">Done</option>
        </select>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex gap-3 justify-end">
        <Button type="submit" disabled={isLoading} className="gap-2">
          {isLoading ? 'Updating...' : 'Update Task'}
        </Button>
      </div>
    </form>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
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

function StatusPill({ done, onClick }: { done: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
        done
          ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25'
          : 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30 hover:bg-amber-500/25'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${done ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {done ? 'Done' : 'Open'}
    </button>
  );
}

function TaskSkeletonList() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <div
          key={key}
          className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-inner shadow-black/30"
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-800" />
            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-slate-800" />
              <div className="mt-2 h-3 w-24 rounded bg-slate-800" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-400/40 bg-rose-900/30 p-6 text-rose-50 shadow-lg shadow-rose-900/30">
      <p className="text-lg font-semibold flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        Connection Lost
      </p>
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
      <p className="text-lg font-semibold">No tasks found</p>
      <p className="mt-2 text-sm text-slate-400">
        Backend responded with an empty list. Add your first task to get started.
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
