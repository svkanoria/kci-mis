import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface TimeDirectionButtonProps {
  isTimeFlipped: boolean;
  onClick: () => void;
}

export const TimeDirectionButton = ({
  isTimeFlipped,
  onClick,
}: TimeDirectionButtonProps) => {
  return (
    <Button variant="secondary" onClick={onClick} title="Flip time direction">
      Time <ArrowRight className={isTimeFlipped ? "rotate-180" : ""} />
    </Button>
  );
};
