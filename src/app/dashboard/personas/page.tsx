import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Briefcase } from "lucide-react";

const personas = [
  {
    id: 1,
    name: "Sarah Chen",
    role: "Senior Product Manager",
    culture: "Chinese-American",
    communicationStyle: "Direct, data-driven",
    flag: "🇨🇳",
    avatar: "SC",
  },
  {
    id: 2,
    name: "Marcus Johnson",
    role: "VP of Engineering",
    culture: "American",
    communicationStyle: "Assertive, collaborative",
    flag: "🇺🇸",
    avatar: "MJ",
  },
  {
    id: 3,
    name: "Yuki Tanaka",
    role: "Design Lead",
    culture: "Japanese",
    communicationStyle: "Indirect, considerate",
    flag: "🇯🇵",
    avatar: "YT",
  },
  {
    id: 4,
    name: "Priya Sharma",
    role: "Senior Developer",
    culture: "Indian",
    communicationStyle: "Diplomatic, detail-oriented",
    flag: "🇮🇳",
    avatar: "PS",
  },
  {
    id: 5,
    name: "Lars Petersen",
    role: "Operations Director",
    culture: "Danish",
    communicationStyle: "Egalitarian, transparent",
    flag: "🇩🇰",
    avatar: "LP",
  },
  {
    id: 6,
    name: "Isabella Rodriguez",
    role: "Marketing Manager",
    culture: "Spanish",
    communicationStyle: "Expressive, relationship-focused",
    flag: "🇪🇸",
    avatar: "IR",
  },
];

export default function PersonasPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Personas</h1>
        <p className="text-gray-600 mt-2">
          Practice with diverse personas representing different cultures and
          communication styles
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {personas.map((persona) => (
          <Card key={persona.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {persona.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{persona.name}</CardTitle>
                    <span className="text-2xl">{persona.flag}</span>
                  </div>
                  <CardDescription className="text-sm">
                    {persona.role}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">{persona.culture}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">
                    {persona.communicationStyle}
                  </span>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Practice with {persona.name.split(" ")[0]}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
