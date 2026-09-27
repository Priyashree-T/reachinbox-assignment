import {
  AlertCircle,
  CalendarClock,
  FileText,
  Inbox,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  X,
  Zap
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode
} from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string | null;
}

interface SlackStatus {
  connected: boolean;
  integration?: {
    slackUserId?: string | null;
    teamId?: string | null;
    connectedAt?: string | null;
  };
}

interface EmailRow {
  id: string;
  email: string;
  subject: string;
  scheduledAt: string;
  sentAt?: string;
  status: string;
}

const formatDate = (value: string): string => {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
};

const statusClasses = (status: string): string => {
  switch (status.toUpperCase()) {
    case "SENT":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "PROCESSING":
      return "border-blue-400/20 bg-blue-400/10 text-blue-300";

    case "FAILED":
      return "border-red-400/20 bg-red-400/10 text-red-300";

    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [pageError, setPageError] = useState("");

  const [activeTab, setActiveTab] =
    useState<"scheduled" | "sent">("scheduled");

  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [slack, setSlack] = useState<SlackStatus>({
    connected: false
  });

  const [slackLoading, setSlackLoading] = useState(false);

  const [scheduledEmails, setScheduledEmails] =
    useState<EmailRow[]>([]);

  const [sentEmails] = useState<EmailRow[]>([]);

  const [search, setSearch] = useState("");

  const loadUser = async (): Promise<void> => {
    try {
      setLoadingUser(true);
      setPageError("");

      const response = await fetch(
        `${API_URL}/api/auth/me`,
        {
          credentials: "include"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Authentication session not found."
        );
      }

      const data = await response.json();

      if (!data.success || !data.user) {
        throw new Error(
          "Unable to load authenticated user."
        );
      }

      setUser(data.user);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoadingUser(false);
    }
  };

  const loadSlackStatus = async (): Promise<void> => {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/slack/status`,
        {
          credentials: "include"
        }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      setSlack({
        connected: Boolean(data.connected),
        integration: data.integration
      });
    } catch {
      setSlack({
        connected: false
      });
    }
  };

  useEffect(() => {
    void loadUser();
    void loadSlackStatus();
  }, []);

  const handleLogout = async (): Promise<void> => {
    try {
      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include"
        }
      );
    } finally {
      window.location.href = "/";
    }
  };

  const handleSlackConnect = (): void => {
    window.location.href =
      `${API_URL}/api/auth/slack`;
  };

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([
      loadUser(),
      loadSlackStatus()
    ]);
  };

  const filteredScheduled = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) {
      return scheduledEmails;
    }

    return scheduledEmails.filter(
      (item) =>
        item.email
          .toLowerCase()
          .includes(value) ||
        item.subject
          .toLowerCase()
          .includes(value)
    );
  }, [scheduledEmails, search]);

  const filteredSent = useMemo(() => {
    const value = search.toLowerCase().trim();

    if (!value) {
      return sentEmails;
    }

    return sentEmails.filter(
      (item) =>
        item.email
          .toLowerCase()
          .includes(value) ||
        item.subject
          .toLowerCase()
          .includes(value)
    );
  }, [sentEmails, search]);

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b12]">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Loading ReachInbox...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        error={pageError}
        onRetry={() => void loadUser()}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080b12] text-slate-100">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-[#0b0f17] transition-transform lg:translate-x-0 ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
            <Send className="h-4 w-4 text-white" />
          </div>

          <div>
            <div className="font-semibold tracking-tight">
              ReachInbox
            </div>

            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Email automation
            </div>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          <SidebarItem
            icon={<Inbox className="h-4 w-4" />}
            label="Dashboard"
            active
          />

          <SidebarItem
            icon={
              <CalendarClock className="h-4 w-4" />
            }
            label="Scheduled"
            onClick={() => {
              setActiveTab("scheduled");
              setMobileMenuOpen(false);
            }}
          />

          <SidebarItem
            icon={<Send className="h-4 w-4" />}
            label="Sent"
            onClick={() => {
              setActiveTab("sent");
              setMobileMenuOpen(false);
            }}
          />

          <SidebarItem
            icon={<Users className="h-4 w-4" />}
            label="Audience"
          />

          <SidebarItem
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
          />
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <Avatar user={user} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name || "User"}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <main className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#080b12]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                setMobileMenuOpen(true)
              }
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div>
              <p className="text-sm font-medium text-white">
                Dashboard
              </p>

              <p className="hidden text-xs text-slate-500 sm:block">
                Manage your outbound email campaigns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => void handleRefresh()}
              className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <SlackButton
              connected={slack.connected}
              loading={slackLoading}
              onClick={() => {
                setSlackLoading(true);
                handleSlackConnect();
              }}
            />

            <button
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-3.5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />

              <span className="hidden sm:inline">
                New campaign
              </span>
            </button>

            <Avatar user={user} size="sm" />
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          <section className="mb-7 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-white/[0.02] to-purple-500/10 p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-xs text-indigo-300">
                  <Zap className="h-3.5 w-3.5" />
                  Campaign automation
                </div>

                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Welcome back,{" "}
                  <span className="text-indigo-300">
                    {user.name?.split(" ")[0] ||
                      "there"}
                  </span>
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Schedule personalized email
                  campaigns, control sending speed,
                  and monitor delivery from one
                  workspace.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Scheduled"
                  value={scheduledEmails.length}
                  icon={
                    <CalendarClock className="h-4 w-4" />
                  }
                />

                <MetricCard
                  label="Sent"
                  value={sentEmails.length}
                  icon={
                    <Send className="h-4 w-4" />
                  }
                />

                <MetricCard
                  label="Slack"
                  value={
                    slack.connected
                      ? "ON"
                      : "OFF"
                  }
                  icon={
                    <MessageSquare className="h-4 w-4" />
                  }
                />
              </div>
            </div>
          </section>

          {pageError && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{pageError}</span>
            </div>
          )}

          <section className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">
                Email activity
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Track scheduled and completed emails.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search emails..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-600 focus:border-indigo-400/40 sm:w-64"
                />
              </div>

              <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
                <TabButton
                  active={
                    activeTab === "scheduled"
                  }
                  onClick={() =>
                    setActiveTab("scheduled")
                  }
                  icon={
                    <CalendarClock className="h-3.5 w-3.5" />
                  }
                >
                  Scheduled
                </TabButton>

                <TabButton
                  active={activeTab === "sent"}
                  onClick={() =>
                    setActiveTab("sent")
                  }
                  icon={
                    <Send className="h-3.5 w-3.5" />
                  }
                >
                  Sent
                </TabButton>
              </div>
            </div>
          </section>

          <EmailTable
            rows={
              activeTab === "scheduled"
                ? filteredScheduled
                : filteredSent
            }
            type={activeTab}
            onCreate={() =>
              setComposeOpen(true)
            }
          />

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <InfoCard
              icon={
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
              }
              title="Rate-limit protection"
              description="Redis-backed scheduling keeps email jobs queued when the hourly limit is reached instead of dropping them."
            />

            <InfoCard
              icon={
                <MessageSquare className="h-5 w-5 text-indigo-300" />
              }
              title="Slack notifications"
              description={
                slack.connected
                  ? "Slack is connected and can receive rate-limit notifications."
                  : "Connect Slack to receive rate-limit notifications."
              }
              action={
                !slack.connected ? (
                  <button
                    onClick={handleSlackConnect}
                    className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    Connect Slack →
                  </button>
                ) : undefined
              }
            />
          </section>
        </div>
      </main>

      {composeOpen && (
        <ComposeModal
          onClose={() =>
            setComposeOpen(false)
          }
          onScheduled={(rows) => {
            setScheduledEmails((current) => [
              ...rows,
              ...current
            ]);

            setActiveTab("scheduled");
            setComposeOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LoginScreen({
  error,
  onRetry
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080b12] px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d111a] p-8 shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/20">
          <Mail className="h-6 w-6" />
        </div>

        <h1 className="mt-6 text-center text-2xl font-semibold">
          ReachInbox
        </h1>

        <p className="mt-2 text-center text-sm leading-6 text-slate-500">
          Sign in to manage your email campaigns.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-400">
            {error}
          </div>
        )}

        <a
          href={`${API_URL}/api/auth/google`}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-200"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        <button
          onClick={onRetry}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Check session again
        </button>
      </div>
    </div>
  );
}

function ComposeModal({
  onClose,
  onScheduled
}: {
  onClose: () => void;
  onScheduled: (rows: EmailRow[]) => void;
}) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [startAt, setStartAt] = useState(
    new Date(Date.now() + 60000)
      .toISOString()
      .slice(0, 16)
  );

  const [minDelay, setMinDelay] =
    useState("2");

  const [hourlyLimit, setHourlyLimit] =
    useState("200");

  const [rawLeads, setRawLeads] =
    useState("");

  const [fileName, setFileName] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const leads = useMemo(() => {
    const matches =
      rawLeads.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
      ) || [];

    return Array.from(
      new Set(
        matches.map((email) =>
          email.toLowerCase().trim()
        )
      )
    );
  }, [rawLeads]);

  const handleFile = async (
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);

    const text = await file.text();

    setRawLeads(text);
  };

  const submit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setError("");

    if (!subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!body.trim()) {
      setError("Please enter an email body.");
      return;
    }

    if (leads.length === 0) {
      setError(
        "Add at least one valid email address or upload a file."
      );
      return;
    }

    try {
      setSubmitting(true);

      const isoStartAt =
        new Date(startAt);

      if (Number.isNaN(isoStartAt.getTime())) {
        throw new Error(
          "Please select a valid start time."
        );
      }

      const response = await fetch(
        `${API_URL}/api/campaigns/schedule`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            subject: subject.trim(),
            body: body.trim(),
            startAt:
              isoStartAt.toISOString(),
            minDelaySeconds:
              Number(minDelay),
            hourlyLimit:
              Number(hourlyLimit),
            leads: leads.map((email) => ({
              email
            }))
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to schedule campaign."
        );
      }

      const baseTime =
        isoStartAt.getTime();

      const rows: EmailRow[] =
        leads.map((email, index) => ({
          id:
            `${Date.now()}-${index}-${email}`,
          email,
          subject: subject.trim(),
          scheduledAt:
            new Date(
              baseTime +
                index *
                  Number(minDelay) *
                  1000
            ).toISOString(),
          status: "SCHEDULED"
        }));

      onScheduled(rows);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to schedule campaign."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-6 w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d111a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold">
              Create campaign
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Schedule personalized outbound emails.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="space-y-5 p-5 sm:p-6"
        >
          {error && (
            <div className="flex gap-3 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Subject
            </label>

            <input
              value={subject}
              onChange={(event) =>
                setSubject(
                  event.target.value
                )
              }
              placeholder="Quick question about your team"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-indigo-400/50"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Email body
            </label>

            <textarea
              value={body}
              onChange={(event) =>
                setBody(event.target.value)
              }
              rows={6}
              placeholder="Hi there..."
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 outline-none placeholder:text-slate-600 focus:border-indigo-400/50"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">
                  Recipients
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Paste emails or upload CSV/TXT.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload file
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleFile}
                className="hidden"
              />
            </div>

            <textarea
              value={rawLeads}
              onChange={(event) =>
                setRawLeads(
                  event.target.value
                )
              }
              rows={5}
              placeholder={
                "john@example.com\nsarah@example.com"
              }
              className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs leading-6 outline-none placeholder:text-slate-700 focus:border-indigo-400/50"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {leads.length} email
                {leads.length === 1
                  ? ""
                  : "s"} detected
              </span>

              {fileName && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <FileText className="h-3.5 w-3.5" />
                  {fileName}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Start time"
              type="datetime-local"
              value={startAt}
              onChange={setStartAt}
            />

            <Field
              label="Delay between emails"
              type="number"
              min="0"
              value={minDelay}
              onChange={setMinDelay}
              suffix="sec"
            />

            <Field
              label="Hourly limit"
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={setHourlyLimit}
              suffix="emails"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>

            <button
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Schedule campaign
                </>
              )}
            </button>
          </div>

          <p className="text-center text-[11px] leading-5 text-slate-600">
            Scheduling is handled by the backend
            using persistent BullMQ delayed jobs.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  min,
  suffix
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-slate-400">
        {label}
      </label>

      <div className="relative">
        <input
          type={type}
          min={min}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm outline-none focus:border-indigo-400/50"
        />

        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function EmailTable({
  rows,
  type,
  onCreate
}: {
  rows: EmailRow[];
  type: "scheduled" | "sent";
  onCreate: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            {type === "scheduled" ? (
              <CalendarClock className="h-6 w-6 text-slate-500" />
            ) : (
              <Send className="h-6 w-6 text-slate-500" />
            )}
          </div>

          <h3 className="mt-5 font-medium">
            No {type} emails yet
          </h3>

          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
            {type === "scheduled"
              ? "Create your first campaign and the scheduled emails will appear here."
              : "Once scheduled emails are delivered, they will appear here."}
          </p>

          {type === "scheduled" && (
            <button
              onClick={onCreate}
              className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              Create campaign
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-white/10 bg-white/[0.02]">
            <tr className="text-xs text-slate-500">
              <th className="px-5 py-4 font-medium">
                Recipient
              </th>

              <th className="px-5 py-4 font-medium">
                Subject
              </th>

              <th className="px-5 py-4 font-medium">
                {type === "scheduled"
                  ? "Scheduled time"
                  : "Sent time"}
              </th>

              <th className="px-5 py-4 font-medium">
                Status
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="transition hover:bg-white/[0.02]"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10">
                      <Mail className="h-3.5 w-3.5 text-indigo-300" />
                    </div>

                    <span className="text-sm text-slate-300">
                      {row.email}
                    </span>
                  </div>
                </td>

                <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-400">
                  {row.subject}
                </td>

                <td className="px-5 py-4 text-sm text-slate-500">
                  {formatDate(
                    row.sentAt ||
                      row.scheduledAt
                  )}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusClasses(
                      row.status
                    )}`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-indigo-500/10 text-indigo-300"
          : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  icon
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[11px]">
          {label}
        </span>
      </div>

      <p className="mt-2 text-xl font-semibold">
        {value}
      </p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-medium">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>

          {action && (
            <div className="mt-3">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlackButton({
  connected,
  loading,
  onClick
}: {
  connected: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`hidden items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition sm:flex ${
        connected
          ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5"
      }`}
    >
      <MessageSquare className="h-3.5 w-3.5" />

      {loading
        ? "Connecting..."
        : connected
          ? "Slack connected"
          : "Connect Slack"}
    </button>
  );
}

function Avatar({
  user,
  size
}: {
  user: User;
  size: "sm" | "md";
}) {
  const dimensions =
    size === "sm"
      ? "h-8 w-8 text-xs"
      : "h-12 w-12 text-base";

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name || "User"}
        className={`${dimensions} rounded-full object-cover ring-2 ring-white/10`}
      />
    );
  }

  return (
    <div
      className={`${dimensions} flex items-center justify-center rounded-full bg-indigo-500 font-semibold text-white`}
    >
      {(user.name ||
        user.email ||
        "U")
        .charAt(0)
        .toUpperCase()}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.73-.07-1.43-.2-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.27Z"
      />

      <path
        fill="#34A853"
        d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.55 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.5Z"
      />

      <path
        fill="#FBBC05"
        d="M6.53 13.58A5.86 5.86 0 0 1 6.22 12c0-.55.1-1.08.31-1.58V7.89H3.28A9.5 9.5 0 0 0 2.25 12c0 1.53.37 2.98 1.03 4.11l3.25-2.53Z"
      />

      <path
        fill="#EA4335"
        d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.49 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.11 9.45 6.39 12 6.39Z"
      />
    </svg>
  );
}

export default App;