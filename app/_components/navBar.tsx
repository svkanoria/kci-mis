"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeButton } from "./homeButton";
import { HelpSheet } from "./helpSheet";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUser, useClerk } from "@clerk/nextjs";
import { useHeaderTitleStore } from "@/lib/store";
import Link from "next/link";

export function NavBar() {
  const pathname = usePathname();

  if (pathname?.startsWith("/sign-in") || pathname?.startsWith("/studio")) {
    return null;
  }

  const { user } = useUser();
  const { signOut } = useClerk();
  const { title } = useHeaderTitleStore();
  const [minDate, setMinDate] = useState<string | null>(null);
  const [maxDate, setMaxDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sales-date-range")
      .then((res) => res.json())
      .then((data) => {
        const fmt = (val: string) =>
          new Date(val).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });
        if (data.maxDate) setMaxDate(fmt(data.maxDate));
        if (data.minDate) setMinDate(fmt(data.minDate));
      })
      .catch(() => {});
  }, []);

  const isHomePage = pathname === "/";

  return (
    <nav className="flex items-center justify-between px-4 h-14 border-b bg-background shadow-md shrink-0">
      <div className="flex items-center">
        {!isHomePage && <HomeButton />}
        {title && <h1 className="ml-4 text-lg font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-4">
        {(maxDate || minDate) && (
          <div className="hidden sm:grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 items-center">
            {maxDate && (
              <>
                <span className="text-xs text-muted-foreground leading-tight">
                  Latest
                </span>
                <span className="text-xs text-muted-foreground leading-tight font-medium text-right">
                  {maxDate}
                </span>
              </>
            )}
            {minDate && (
              <>
                <span className="text-xs text-muted-foreground/60 leading-tight">
                  Since
                </span>
                <span className="text-xs text-muted-foreground/60 leading-tight text-right">
                  {minDate}
                </span>
              </>
            )}
          </div>
        )}
        {user && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <User className="h-5 w-5" />
                <span className="sr-only">User menu</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <h4 className="font-medium leading-none">Account</h4>
                  <p className="text-sm text-muted-foreground break-all">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
                <div className="border-t pt-2 mt-2 flex flex-col gap-1">
                  <HelpSheet>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                    >
                      Help
                    </Button>
                  </HelpSheet>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="w-full justify-start"
                  >
                    <Link href="/admin">Admin</Link>
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => signOut({ redirectUrl: "/" })}
                  className="w-full"
                >
                  Log out
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </nav>
  );
}
