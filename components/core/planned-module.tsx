import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import type { ResolvedModule } from "@/modules/types";

export function PlannedModule({ module, context }: { module: ResolvedModule; context?: string }) {
  const Icon = module.icon;
  return (
    <>
      <PageHeader eyebrow={context ?? "Module"} title={module.name} />
      <Card className="flex flex-col items-center px-6 py-16 text-center">
        <span className="rounded-2xl bg-brand-paper p-4 text-brand-sea">
          <Icon className="h-7 w-7" />
        </span>
        <p className="mt-5 font-serif text-2xl text-brand-ink">Coming soon</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{module.description}</p>
      </Card>
    </>
  );
}
