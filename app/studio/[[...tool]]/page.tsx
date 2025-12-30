/**
 * This route is responsible for the built-in authoring environment using Sanity Studio.
 * All routes under your studio path will be handled by this file using Next.js Catch-all Routes.
 */
import { NextStudio } from "next-sanity/studio";
import config from "@/sanity.config";
import { currentUser } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export { metadata, viewport } from "next-sanity/studio";

export default async function StudioPage() {
  const user = await currentUser();
  const allowedEmail = "saumya.kanoria@kanoriachem.com";

  const hasAccess = user?.emailAddresses.some(
    (email) => email.emailAddress === allowedEmail,
  );

  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2">You do not have permission to access the CMS.</p>
          <a
            href="/"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Go back home
          </a>
        </div>
      </div>
    );
  }

  return <NextStudio config={config} />;
}
