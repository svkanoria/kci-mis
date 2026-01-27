import { Heading } from "@/components/typography/heading";
import Link from "next/link";
import { ArrowRight, MapPin, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderTitleUpdater } from "../_components/headerTitleUpdater";

export default function AdminPage() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <HeaderTitleUpdater title="Admin" />
      <div className="mb-12 text-center space-y-4">
        <Heading
          level="h1"
          className="text-4xl font-extrabold tracking-tight lg:text-5xl"
        >
          Administration
        </Heading>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Manage application settings and data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AdminCard
          href="/admin/routes"
          title="Routes"
          description="Manage delivery routes and distances."
          icon={<Route className="w-6 h-6" />}
        />
        <AdminCard
          href="/admin/destinations"
          title="Destinations"
          description="Manage delivery destinations and coordinates."
          icon={<MapPin className="w-6 h-6" />}
        />
      </div>
    </div>
  );
}

interface AdminCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconContainerClassName?: string;
}

function AdminCard({
  href,
  title,
  description,
  icon,
  iconContainerClassName,
}: AdminCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <div className="h-full rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50 p-6 flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <div
            className={cn(
              "p-3 rounded-lg transition-colors",
              iconContainerClassName ||
                "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
            )}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-xl">{title}</h3>
        </div>
        <p className="text-muted-foreground mb-6 grow">{description}</p>
        <div className="flex items-center text-sm font-medium text-primary mt-auto">
          Manage{" "}
          <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
