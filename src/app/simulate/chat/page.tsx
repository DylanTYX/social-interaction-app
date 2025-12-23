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
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Message = {
  id: string;
  role: "ai" | "user";
  content: string;
  timestamp: string;
};

export default function ChatSimulatePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "ai",
      content:
        "Good morning! Thank you for taking the time to meet with me today. I understand you'd like to discuss the Q3 performance results?",
      timestamp: "10:00 AM",
    },
  ]);

  const handleSend = (message: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages([...messages, newMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content:
          "That sounds great. Could you walk me through the key highlights?",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

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
          <h1 className="text-lg font-semibold">Chat Practice</h1>
          <p className="text-sm text-gray-500">
            Quarterly Business Review • Sarah Chen
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
            <Select defaultValue="qbr">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qbr">Quarterly Business Review</SelectItem>
                <SelectItem value="conflict">Conflict Resolution</SelectItem>
                <SelectItem value="feedback">Team Feedback</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Persona</Label>
            <Select defaultValue="sarah">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sarah">Sarah Chen 🇨🇳</SelectItem>
                <SelectItem value="marcus">Marcus Johnson 🇺🇸</SelectItem>
                <SelectItem value="yuki">Yuki Tanaka 🇯🇵</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cultural Context</Label>
            <Select defaultValue="chinese">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chinese">Chinese-American</SelectItem>
                <SelectItem value="american">American</SelectItem>
                <SelectItem value="japanese">Japanese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select defaultValue="intermediate">
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

        {/* Center Panel - Chat */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
                personaName="Sarah Chen"
              />
            ))}
          </div>
          <div className="border-t p-4">
            <ChatInput onSend={handleSend} />
          </div>
        </div>

        {/* Right Panel - Feedback */}
        <div className="w-96 bg-white border-l border-gray-200/80 p-6 space-y-6 overflow-y-auto shadow-soft">
          <div>
            <h2 className="text-lg font-semibold mb-4">Live Feedback</h2>
          </div>

          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader>
              <CardTitle className="text-sm">Communication Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">87%</div>
              <p className="text-sm text-gray-500 mt-2">Above average</p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Empathy</span>
              <Badge variant="default">High</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Clarity</span>
              <Badge variant="secondary">Medium</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Cultural Awareness</span>
              <Badge variant="default">High</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">Assertiveness</span>
              <Badge variant="secondary">Medium</Badge>
            </div>
          </div>

          <Card className="bg-blue-50 border-blue-200 shadow-soft">
            <CardHeader>
              <CardTitle className="text-sm text-blue-900">💡 Tip</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800">
                In Chinese-American business culture, providing data-backed
                statements builds credibility. Consider supporting your claims
                with metrics.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
