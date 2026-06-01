import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users } from "lucide-react";

const scenarios = [
  {
    id: 1,
    title: "Quarterly Business Review",
    description:
      "Present and discuss quarterly performance metrics with stakeholders",
    category: "Business",
    difficulty: "Intermediate",
    duration: "15-20 min",
    participants: "2-4",
  },
  {
    id: 2,
    title: "Conflict Resolution",
    description:
      "Address and resolve team conflicts with empathy and assertiveness",
    category: "Leadership",
    difficulty: "Advanced",
    duration: "20-30 min",
    participants: "2-3",
  },
  {
    id: 3,
    title: "Client Negotiation",
    description:
      "Negotiate project scope and pricing with international clients",
    category: "Sales",
    difficulty: "Advanced",
    duration: "25-35 min",
    participants: "2",
  },
  {
    id: 4,
    title: "Team Feedback Session",
    description:
      "Deliver constructive feedback to team members across cultures",
    category: "Management",
    difficulty: "Intermediate",
    duration: "10-15 min",
    participants: "2",
  },
  {
    id: 5,
    title: "Product Presentation",
    description:
      "Present new product features to cross-functional stakeholders",
    category: "Communication",
    difficulty: "Beginner",
    duration: "15-20 min",
    participants: "3-5",
  },
  {
    id: 6,
    title: "Salary Negotiation",
    description: "Negotiate compensation and benefits professionally",
    category: "Career",
    difficulty: "Advanced",
    duration: "20-25 min",
    participants: "2",
  },
];

function getScenarioSlug(title: string) {
  switch (title) {
    case "Quarterly Business Review":
      return "qbr";
    case "Conflict Resolution":
      return "conflict";
    case "Client Negotiation":
      return "client-negotiation";
    case "Team Feedback Session":
      return "feedback";
    case "Product Presentation":
      return "presentation";
    default:
      return "salary-negotiation";
  }
}

export default function ScenariosPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Scenario Library</h1>
        <p className="text-gray-600 mt-2">
          Choose from 50+ realistic workplace scenarios
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between mb-2">
                <Badge variant="secondary">{scenario.category}</Badge>
                <Badge
                  variant={
                    scenario.difficulty === "Beginner"
                      ? "default"
                      : scenario.difficulty === "Intermediate"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  {scenario.difficulty}
                </Badge>
              </div>
              <CardTitle className="text-lg">{scenario.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {scenario.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{scenario.duration}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{scenario.participants}</span>
                </div>
              </div>
              <Link
                href={`/simulate/chat?scenario=${getScenarioSlug(
                  scenario.title,
                )}&persona=sarah`}
                className="block"
              >
                <Button className="w-full">Start Scenario</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
