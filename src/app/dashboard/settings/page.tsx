"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  User,
  SlidersHorizontal,
  Mic,
  ShieldCheck,
  Download,
  LogOut,
  Trash2,
  KeyRound,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useCurrentUser, getInitials } from "@/hooks/use-current-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createDefaultInterviewSetup,
  loadInterviewSetup,
  saveInterviewSetup,
  type PracticeMode,
  type VoiceSetupConfig,
} from "@/lib/interview-setup";
import { getSpeechService } from "@/lib/speechService";
import { toast } from "sonner";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

interface VoiceOption {
  name: string;
  uri: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, status } = useCurrentUser();

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
  const [defaultsState, setDefaultsState] = useState<SaveState>({
    kind: "idle",
  });

  const [voiceConfig, setVoiceConfig] = useState<VoiceSetupConfig>(
    defaultSetup.voiceConfig,
  );
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [voiceState, setVoiceState] = useState<SaveState>({ kind: "idle" });

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

  // Hydrate interview defaults from localStorage on first mount.
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

  // Curated voice list comes from the speech service (static).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const speech = getSpeechService();
        setVoiceOptions(speech.getAvailableVoices());
      } catch {
        // Browser without speechSynthesis — leave list empty.
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

  const persistSetup = (updates: {
    practiceMode?: PracticeMode;
    streamResponses?: boolean;
    liveCoachingEnabled?: boolean;
    voiceConfig?: VoiceSetupConfig;
  }) => {
    const current = loadInterviewSetup() ?? createDefaultInterviewSetup();
    saveInterviewSetup({
      ...current,
      practiceMode: updates.practiceMode ?? current.practiceMode,
      streamResponses:
        updates.streamResponses ?? current.streamResponses,
      liveCoachingEnabled:
        updates.liveCoachingEnabled ?? current.liveCoachingEnabled,
      voiceConfig: updates.voiceConfig ?? current.voiceConfig,
    });
  };

  const handleSaveDefaults = () => {
    setDefaultsState({ kind: "saving" });
    try {
      persistSetup({
        practiceMode,
        streamResponses: streaming,
        liveCoachingEnabled: liveCoaching,
      });
      setDefaultsState({ kind: "saved" });
      toast.success("Interview defaults saved.");
    } catch (error) {
      setDefaultsState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Failed to save defaults.",
      });
    }
  };

  const handleSaveVoice = () => {
    setVoiceState({ kind: "saving" });
    try {
      persistSetup({ voiceConfig });
      setVoiceState({ kind: "saved" });
      toast.success("Voice preferences saved.");
    } catch (error) {
      setVoiceState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save voice preferences.",
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
        const detail = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Export failed (HTTP ${response.status}).`);
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
        const detail = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
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

  if (status === "loading" || !user) {
    return (
      <div className="p-8 max-w-5xl">
        <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const initials = getInitials(user);

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile, defaults, and data."
        icon={<SettingsIcon className="h-6 w-6" />}
        iconColor="blue"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="defaults" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Voice</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Shown in the navbar and used to greet you in the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-lg font-semibold shadow-soft-md">
                  {initials}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {`${firstName} ${lastName}`.trim() || user.email}
                  </p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email ?? ""}
                    disabled
                  />
                  <p className="text-xs text-gray-500">
                    Your email is the one you sign in with.
                  </p>
                </div>

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
                    <span className="text-sm text-red-600">
                      {profileState.message}
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults" className="space-y-6">
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader>
              <CardTitle>Interview defaults</CardTitle>
              <CardDescription>
                Pre-fills the setup wizard so you can launch faster.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default mode</Label>
                <Select
                  value={practiceMode}
                  onValueChange={(value) =>
                    setPracticeMode(value as PracticeMode)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text interview</SelectItem>
                    <SelectItem value="voice">Voice interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <div>
                  <Label className="text-sm font-medium">
                    Stream responses by default
                  </Label>
                  <p className="text-xs text-gray-500">
                    Replies appear token-by-token as they&apos;re generated.
                  </p>
                </div>
                <Switch checked={streaming} onCheckedChange={setStreaming} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <div>
                  <Label className="text-sm font-medium">
                    Live coaching by default
                  </Label>
                  <p className="text-xs text-gray-500">
                    Shows strengths and improvement tips after each reply.
                  </p>
                </div>
                <Switch
                  checked={liveCoaching}
                  onCheckedChange={setLiveCoaching}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveDefaults}
                  disabled={defaultsState.kind === "saving"}
                >
                  {defaultsState.kind === "saving"
                    ? "Saving..."
                    : "Save defaults"}
                </Button>
                {defaultsState.kind === "error" && (
                  <span className="text-sm text-red-600">
                    {defaultsState.message}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice" className="space-y-6">
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader>
              <CardTitle>Voice & speech</CardTitle>
              <CardDescription>
                Defaults applied when you start a voice interview.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <div>
                  <Label className="text-sm font-medium">
                    Text-to-speech enabled
                  </Label>
                  <p className="text-xs text-gray-500">
                    Plays the interviewer&apos;s replies as audio.
                  </p>
                </div>
                <Switch
                  checked={voiceConfig.ttsEnabled}
                  onCheckedChange={(checked) =>
                    setVoiceConfig((current) => ({
                      ...current,
                      ttsEnabled: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <div>
                  <Label className="text-sm font-medium">
                    Speech-to-text enabled
                  </Label>
                  <p className="text-xs text-gray-500">
                    Lets you reply by speaking instead of typing.
                  </p>
                </div>
                <Switch
                  checked={voiceConfig.sttEnabled}
                  onCheckedChange={(checked) =>
                    setVoiceConfig((current) => ({
                      ...current,
                      sttEnabled: checked,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Default voice</Label>
                {voiceOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No voices available in this browser. The wizard will fall
                    back to the system default.
                  </p>
                ) : (
                  <Select
                    value={voiceConfig.selectedVoiceUri || "__default__"}
                    onValueChange={(value) =>
                      setVoiceConfig((current) => {
                        if (value === "__default__") {
                          return {
                            ...current,
                            selectedVoiceUri: "",
                            selectedVoiceName: "",
                          };
                        }
                        const match = voiceOptions.find(
                          (option) => option.uri === value,
                        );
                        return {
                          ...current,
                          selectedVoiceUri: value,
                          selectedVoiceName: match?.name ?? "",
                        };
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        System default
                      </SelectItem>
                      {voiceOptions.map((option) => (
                        <SelectItem key={option.uri} value={option.uri}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSaveVoice}
                  disabled={voiceState.kind === "saving"}
                >
                  {voiceState.kind === "saving"
                    ? "Saving..."
                    : "Save voice preferences"}
                </Button>
                {voiceState.kind === "error" && (
                  <span className="text-sm text-red-600">
                    {voiceState.message}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader>
              <CardTitle>Account & security</CardTitle>
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
                  <span className="text-sm text-emerald-600">
                    Sent. Check your inbox.
                  </span>
                )}
                {resetState.kind === "error" && (
                  <span className="text-sm text-red-600">
                    {resetState.message}
                  </span>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleSignOut()}
                  className="text-red-600 hover:text-red-700"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
                <p className="text-sm text-gray-500">
                  Signs you out of this browser. Your data stays in your account.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 shadow-soft">
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
                  <span className="text-sm text-emerald-600">
                    Download started.
                  </span>
                )}
                {exportState.kind === "error" && (
                  <span className="text-sm text-red-600">
                    {exportState.message}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Includes profile, sessions (with full transcripts), personas,
                and job descriptions as a JSON file.
              </p>

              <Separator />

              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2">
                <p className="font-semibold text-red-900">Danger zone</p>
                <p className="text-sm text-red-800/80">
                  Permanently delete every interview session and its transcript.
                  Personas and job descriptions are kept.
                </p>
                <Button
                  variant="outline"
                  className="border-red-300 bg-white text-red-700 hover:bg-red-100"
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
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
              className="border-red-300 bg-red-600 text-white hover:bg-red-700"
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
