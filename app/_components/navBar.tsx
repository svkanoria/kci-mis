"use client";

import { usePathname } from "next/navigation";
import { HomeButton } from "./homeButton";
import { User, HelpCircle } from "lucide-react";
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

  const isHomePage = pathname === "/";

  return (
    <nav className="flex items-center justify-between px-4 h-14 border-b bg-background shadow-md">
      <div className="flex items-center">
        {!isHomePage && <HomeButton />}
        {title && <h1 className="ml-4 text-lg font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Help">
          <Link href="/help">
            <HelpCircle className="h-5 w-5" />
            <span className="sr-only">Help</span>
          </Link>
        </Button>
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
