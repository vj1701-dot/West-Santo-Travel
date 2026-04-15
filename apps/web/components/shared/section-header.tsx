import type { ReactNode } from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SectionHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  tooltip?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, eyebrow, description, tooltip, actions, className }: SectionHeaderProps) {
  return (
    <Card className={cn("border-line bg-surface-strong shadow-sm", className)}>
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            {tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-muted hover:text-slate-600"
                      aria-label={`More information about ${title}`}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          {description ? <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
