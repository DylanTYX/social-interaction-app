"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, KeyRound, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Field } from "@/components/ui/field";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { PageContainer, PageHeader } from "@/components/dashboard/page-header";
import { TokenUsageCard } from "@/components/dashboard/token-usage-card";
import { getDisplayName, useCurrentUser } from "@/hooks/use-current-user";
import { useInterviewHistory } from "@/hooks/use-interview-history";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * The sections, in page order. `?section=` scrolls to one, which is how the
 * command palette's "Account & security" and "Export or delete your data" land
 * on the right part of the page.
 */
const SECTIONS = [
  "profile",
  "security",
  "usage",
  "data",
  "privacy",
  "delete",
] as const;
type SectionId = (typeof SECTIONS)[number];

const PAGE_DESCRIPTION =
  "Your account and your data. Interview preferences are chosen each time you set up an interview.";

/**
 * Settings: one page, five sections, each a heading beside its card.
 *
 * It was two tabs, Account and Data, holding five short blocks between them.
 * Everything fits on one screen and a half, so the tabs only hid half of it
 * behind a click and made "where is export?" a guess. Now every section is in
 * view as you scroll, named on the left and acted on on the right, and each
 * card is a list of rows: what it is, what it does, one button.
 *
 * Interview preferences are deliberately not here. The setup wizard is their
 * one home: it remembers your last setup, and every one of its controls sits
 * on a step you pass through to start an interview anyway.
 */
function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, error: authError } = useCurrentUser();
  // One row is enough: the hook reports the total, which is all the delete
  // section needs to say what it would delete.
  const {
    total: sessionCount,
    status: sessionsStatus,
    refresh: refreshSessions,
  } = useInterviewHistory(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  /** The name as last saved, so Save only lights up when something changed. */
  const [savedName, setSavedName] = useState({ first: "", last: "" });
  const [profileState, setProfileState] = useState<SaveState>({ kind: "idle" });

  const [resetState, setResetState] = useState<SaveState>({ kind: "idle" });
  const [exportState, setExportState] = useState<SaveState>({ kind: "idle" });
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);

  // Hydrate profile fields from the Supabase user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const meta = user.user_metadata ?? {};
    const first = typeof meta.first_name === "string" ? meta.first_name : "";
    const last = typeof meta.last_name === "string" ? meta.last_name : "";
    queueMicrotask(() => {
      if (cancelled) return;
      setFirstName(first);
      setLastName(last);
      setSavedName({ first, last });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Scroll to the section a link asked for, once the page has rendered it.
  const requestedSection = searchParams.get("section");
  const isSignedIn = Boolean(user);
  useEffect(() => {
    if (!isSignedIn) return;
    if (!SECTIONS.includes(requestedSection as SectionId)) return;
    document
      .getElementById(`settings-${requestedSection}`)
      ?.scrollIntoView({ block: "start" });
  }, [isSignedIn, requestedSection]);

  const nameChanged =
    firstName.trim() !== savedName.first.trim() ||
    lastName.trim() !== savedName.last.trim();

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setProfileState({ kind: "saving" });
    try {
      const supabase = getSupabaseBrowserClient();
      const fullName = `${firstName} ${lastName}`.trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
        },
      });
      if (error) {
        setProfileState({ kind: "error", message: error.message });
        return;
      }
      setSavedName({ first: firstName.trim(), last: lastName.trim() });
      setProfileState({ kind: "saved" });
      toast.success("Profile saved.");
      router.refresh();
    } catch (error) {
      setProfileState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to save profile.",
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setResetState({ kind: "saving" });
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/login`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo,
      });
      if (error) {
        setResetState({ kind: "error", message: error.message });
        return;
      }
      setResetState({ kind: "saved" });
      toast.success("Password reset email sent.");
    } catch (error) {
      setResetState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send reset email.",
      });
    }
  };

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  const handleExport = async () => {
    setExportState({ kind: "saving" });
    try {
      const response = await fetch("/api/me/export");
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detail?.error ?? `Export failed (HTTP ${response.status}).`,
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `convotrainer-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportState({ kind: "saved" });
      toast.success("Export started.");
    } catch (error) {
      setExportState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to export data.",
      });
    }
  };

  /**
   * Resolves either way, so the dialog closes, and reports a failure as a
   * toast, the way the library pages report a failed delete.
   */
  const handleWipeSessions = async () => {
    try {
      const response = await fetch("/api/me/sessions", { method: "DELETE" });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detail?.error ?? `Delete failed (HTTP ${response.status}).`,
        );
      }
      toast.success("All sessions deleted.");
      void refreshSessions();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete sessions.",
      );
    }
  };

  if (status === "loading") return <SettingsSkeleton />;

  // Signed out and still loading are different states and need different
  // screens: a skeleton that pulses forever gives a signed-out visitor
  // nothing to act on.
  if (!user) {
    return (
      <PageContainer>
        <EmptyStateCard
          title={
            authError ? "We couldn't verify your session" : "You're signed out"
          }
          description={
            authError ?? "Sign in to manage your account and your data."
          }
          primaryAction={{ label: "Sign in", href: "/auth/login" }}
        />
      </PageContainer>
    );
  }

  const email = user.email ?? "";
  const shownName = `${firstName} ${lastName}`.trim() || getDisplayName(user);
  const joined = formatJoined(user.created_at);
  const sessionsKnown = sessionsStatus === "ready";
  const nothingToDelete = sessionsKnown && sessionCount === 0;

  return (
    <PageContainer>
      <PageHeader title="Settings" description={PAGE_DESCRIPTION} />

      <div>
        <SettingsSection
          id="profile"
          title="Profile"
          description="How the app greets you and names you."
        >
          <Card className="gap-0 py-0">
            <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
              <InitialsAvatar name={shownName} size="lg" tone="you" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold tracking-tight text-slate-900">
                  {shownName}
                </p>
                <p className="truncate text-sm text-slate-500">{email}</p>
                {joined && (
                  <p className="text-xs text-slate-500">Joined {joined}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="space-y-6 px-5 py-5">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Field label="First name" htmlFor="firstName">
                    <Input
                      id="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </Field>
                  <Field label="Last name" htmlFor="lastName">
                    <Input
                      id="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </Field>
                </div>
                {/* Read-only, so it is shown as a value rather than as a
                    disabled field that looks as if it might unlock. */}
                <div>
                  <p className="text-sm font-medium text-slate-900">Email</p>
                  <p className="mt-2 text-sm text-slate-700">{email}</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    You sign in with this address. It can&apos;t be changed
                    here.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
                {profileState.kind === "error" ? (
                  <p
                    role="alert"
                    className="mr-auto text-sm text-destructive-emphasis"
                  >
                    {profileState.message}
                  </p>
                ) : (
                  nameChanged && (
                    <p className="mr-auto text-sm text-slate-500">
                      Unsaved changes
                    </p>
                  )
                )}
                <Button
                  type="submit"
                  disabled={!nameChanged || profileState.kind === "saving"}
                >
                  {profileState.kind === "saving" ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </SettingsSection>

        <SettingsSection
          id="security"
          title="Sign-in and security"
          description="Your password and this browser's session."
        >
          <Card className="gap-0 divide-y divide-slate-100 py-0">
            <SettingsRow
              title="Password"
              description={
                resetState.kind === "saved" ? (
                  <span className="text-success-emphasis">
                    Sent. Check your inbox at {email}.
                  </span>
                ) : resetState.kind === "error" ? (
                  <span role="alert" className="text-destructive-emphasis">
                    {resetState.message}
                  </span>
                ) : (
                  <>We email a link to set a new password to {email}.</>
                )
              }
            >
              <Button
                variant="outline"
                onClick={() => void handlePasswordReset()}
                disabled={resetState.kind === "saving"}
              >
                <KeyRound />
                {resetState.kind === "saving"
                  ? "Sending…"
                  : resetState.kind === "saved"
                    ? "Send again"
                    : "Email me a reset link"}
              </Button>
            </SettingsRow>
            <SettingsRow
              title="Sign out of this browser"
              description="Your sessions and documents stay in your account."
            >
              <Button variant="outline" onClick={() => void handleSignOut()}>
                <LogOut />
                Sign out
              </Button>
            </SettingsRow>
          </Card>
        </SettingsSection>

        <SettingsSection
          id="usage"
          title="Usage"
          description="What your practice has cost to run."
        >
          <TokenUsageCard />
        </SettingsSection>

        <SettingsSection
          id="data"
          title="Your data"
          description="A copy of everything you've made here."
        >
          <Card className="gap-0 py-0">
            <SettingsRow
              title="Download a copy"
              description={
                exportState.kind === "error" ? (
                  <span role="alert" className="text-destructive-emphasis">
                    {exportState.message}
                  </span>
                ) : (
                  "A JSON file with your profile, every session and its transcript, your personas and your job descriptions."
                )
              }
            >
              <Button
                variant="outline"
                onClick={() => void handleExport()}
                disabled={exportState.kind === "saving"}
              >
                <Download />
                {exportState.kind === "saving" ? "Preparing…" : "Download"}
              </Button>
            </SettingsRow>
          </Card>
        </SettingsSection>

        {/* Nothing in the product used to name either service, on a tool whose
            first setup step invites you to upload your actual resume. */}
        <SettingsSection
          id="privacy"
          title="Where your data goes"
          description="What leaves this app, and what stays."
        >
          <Card className="gap-0 py-0">
            <dl className="divide-y divide-slate-100">
              <DataFlowRow term="OpenAI">
                Receives your answers, job descriptions and resumes to write
                questions, scores and coaching. Under the API terms it does not
                train on them, but they do leave this app.
              </DataFlowRow>
              <DataFlowRow term="Microsoft Azure Speech">
                Transcribes you when you answer out loud, and speaks the
                interviewer&apos;s replies. This app keeps the transcript, never
                the audio.
              </DataFlowRow>
              <DataFlowRow term="This app">
                Keeps transcripts, scores and documents until you delete them.
                Deleting a session removes its transcript and scores; deleting a
                document removes the document.
              </DataFlowRow>
            </dl>
          </Card>
        </SettingsSection>

        <SettingsSection
          id="delete"
          title="Delete sessions"
          description="Permanent. There is no undo."
        >
          <Card className="gap-0 border-destructive-border py-0">
            <SettingsRow
              title="Delete all sessions"
              description={
                nothingToDelete
                  ? "You have no sessions to delete."
                  : `Deletes ${
                      sessionsKnown
                        ? `all ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`
                        : "every session"
                    } with ${sessionCount === 1 ? "its transcript" : "their transcripts"} and scores. Personas, job descriptions and resumes are kept.`
              }
            >
              <Button
                variant="outline"
                className="border-destructive-border text-destructive-emphasis hover:bg-destructive-subtle hover:text-destructive-emphasis"
                onClick={() => setConfirmWipeOpen(true)}
                disabled={nothingToDelete}
              >
                <Trash2 />
                Delete all sessions
              </Button>
            </SettingsRow>
          </Card>
        </SettingsSection>
      </div>

      <ConfirmDeleteDialog
        open={confirmWipeOpen}
        onOpenChange={setConfirmWipeOpen}
        title="Delete all interview sessions?"
        description={`This permanently deletes ${
          sessionsKnown
            ? `all ${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}`
            : "every session"
        } with ${sessionCount === 1 ? "its transcript" : "their transcripts"} and scores. You can't undo this. Personas, job descriptions and resumes are kept.`}
        confirmLabel="Delete sessions"
        onConfirm={handleWipeSessions}
      />
    </PageContainer>
  );
}

/**
 * A section: its name and a line on the left, its card on the right. Stacked
 * below `lg`. The hairline between sections does what separate pages or tabs
 * used to, without hiding anything.
 */
function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: SectionId;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`settings-${id}`}
      aria-labelledby={`settings-${id}-title`}
      className="grid grid-cols-1 scroll-mt-8 gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10"
    >
      <div>
        <h2
          id={`settings-${id}-title`}
          className="font-display text-lg font-semibold tracking-tight text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** What it is and what it does on the left, one action on the right. */
function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function DataFlowRow({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm font-medium text-slate-900">{term}</dt>
      <dd className="text-sm leading-relaxed text-slate-600">{children}</dd>
    </div>
  );
}

/** "3 Aug 2026", or null when the account date is missing or unreadable. */
function formatJoined(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The page's shape while the account loads, so nothing jumps when it lands. */
function SettingsSkeleton() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description={PAGE_DESCRIPTION} />
      <div>
        {[0, 1].map((index) => (
          <div
            key={index}
            className={cn(
              "grid gap-4 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10",
              index === 0 ? "pt-0" : "border-t border-slate-200",
            )}
          >
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

/**
 * `useSearchParams` opts a page into client-side rendering, and Next requires a
 * Suspense boundary for it. `simulate/setup/page.tsx` wraps its wizard the same
 * way for the same reason.
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsPageInner />
    </Suspense>
  );
}
