import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Globe, Briefcase } from "lucide-react";

interface PersonaCardProps {
  name: string;
  role: string;
  culture: string;
  communicationStyle: string;
  flag: string;
  avatar: string;
}

export function PersonaCard({
  name,
  role,
  culture,
  communicationStyle,
  flag,
  avatar,
}: PersonaCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{name}</CardTitle>
              <span className="text-2xl">{flag}</span>
            </div>
            <CardDescription className="text-sm">{role}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4 text-gray-500" />
          <span className="text-gray-700">{culture}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Briefcase className="h-4 w-4 text-gray-500" />
          <span className="text-gray-700">{communicationStyle}</span>
        </div>
      </CardContent>
    </Card>
  );
}
