import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function AdminHomeLink() {
  return (
    <span className="inline-flex items-center">
      <Link
        href="/admin"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        Admin
      </Link>
      <ChevronRight className="mx-2 h-6 w-6 text-muted-foreground" />
    </span>
  );
}
