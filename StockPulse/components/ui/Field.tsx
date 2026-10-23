import { useId } from "react";
import { cn } from "@/lib/utils";

export default function Field({ label, className, id: externalId, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = externalId || generatedId;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[10px] font-semibold tracking-normal text-muted-foreground normal-case px-1">
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={cn(
          "w-full px-5 py-3.5 rounded-xl bg-secondary/80 border border-border text-foreground text-sm font-bold placeholder:text-muted-foreground/70 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all tabular-nums",
          className
        )}
      />
    </div>
  );
}

