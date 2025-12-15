import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useTimeDirectionStore } from "@/lib/store";

export const TimeDirectionButton = () => {
  const { isTimeFlipped, toggleTimeFlipped } = useTimeDirectionStore();

  return (
    <Button
      variant="secondary"
      onClick={toggleTimeFlipped}
      title="Flip time direction"
    >
      Time <ArrowRight className={isTimeFlipped ? "rotate-180" : ""} />
    </Button>
  );
};
