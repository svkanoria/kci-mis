import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export function HomeButton() {
  return (
    <Button variant="outline" size="icon" asChild>
      <Link href="/">
        <Home />
        <span className="sr-only">Home</span>
      </Link>
    </Button>
  );
}
