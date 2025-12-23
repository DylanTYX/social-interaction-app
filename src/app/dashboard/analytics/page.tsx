import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, MessageSquare, Target, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AnalyticsPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">
          Track your progress and communication improvements
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">87%</div>
            <p className="text-xs text-green-600 mt-1">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24</div>
            <p className="text-xs text-gray-500 mt-1">Across 6 scenarios</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Practice Hours
            </CardTitle>
            <Target className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12.5</div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
            <Award className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">8</div>
            <p className="text-xs text-gray-500 mt-1">Badges earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Skills Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Skills</CardTitle>
          <CardDescription>
            Your progress across different skill areas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Empathy</span>
              <span className="text-gray-500">92%</span>
            </div>
            <Progress value={92} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Clarity</span>
              <span className="text-gray-500">85%</span>
            </div>
            <Progress value={85} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                Cultural Awareness
              </span>
              <span className="text-gray-500">88%</span>
            </div>
            <Progress value={88} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Assertiveness</span>
              <span className="text-gray-500">78%</span>
            </div>
            <Progress value={78} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">
                Active Listening
              </span>
              <span className="text-gray-500">90%</span>
            </div>
            <Progress value={90} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Performance Chart Placeholder */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Your scores over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              Chart Placeholder
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Breakdown</CardTitle>
            <CardDescription>Sessions by scenario type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              Chart Placeholder
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
