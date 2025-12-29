import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useTimeDirectionStore } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { is } from "drizzle-orm";
import clsx from "clsx";

interface TimeDirectionButtonProps {
  lockedDirection?: "forward" | "reverse";
}

export const TimeDirectionButton = ({
  lockedDirection,
}: TimeDirectionButtonProps) => {
  const { isTimeFlipped, toggleTimeFlipped } = useTimeDirectionStore();

  const isLocked = lockedDirection !== undefined;
  const effectiveIsTimeFlipped = isLocked
    ? lockedDirection === "reverse"
    : isTimeFlipped;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          className={clsx("inline-block", isLocked && "cursor-not-allowed")}
        >
          <Button
            variant="secondary"
            onClick={isLocked ? undefined : toggleTimeFlipped}
            disabled={isLocked}
          >
            Time{" "}
            <ArrowRight
              className={effectiveIsTimeFlipped ? "rotate-180" : ""}
            />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isLocked ? "Direction locked on this page" : "Flip time direction"}
      </TooltipContent>
    </Tooltip>
  );
};
