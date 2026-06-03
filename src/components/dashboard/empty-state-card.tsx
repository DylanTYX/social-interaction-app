import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyStateCard({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateCardProps) {
  return (
    <Card className="border-dashed border-gray-300/80 bg-white/80">
      <CardHeader className="justify-items-center pt-8 pb-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <CardTitle className="pt-3 text-lg">{title}</CardTitle>
        <CardDescription className="mx-auto max-w-md text-balance">
          {description}
        </CardDescription>
      </CardHeader>
      {(primaryAction || secondaryAction) && (
        <CardContent className="flex flex-wrap items-center justify-center gap-2 pb-8">
          {primaryAction &&
            (primaryAction.href ? (
              <Button asChild>
                <Link href={primaryAction.href}>{primaryAction.label}</Link>
              </Button>
            ) : (
              <Button type="button" onClick={primaryAction.onClick}>
                {primaryAction.label}
              </Button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Button variant="outline" asChild>
                <Link href={secondaryAction.href}>
                  {secondaryAction.label}
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ))}
        </CardContent>
      )}
    </Card>
  );
}
