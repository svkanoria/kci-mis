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

const query = `*[_type == "helpArticle"]{ _id, title, content }`;

type HelpArticle = { _id: string; title: string; content: any };

export function HelpSheet({ children }: { children: React.ReactNode }) {
  const [articles, setArticles] = useState<HelpArticle[] | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpenChange(open: boolean) {
    if (open && articles === null && !loading) {
      setLoading(true);
      client
        .fetch(query)
        .then((data) => setArticles(data))
        .catch(() => setArticles([]))
        .finally(() => setLoading(false));
    }
  }

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
            <div className="grid gap-6">
              {articles.map((article) => (
                <div
                  key={article._id}
                  className="border p-6 rounded-lg shadow-sm"
                >
                  <Heading level="h2">{article.title}</Heading>
                  <div className="prose dark:prose-invert max-w-none">
                    <PortableText
                      value={article.content}
                      components={components}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
