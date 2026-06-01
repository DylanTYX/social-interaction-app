import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  Clock,
  Target,
  Flame,
  Users,
  BookOpen,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// Demo data for recent sessions
const RECENT_SESSIONS = [
  {
    id: 1,
    scenario: "Quarterly Business Review",
    persona: "Sarah Chen",
    avatar: "SC",
    date: "2 hours ago",
    score: 92,
  },
  {
    id: 2,
    scenario: "Conflict Resolution",
    persona: "Marcus Johnson",
    avatar: "MJ",
    date: "Yesterday",
    score: 85,
  },
  {
    id: 3,
    scenario: "Team Feedback Session",
    persona: "Yuki Tanaka",
    avatar: "YT",
    date: "2 days ago",
    score: 88,
  },
];

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, John! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Ready to continue your communication training?
        </p>
      </div>

      {/* Quick Actions - Cleaner design with single clear CTA */}
      <div className="grid md:grid-cols-1 gap-6 max-w-3xl">
        <Link href="/simulate/setup" className="block">
          <Card className="group h-full border border-blue-200/60 hover:border-blue-300 hover:shadow-soft-md transition-all duration-200 cursor-pointer hover-lift bg-linear-to-br from-blue-50 via-white to-cyan-50/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg group-hover:text-blue-700 transition-colors">
                    Interview Practice
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Text or voice, guided through setup
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Start with scenario selection, persona tuning, and mode choice.
                Then launch into a timed text interview or a voice session with
                mic and speech settings prepared first.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 text-sm font-medium group-hover:bg-blue-500/20 transition-colors">
                <span>Start setup</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Grid - Balanced color approach */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-gray-200/80 shadow-soft bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">47</div>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200/80 shadow-soft bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">78%</div>
            <p className="text-xs text-gray-500 mt-1">Keep improving!</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-200/80 shadow-soft bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12.5h</div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card className="border border-orange-200/60 shadow-soft bg-linear-to-br from-orange-50 to-amber-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current Streak
            </CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">7 days 🔥</div>
            <p className="text-xs text-orange-600 mt-1">Keep it up!</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions - Better background contrast */}
      <Card className="border border-gray-200/80 shadow-soft bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Recent Sessions</CardTitle>
              <CardDescription>
                Your latest practice conversations
              </CardDescription>
            </div>
            <Link href="/dashboard/analytics">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {RECENT_SESSIONS.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-gray-50/80 hover:bg-gray-100 transition-colors duration-150 cursor-pointer group"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                  {session.avatar}
                </div>

                {/* Session Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                    {session.scenario}
                  </p>
                  <p className="text-sm text-gray-500">
                    {session.persona} · {session.date}
                  </p>
                </div>

                {/* Score with label */}
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-blue-600">
                    {session.score}%
                  </div>
                  <p className="text-xs text-gray-400">score</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Next Steps - Matching draft design */}
      <Card className="border border-gray-200/80 shadow-soft bg-white">
        <CardHeader>
          <CardTitle>Recommended Next Steps</CardTitle>
          <CardDescription>Continue your learning journey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 border border-gray-200/60 rounded-lg hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-soft transition-all duration-200 group cursor-pointer">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1 group-hover:text-blue-700 transition-colors">
                  Try Advanced Scenarios
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Challenge yourself with complex negotiations
                </p>
                <Link href="/dashboard/scenarios">
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto text-blue-600 hover:text-blue-700"
                  >
                    Browse scenarios →
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 border border-gray-200/60 rounded-lg hover:border-purple-200 hover:bg-purple-50/30 hover:shadow-soft transition-all duration-200 group cursor-pointer">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0 group-hover:bg-purple-200 transition-colors">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1 group-hover:text-purple-700 transition-colors">
                  Practice with New Personas
                </h4>
                <p className="text-sm text-gray-600 mb-2">
                  Expand your cultural understanding
                </p>
                <Link href="/dashboard/personas">
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0 h-auto text-purple-600 hover:text-purple-700"
                  >
                    View personas →
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
