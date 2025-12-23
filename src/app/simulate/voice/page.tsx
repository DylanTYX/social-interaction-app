"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Mic, Square } from "lucide-react";
import Link from "next/link";

export default function VoiceSimulatePage() {
  const [isRecording, setIsRecording] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200/80 flex items-center px-6 gap-4 shadow-soft">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100 transition-colors duration-150"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Voice Practice</h1>
          <p className="text-sm text-gray-500">
            Client Negotiation • Marcus Johnson
          </p>
        </div>
        <Button
          variant="destructive"
          className="shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
        >
          End Session
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Configuration */}
        <div className="w-80 bg-white border-r border-gray-200/80 p-6 space-y-6 overflow-y-auto shadow-soft">
          <div>
            <h2 className="text-lg font-semibold mb-4">Session Setup</h2>
          </div>

          <div className="space-y-2">
            <Label>Scenario</Label>
            <Select defaultValue="negotiation">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="negotiation">Client Negotiation</SelectItem>
                <SelectItem value="presentation">
                  Product Presentation
                </SelectItem>
                <SelectItem value="interview">Job Interview</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Persona</Label>
            <Select defaultValue="marcus">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="marcus">Marcus Johnson 🇺🇸</SelectItem>
                <SelectItem value="sarah">Sarah Chen 🇨🇳</SelectItem>
                <SelectItem value="lars">Lars Petersen 🇩🇰</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Voice Type</Label>
            <Select defaultValue="male">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select defaultValue="advanced">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full shadow-soft-md hover:shadow-soft-lg transition-all duration-200">
            Apply Changes
          </Button>
        </div>

        {/* Center Panel - Voice Interface */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 flex flex-col items-center justify-center p-12">
            {/* Waveform Visualization */}
            <div className="w-full max-w-2xl mb-12">
              <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {isRecording ? (
                  <div className="flex items-center gap-1 h-full">
                    {[...Array(40)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-blue-500 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 80 + 20}%`,
                          animationDelay: `${i * 0.05}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">Waveform visualization</p>
                )}
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex flex-col items-center gap-6">
              <Button
                size="lg"
                className={`h-20 w-20 rounded-full shadow-soft-lg hover:shadow-soft-lg transition-all duration-200 ${
                  isRecording ? "bg-red-600 hover:bg-red-700" : ""
                }`}
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? (
                  <Square className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
              <p className="text-sm text-gray-600">
                {isRecording
                  ? "Click to stop recording"
                  : "Click to start recording"}
              </p>
            </div>

            {/* Status */}
            <div className="mt-12">
              <Badge
                variant={isRecording ? "default" : "secondary"}
                className="text-sm px-4 py-2"
              >
                {isRecording ? "🔴 Recording..." : "Ready to practice"}
              </Badge>
            </div>
          </div>

          {/* Transcript Panel */}
          <div className="border-t p-6 bg-gray-50 max-h-64 overflow-y-auto">
            <h3 className="font-semibold mb-4">Transcript</h3>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">AI • 10:00 AM</p>
                <p className="text-sm">
                  Thank you for meeting with me today. I'd like to discuss the
                  project scope and timeline.
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">You • 10:01 AM</p>
                <p className="text-sm text-gray-900">
                  Of course. Let's start with the deliverables you have in mind.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Feedback */}
        <div className="w-96 bg-white border-l p-6 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-lg font-semibold mb-4">Live Feedback</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Voice Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Tone</span>
                <Badge variant="default">Confident</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Pace</span>
                <Badge variant="default">Appropriate</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Clarity</span>
                <Badge variant="default">High</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700">Filler Words</span>
                <Badge variant="secondary">Moderate</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Communication Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-600">82%</div>
              <p className="text-sm text-gray-500 mt-2">Good performance</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-sm text-purple-900">
                💡 Suggestion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-800">
                Try to reduce filler words like "um" and "uh" to sound more
                confident. Pausing briefly is better than using fillers.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-sm text-green-900">
                ✓ Strength
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-800">
                Great job maintaining an appropriate speaking pace. This helps
                your message come across clearly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
