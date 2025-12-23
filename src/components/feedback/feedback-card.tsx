import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FeedbackCardProps {
  title: string;
  score?: number;
  level?: "high" | "medium" | "low";
  message: string;
  type?: "tip" | "strength" | "warning";
}

export function FeedbackCard({
  title,
  score,
  level,
  message,
  type = "tip",
}: FeedbackCardProps) {
  const bgColors = {
    tip: "bg-blue-50 border-blue-200",
    strength: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
  };

  const textColors = {
    tip: "text-blue-900",
    strength: "text-green-900",
    warning: "text-amber-900",
  };

  const messageColors = {
    tip: "text-blue-800",
    strength: "text-green-800",
    warning: "text-amber-800",
  };

  const icons = {
    tip: "💡",
    strength: "✓",
    warning: "⚠️",
  };

  return (
    <Card className={cn(bgColors[type])}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("text-sm", textColors[type])}>
            {icons[type]} {title}
          </CardTitle>
          {score && (
            <div className={cn("text-2xl font-bold", textColors[type])}>
              {score}%
            </div>
          )}
          {level && (
            <Badge
              variant={
                level === "high"
                  ? "default"
                  : level === "medium"
                  ? "secondary"
                  : "destructive"
              }
            >
              {level}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm", messageColors[type])}>{message}</p>
      </CardContent>
    </Card>
  );
}
