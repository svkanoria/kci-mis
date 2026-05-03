"use client";

import { useState } from "react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { Heading } from "@/components/typography/heading";
import { client } from "@/sanity/lib/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => <Heading level="h1">{children}</Heading>,
    h2: ({ children }) => <Heading level="h2">{children}</Heading>,
    h3: ({ children }) => <Heading level="h3">{children}</Heading>,
    h4: ({ children }) => <Heading level="h4">{children}</Heading>,
    normal: ({ children }) => <p className="mb-4 leading-7">{children}</p>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-muted pl-4 italic my-4 text-muted-foreground">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
    ),
  },
  marks: {
    code: ({ children }) => (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
        {children}
      </code>
    ),
    link: ({ value, children }) => {
      const target = (value?.href || "").startsWith("http")
        ? "_blank"
        : undefined;
      return (
        <a
          href={value?.href}
          target={target}
          rel={target === "_blank" ? "noindex nofollow" : undefined}
          className="text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {children}
        </a>
      );
    },
  },
};

function ArticleCard({ article }: { article: HelpArticle }) {
  return (
    <div className="border p-6 rounded-lg shadow-sm">
      <Heading level="h2">{article.title}</Heading>
      <div className="prose dark:prose-invert max-w-none">
        <PortableText value={article.content} components={components} />
      </div>
    </div>
  );
}

const query = `*[_type == "helpArticle" && (scope == "common" || (scope == "specific" && $page in pages[]))]{ _id, title, content, scope }`;

type HelpArticle = {
  _id: string;
  title: string;
  content: any;
  scope: string;
};

export function HelpSheet({
  children,
  page,
}: {
  children: React.ReactNode;
  page?: string;
}) {
  const [articles, setArticles] = useState<HelpArticle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedPage, setFetchedPage] = useState<string | undefined>(undefined);

  function handleOpenChange(open: boolean) {
    if (open && (articles === null || fetchedPage !== page) && !loading) {
      setLoading(true);
      client
        .fetch(query, { page: page ?? "" })
        .then((data) => {
          setArticles(data);
          setFetchedPage(page);
        })
        .catch(() => setArticles([]))
        .finally(() => setLoading(false));
    }
  }

  const commonArticles = articles?.filter((a) => a.scope === "common") ?? [];
  const pageArticles = articles?.filter((a) => a.scope !== "common") ?? [];

  return (
    <Sheet onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Help</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1 pr-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && articles && articles.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No help articles found. Please check back later.
            </p>
          )}
          {!loading && articles && articles.length > 0 && (
            <Tabs defaultValue={pageArticles.length > 0 ? "page" : "general"}>
              <TabsList>
                {pageArticles.length > 0 && (
                  <TabsTrigger value="page">This Page</TabsTrigger>
                )}
                {commonArticles.length > 0 && (
                  <TabsTrigger value="general">General</TabsTrigger>
                )}
              </TabsList>
              {pageArticles.length > 0 && (
                <TabsContent value="page" className="grid gap-6">
                  {pageArticles.map((article) => (
                    <ArticleCard key={article._id} article={article} />
                  ))}
                </TabsContent>
              )}
              {commonArticles.length > 0 && (
                <TabsContent value="general" className="grid gap-6">
                  {commonArticles.map((article) => (
                    <ArticleCard key={article._id} article={article} />
                  ))}
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
