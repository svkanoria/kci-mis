import { Heading } from "@/components/typography/heading";
import Link from "next/link";
import { ArrowRight, BarChart3, Users, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderTitleUpdater } from "./_components/headerTitleUpdater";

export default async function Home() {
  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <HeaderTitleUpdater title="KCIL" />
      <div className="mb-12 text-center space-y-4">
        <Heading
          level="h1"
          className="text-4xl font-extrabold tracking-tight lg:text-5xl"
        >
          Investigative MIS
        </Heading>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Select a report below to get started.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <ReportCard
          href="/topCustomersFD"
          title="Top Customers FD"
          description="View and analyse top performing Formaldehyde customers."
          icon={<Users className="w-6 h-6" />}
          iconContainerClassName="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
        />

        <ReportCard
          href="/lostCustomersFD"
          title="Lost Customers FD"
          description="View Formaldehyde customers lost over time."
          icon={<TrendingDown className="w-6 h-6" />}
          iconContainerClassName="bg-destructive/10 text-destructive group-hover:bg-destructive group-hover:text-destructive-foreground"
        />

        <ReportCard
          href="/customerBuyingPatternFD"
          title="Buying Pattern FD"
          description="View and analyse Formaldehyde customer buying patterns."
          icon={<BarChart3 className="w-6 h-6" />}
          iconContainerClassName="bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white"
        />
      </div>
    </div>
  );
}

interface ReportCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconContainerClassName: string;
}

function ReportCard({
  href,
  title,
  description,
  icon,
  iconContainerClassName,
}: ReportCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <div className="h-full rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/50 p-6 flex flex-col">
        <div className="flex items-center gap-4 mb-4">
          <div
            className={cn(
              "p-3 rounded-lg transition-colors",
              iconContainerClassName,
            )}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-xl">{title}</h3>
        </div>
        <p className="text-muted-foreground mb-6 grow">{description}</p>
        <div className="flex items-center text-sm font-medium text-primary mt-auto">
          View Report{" "}
          <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
