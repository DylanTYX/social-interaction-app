"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  SlidersHorizontal,
  ShieldCheck,
  Database,
  Download,
  LogOut,
  LogIn,
  Trash2,
  KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { useCurrentUser, getDisplayName } from "@/hooks/use-current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createDefaultInterviewSetup,
  loadInterviewSetup,
  saveInterviewSetup,
  type PracticeMode,
  type VoiceSetupConfig,
} from "@/lib/interview-setup";
import { toast } from "sonner";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

/**
 * Three tabs, down from five.
 *
 * Profile and Account were separate tabs holding one card each — and the
 * Account tab was two buttons, one of which (Sign out) the sidebar already
 * carries. Defaults and Voice were both "what the setup wizard starts with",
 * split across two tabs for no reason a user could reconstruct. Data stays.
 */
const SETTINGS_TABS = ["account", "interview", "data"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

/** Old deep links keep working: five tab names map onto the three that exist. */
const LEGACY_TAB_ALIASES: Record<string, SettingsTab> = {
  profile: "account",
  defaults: "interview",
  voice: "interview",
};

/**
 * A labelled switch on its own bordered row — the shape this page used to
 * copy-paste five times with five chances to drift.
 */
function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, status, error: authError } = useCurrentUser();

  /**
   * Which tab is open, mirrored in `?tab=` so the sidebar, the command palette
   * and the back button can address a specific tab. Read against an allowlist
   * (plus the legacy aliases) so an unrecognised value falls back rather than
   * rendering an empty tab.
   */
  const [tab, setTab] = useState<SettingsTab>(() => {
    const requested = searchParams.get("tab") ?? "";
    if (SETTINGS_TABS.includes(requested as SettingsTab)) {
      return requested as SettingsTab;
    }
    return LEGACY_TAB_ALIASES[requested] ?? "account";
  });

  const handleTabChange = (next: string) => {
    setTab(next as SettingsTab);
    // `replace`, not `push`: flipping tabs should not fill the history stack,
    // but the URL still has to be copyable. `scroll: false` stops a long tab
    // from jumping to the top.
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/dashboard/settings?${params.toString()}`, {
      scroll: false,
    });
  };

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileState, setProfileState] = useState<SaveState>({ kind: "idle" });

  const defaultSetup = useMemo(() => createDefaultInterviewSetup(), []);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>(
    defaultSetup.practiceMode,
  );
  const [streaming, setStreaming] = useState(defaultSetup.streamResponses);
  const [liveCoaching, setLiveCoaching] = useState(
    defaultSetup.liveCoachingEnabled,
  );
  const [voiceConfig, setVoiceConfig] = useState<VoiceSetupConfig>(
    defaultSetup.voiceConfig,
  );

  const [resetState, setResetState] = useState<SaveState>({ kind: "idle" });
  const [exportState, setExportState] = useState<SaveState>({ kind: "idle" });
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [wipeState, setWipeState] = useState<SaveState>({ kind: "idle" });

  // Hydrate profile fields from Supabase user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const meta = user.user_metadata ?? {};
    queueMicrotask(() => {
      if (cancelled) return;
      setFirstName(typeof meta.first_name === "string" ? meta.first_name : "");
      setLastName(typeof meta.last_name === "string" ? meta.last_name : "");
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Hydrate interview preferences from localStorage on first mount.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const saved = loadInterviewSetup();
      if (saved) {
        setPracticeMode(saved.practiceMode);
        setStreaming(saved.streamResponses);
        setLiveCoaching(saved.liveCoachingEnabled);
        setVoiceConfig(saved.voiceConfig);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * Interview preferences persist on change — no Save button.
   *
   * The old tabs had explicit "Save defaults" / "Save voice preferences"
   * buttons in front of a localStorage write, which is ceremony: nothing can
   * meaningfully fail except storage itself (a private window, cleared site
   * data), so a flipped switch just saves, and only a failure says anything.
   */
  const persistSetup = (updates: {
    practiceMode?: PracticeMode;
    streamResponses?: boolean;
    liveCoachingEnabled?: boolean;
    voiceConfig?: VoiceSetupConfig;
  }) => {
    try {
      const current = loadInterviewSetup() ?? createDefaultInterviewSetup();
      saveInterviewSetup({
        ...current,
        practiceMode: updates.practiceMode ?? current.practiceMode,
        streamResponses: updates.streamResponses ?? current.streamResponses,
        liveCoachingEnabled:
          updates.liveCoachingEnabled ?? current.liveCoachingEnabled,
        voiceConfig: updates.voiceConfig ?? current.voiceConfig,
      });
    } catch {
      toast.error("Could not save — your browser is blocking site storage.");
    }
  };

  const changePracticeMode = (next: PracticeMode) => {
    setPracticeMode(next);
    persistSetup({ practiceMode: next });
  };
  const changeStreaming = (next: boolean) => {
    setStreaming(next);
    persistSetup({ streamResponses: next });
  };
  const changeLiveCoaching = (next: boolean) => {
    setLiveCoaching(next);
    persistSetup({ liveCoachingEnabled: next });
  };
  const changeVoiceConfig = (patch: Partial<VoiceSetupConfig>) => {
    setVoiceConfig((current) => {
      const next = { ...current, ...patch };
      persistSetup({ voiceConfig: next });
      return next;
    });
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

  const handleWipeSessions = async () => {
    setWipeState({ kind: "saving" });
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
      setWipeState({ kind: "saved" });
      toast.success("All sessions deleted.");
      setConfirmWipeOpen(false);
      router.refresh();
    } catch (error) {
      setWipeState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete sessions.",
      });
    }
  };

  if (status === "loading") {
    return (
      <div className="p-8">
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  // `!user` used to share the skeleton branch above, so a signed-out visitor
  // watched a placeholder pulse forever with nothing to act on. Signed out and
  // still loading are different states and need different screens.
  if (!user) {
    return (
      <div className="p-8">
        <EmptyStateCard
          icon={<LogIn className="h-6 w-6" />}
          title={
            authError ? "We couldn't verify your session" : "You're signed out"
          }
          description={
            authError ??
            "Sign in to change your practice defaults, manage your voice, or export your data."
          }
          primaryAction={{ label: "Sign in", href: "/auth/login" }}
        />
      </div>
    );
  }

  const displayName = getDisplayName(user);

  return (
    // The shared dashboard wrapper. This was the one dashboard page without
    // the gradient, which made Settings read as a different app.
    <div className="p-8 space-y-8 bg-linear-to-br from-slate-50 via-white to-slate-50/50">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your account, interview preferences, and data."
        icon={<SettingsIcon className="h-6 w-6" />}
        iconColor="blue"
      />

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="account" className="gap-2" aria-label="Account">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </TabsTrigger>
          <TabsTrigger
            value="interview"
            className="gap-2"
            aria-label="Interview"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Interview</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2" aria-label="Data">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Shown in the navbar and used to greet you in the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {/* Your own avatar, derived from your name like every other
                    one — a persona you built and "this is you" should not
                    share a fixed gradient. */}
                <InitialsAvatar
                  name={`${firstName} ${lastName}`.trim() || displayName}
                  size="lg"
                  shape="square"
                />
                <div>
                  <p className="font-semibold text-slate-900">
                    {`${firstName} ${lastName}`.trim() || user.email}
                  </p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="First name" htmlFor="firstName">
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                    />
                  </Field>
                  <Field label="Last name" htmlFor="lastName">
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                    />
                  </Field>
                </div>

                <Field
                  label="Email"
                  htmlFor="email"
                  hint="Your email is the one you sign in with."
                >
                  <Input
                    id="email"
                    type="email"
                    value={user.email ?? ""}
                    disabled
                  />
                </Field>

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    disabled={profileState.kind === "saving"}
                  >
                    {profileState.kind === "saving"
                      ? "Saving..."
                      : "Save profile"}
                  </Button>
                  {profileState.kind === "error" && (
                    <span className="text-sm text-destructive">
                      {profileState.message}
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Manage your password and current session.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handlePasswordReset()}
                  disabled={resetState.kind === "saving"}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {resetState.kind === "saving"
                    ? "Sending..."
                    : "Send password reset email"}
                </Button>
                {resetState.kind === "saved" && (
                  <span className="text-sm text-success">
                    Sent. Check your inbox.
                  </span>
                )}
                {resetState.kind === "error" && (
                  <span className="text-sm text-destructive">
                    {resetState.message}
                  </span>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  className="gap-2"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
                <p className="text-sm text-slate-500">
                  Signs you out of this browser. Your data stays in your
                  account.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview" className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Interview preferences</CardTitle>
              {/* Honest about what this record is. These keys are the same
                  ones the wizard persists on every run, so a value set here
                  lasts until the next session changes it — this page edits
                  the starting point, it does not pin a permanent default. */}
              <CardDescription>
                What the setup wizard starts with. Running an interview updates
                these to match, so they always reflect your most recent setup —
                change them here to change the next starting point. Saved as you
                change them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Field label="Practice mode" htmlFor="settings-default-mode">
                <Select value={practiceMode} onValueChange={changePracticeMode}>
                  <SelectTrigger
                    id="settings-default-mode"
                    className="w-full sm:w-64"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text interview</SelectItem>
                    <SelectItem value="voice">Voice interview</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <ToggleRow
                id="settings-stream-responses"
                label="Stream responses"
                description="Replies appear token-by-token as they're generated."
                checked={streaming}
                onCheckedChange={changeStreaming}
              />
              <ToggleRow
                id="settings-live-coaching"
                label="Live coaching"
                description="Shows strengths and improvement tips after each reply."
                checked={liveCoaching}
                onCheckedChange={changeLiveCoaching}
              />

              <Separator />

              <div className="space-y-1">
                <h3 className="text-sm font-medium text-slate-900">Voice</h3>
                <p className="text-xs text-slate-500">
                  Applies when the interview runs in voice mode.
                </p>
              </div>

              <ToggleRow
                id="settings-text-to-speech"
                label="Interviewer speaks"
                description="Plays the interviewer's replies as audio."
                checked={voiceConfig.ttsEnabled}
                onCheckedChange={(checked) =>
                  changeVoiceConfig({ ttsEnabled: checked })
                }
              />
              <ToggleRow
                id="settings-accents"
                label="Interviewer accents"
                description="Interviewers speak English with the accent their nationality suggests. Turn off for neutral English throughout."
                checked={voiceConfig.accentsEnabled}
                onCheckedChange={(checked) =>
                  changeVoiceConfig({ accentsEnabled: checked })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Your data</CardTitle>
              <CardDescription>
                Export everything you&apos;ve created or wipe your interview
                history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleExport()}
                  disabled={exportState.kind === "saving"}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportState.kind === "saving"
                    ? "Preparing..."
                    : "Export my data"}
                </Button>
                {exportState.kind === "saved" && (
                  <span className="text-sm text-success">
                    Download started.
                  </span>
                )}
                {exportState.kind === "error" && (
                  <span className="text-sm text-destructive">
                    {exportState.message}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Includes profile, sessions (with full transcripts), personas,
                and job descriptions as a JSON file.
              </p>

              <Separator />

              {/* Nothing in the product said any of this. Neither "OpenAI" nor
                  "Azure" appeared in a single rendered string, on a tool whose
                  first setup step invites you to upload your actual resume. */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-900">
                  Where your data goes
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-500">
                  <li>
                    <span className="font-medium text-slate-700">
                      Your answers, job descriptions and resume
                    </span>{" "}
                    are sent to OpenAI to generate questions, scores and
                    coaching. They are not used to train their models under the
                    API terms, but they do leave this app.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">
                      Your voice
                    </span>{" "}
                    is streamed to Microsoft Azure Speech for transcription
                    during a voice interview, and the interviewer&apos;s replies
                    are synthesised there. Audio is not stored by this app —
                    only the transcript is.
                  </li>
                  <li>
                    <span className="font-medium text-slate-700">
                      Transcripts, scores and documents
                    </span>{" "}
                    are kept until you delete them. Deleting a session removes
                    its transcript and scores; deleting a resume or job
                    description removes that document.
                  </li>
                </ul>
              </div>

              <Separator />

              <div className="space-y-2 rounded-xl border border-destructive-border bg-destructive-subtle/50 p-4">
                <p className="font-semibold text-destructive-emphasis">
                  Danger zone
                </p>
                <p className="text-sm text-destructive-emphasis/80">
                  Permanently delete every interview session and its transcript.
                  Personas and job descriptions are kept.
                </p>
                <Button
                  variant="outline"
                  className="border-destructive-border bg-white text-destructive-emphasis hover:bg-destructive-muted"
                  onClick={() => setConfirmWipeOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete all sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmWipeOpen} onOpenChange={setConfirmWipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all interview sessions?</DialogTitle>
            <DialogDescription>
              This permanently removes every session and its full transcript.
              You can&apos;t undo this. Personas and job descriptions are kept.
            </DialogDescription>
          </DialogHeader>
          {wipeState.kind === "error" && (
            <div className="rounded-md border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-emphasis">
              {wipeState.message}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmWipeOpen(false)}
              disabled={wipeState.kind === "saving"}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-destructive-border bg-destructive text-white hover:bg-destructive-emphasis"
              onClick={() => void handleWipeSessions()}
              disabled={wipeState.kind === "saving"}
            >
              {wipeState.kind === "saving" ? "Deleting..." : "Delete sessions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * `useSearchParams` opts a page into client-side rendering, and Next requires a
 * Suspense boundary for it. `simulate/setup/page.tsx` wraps its wizard the same
 * way for the same reason.
 */
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Skeleton className="h-32 rounded-xl" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}
