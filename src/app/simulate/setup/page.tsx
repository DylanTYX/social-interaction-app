"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Mic,
  Sparkles,
  Volume2,
  Wand2,
  MessageSquare,
} from "lucide-react";

import { PersonaCustomizer } from "@/components/chat/persona-customizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SCENARIOS } from "@/lib/constants";
import {
  createDefaultInterviewSetup,
  saveInterviewLaunch,
  loadInterviewSetup,
  getSetupHref,
  saveInterviewSetup,
  type InterviewSetupState,
  type PracticeMode,
} from "@/lib/interview-setup";

function getCurrentTimestamp() {
  return new Date().toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function getScenarioByValue(value: string) {
  const options = [
    { value: "qbr", ...SCENARIOS[0] },
    { value: "conflict", ...SCENARIOS[1] },
    { value: "client-negotiation", ...SCENARIOS[2] },
    { value: "feedback", ...SCENARIOS[3] },
    { value: "presentation", ...SCENARIOS[4] },
    { value: "salary-negotiation", ...SCENARIOS[5] },
  ];

  return options.find((option) => option.value === value) ?? options[0];
}

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [microphoneStatus, setMicrophoneStatus] = useState<
    "idle" | "checking" | "ready" | "failed"
  >("idle");
  const [setup, setSetup] = useState<InterviewSetupState>(() => {
    const stored = loadInterviewSetup() ?? createDefaultInterviewSetup();
    const scenarioValue = searchParams.get("scenario");
    const streamValue = searchParams.get("stream");
    const modeValue = searchParams.get("mode");

    return {
      ...stored,
      scenarioValue: scenarioValue ?? stored.scenarioValue,
      streamResponses:
        streamValue === null ? stored.streamResponses : streamValue === "1",
      practiceMode:
        modeValue === "voice" || modeValue === "text"
          ? modeValue
          : stored.practiceMode,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    const loadVoices = () => {
      setAvailableVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const activeScenario = useMemo(
    () => getScenarioByValue(setup.scenarioValue),
    [setup.scenarioValue],
  );

  const selectedVoiceLabel =
    setup.voiceConfig.selectedVoiceName || "System default voice";

  const launchInterview = () => {
    saveInterviewSetup(setup);
    saveInterviewLaunch(setup);
    router.push(getSetupHref(setup));
  };

  const updateScenario = (scenarioValue: string) => {
    setSetup((current) => ({ ...current, scenarioValue }));
  };

  const updateMode = (practiceMode: PracticeMode) => {
    setSetup((current) => ({ ...current, practiceMode }));
  };

  const checkMicrophone = async () => {
    // Check if running in browser environment
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setMicrophoneStatus("failed");
      return;
    }

    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneStatus("failed");
      return;
    }

    setMicrophoneStatus("checking");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneStatus("ready");
      setSetup((current) => ({
        ...current,
        voiceConfig: {
          ...current.voiceConfig,
          microphoneChecked: true,
        },
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Microphone check failed";
      console.error("Microphone permission error:", errorMessage);

      // Provide specific guidance based on error type
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          console.error(
            "Permission denied. Reset microphone permission in browser settings and try again.",
          );
        } else if (error.name === "NotFoundError") {
          console.error(
            "No microphone device found. Connect a microphone and try again.",
          );
        }
      }

      setMicrophoneStatus("failed");
      setSetup((current) => ({
        ...current,
        voiceConfig: {
          ...current.voiceConfig,
          microphoneChecked: false,
        },
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(219,234,254,0.9),transparent_35%),radial-gradient(circle_at_top_right,rgba(207,250,254,0.6),transparent_28%),linear-gradient(to_bottom,#f8fafc,#ffffff_52%,#f8fbff)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute top-40 -left-16 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Pre-chat setup
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card className="overflow-hidden border-blue-200/70 bg-linear-to-br from-blue-600 via-slate-900 to-cyan-700 text-white shadow-2xl shadow-blue-950/10">
            <CardContent className="flex h-full flex-col justify-between gap-8 p-8 lg:p-10">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Adaptive interview simulator
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
                    Build the interview before the interview starts.
                  </h1>
                  <p className="max-w-xl text-sm leading-6 text-white/75 lg:text-base">
                    Configure the scenario, shape the interviewer persona, and
                    choose whether you want live token streaming. The chat
                    experience stays focused on the conversation once you
                    launch.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  "Scenario-first flow",
                  "Custom persona tuning",
                  "Optional streaming",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/85 backdrop-blur"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/90">
                  <Wand2 className="h-4 w-4" />
                  Live preview
                </div>
                <div className="space-y-3 text-sm text-white/75">
                  <p>
                    <span className="text-white">Scenario:</span>{" "}
                    {activeScenario.title}
                  </p>
                  <p>
                    <span className="text-white">Persona:</span>{" "}
                    {setup.personaConfig.name}
                  </p>
                  <p>
                    <span className="text-white">Streaming:</span>{" "}
                    {setup.streamResponses ? "Enabled" : "Disabled"}
                  </p>
                  <p>
                    <span className="text-white">Ready:</span>{" "}
                    <span suppressHydrationWarning>
                      {getCurrentTimestamp()}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200/80 bg-white/85 shadow-soft backdrop-blur">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Scenario setup</CardTitle>
              <CardDescription>
                Choose the interview context, then launch into text or voice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Practice mode</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      value: "text" as const,
                      title: "Text interview",
                      description: "Typed responses with a timed turn window.",
                      icon: MessageSquare,
                    },
                    {
                      value: "voice" as const,
                      title: "Voice interview",
                      description:
                        "Speech-to-text and spoken interviewer prompts.",
                      icon: Mic,
                    },
                  ].map((modeOption) => {
                    const isActive = setup.practiceMode === modeOption.value;
                    const Icon = modeOption.icon;

                    return (
                      <button
                        key={modeOption.value}
                        type="button"
                        onClick={() => updateMode(modeOption.value)}
                        suppressHydrationWarning
                        className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isActive
                            ? "border-blue-300 bg-blue-50 shadow-soft-md"
                            : "border-gray-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
                                isActive
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {modeOption.title}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-gray-500">
                                {modeOption.description}
                              </p>
                            </div>
                          </div>
                          {isActive && (
                            <Badge variant="default" className="rounded-full">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Scenario</Label>
                  <Badge variant="secondary" className="text-xs">
                    {activeScenario.value}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SCENARIOS.map((scenario, index) => {
                    const value = [
                      "qbr",
                      "conflict",
                      "client-negotiation",
                      "feedback",
                      "presentation",
                      "salary-negotiation",
                    ][index];
                    const isActive = setup.scenarioValue === value;

                    return (
                      <button
                        key={scenario.title}
                        type="button"
                        onClick={() => updateScenario(value)}
                        className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                          isActive
                            ? "border-blue-300 bg-blue-50 shadow-soft-md"
                            : "border-gray-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {scenario.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              {scenario.description}
                            </p>
                          </div>
                          {isActive && (
                            <Badge variant="default" className="rounded-full">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <PersonaCustomizer
                value={setup.personaConfig}
                onChange={(personaConfig) =>
                  setSetup((current) => ({ ...current, personaConfig }))
                }
              />

              {setup.practiceMode === "voice" && (
                <div className="space-y-4 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">
                        Voice readiness
                      </Label>
                      <p className="text-xs text-gray-500">
                        Check microphone access before you start the voice
                        interview.
                      </p>
                    </div>
                    <Button variant="outline" onClick={checkMicrophone}>
                      {microphoneStatus === "checking"
                        ? "Checking..."
                        : "Check mic"}
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Volume2 className="h-4 w-4 text-blue-600" />
                        Text-to-speech
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Read interviewer prompts aloud.
                        </p>
                        <Switch
                          checked={setup.voiceConfig.ttsEnabled}
                          onCheckedChange={(checked) =>
                            setSetup((current) => ({
                              ...current,
                              voiceConfig: {
                                ...current.voiceConfig,
                                ttsEnabled: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Mic className="h-4 w-4 text-blue-600" />
                        Speech-to-text
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                          Convert your spoken answer to text.
                        </p>
                        <Switch
                          checked={setup.voiceConfig.sttEnabled}
                          onCheckedChange={(checked) =>
                            setSetup((current) => ({
                              ...current,
                              voiceConfig: {
                                ...current.voiceConfig,
                                sttEnabled: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Voice choice</Label>
                    <Select
                      value={setup.voiceConfig.selectedVoiceUri || "default"}
                      onValueChange={(selectedValue: string) => {
                        const selectedVoice =
                          availableVoices.find(
                            (voice) => voice.voiceURI === selectedValue,
                          ) ?? null;

                        setSetup((current) => ({
                          ...current,
                          voiceConfig: {
                            ...current.voiceConfig,
                            selectedVoiceName:
                              selectedVoice?.name ?? "System default voice",
                            selectedVoiceUri: selectedVoice?.voiceURI ?? "",
                          },
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">
                          System default voice
                        </SelectItem>
                        {availableVoices.map((voice) => (
                          <SelectItem
                            key={voice.voiceURI}
                            value={voice.voiceURI}
                          >
                            {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Selected: {selectedVoiceLabel}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {setup.voiceConfig.microphoneChecked
                      ? microphoneStatus === "ready"
                        ? "Microphone access verified."
                        : "Microphone was checked for this session."
                      : "Microphone has not been checked yet."}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">
                      Live streaming
                    </Label>
                    <p className="text-xs text-gray-500">
                      Stream the AI response token-by-token in the chat.
                    </p>
                  </div>
                  <Switch
                    checked={setup.streamResponses}
                    onCheckedChange={(checked) =>
                      setSetup((current) => ({
                        ...current,
                        streamResponses: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1 gap-2 shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
                  onClick={launchInterview}
                >
                  Begin interview
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSetup(createDefaultInterviewSetup())}
                >
                  Reset to default
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
