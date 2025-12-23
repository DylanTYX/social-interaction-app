import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, Mic, TrendingUp, Clock } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, John! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Ready to continue your communication training?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-2 hover:border-blue-300 transition-colors cursor-pointer">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Start Chat Practice</CardTitle>
            <CardDescription>
              Practice written communication with AI personas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/simulate/chat">
              <Button className="w-full">Start Session</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-purple-300 transition-colors cursor-pointer">
          <CardHeader>
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
              <Mic className="h-6 w-6 text-purple-600" />
            </div>
            <CardTitle className="text-xl">Start Voice Practice</CardTitle>
            <CardDescription>
              Practice verbal communication with voice scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/simulate/voice">
              <Button className="w-full" variant="outline">
                Start Session
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-gray-500 mt-1">+3 from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5 hrs</div>
            <p className="text-xs text-gray-500 mt-1">+2.5 hrs this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Improvement Score
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Your latest practice conversations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                title: "Quarterly Business Review",
                persona: "Sarah Chen",
                date: "2 hours ago",
                score: 92,
              },
              {
                title: "Conflict Resolution",
                persona: "Marcus Johnson",
                date: "Yesterday",
                score: 85,
              },
              {
                title: "Team Feedback Session",
                persona: "Yuki Tanaka",
                date: "2 days ago",
                score: 88,
              },
            ].map((session, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{session.title}</p>
                  <p className="text-sm text-gray-500">
                    with {session.persona} • {session.date}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {session.score}%
                  </div>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
