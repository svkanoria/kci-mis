import { client } from "@/sanity/lib/client";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { Heading } from "@/components/typography/heading";

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

async function getHelpArticles() {
  const query = `*[_type == "helpArticle"]{
    _id,
    title,
    content
  }`;
  return client.fetch(query);
}

export default async function HelpPage() {
  const articles = await getHelpArticles();

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div>
        <Heading level="h1">Help Page</Heading>
      </div>

      <div className="grid gap-6">
        {articles.map((article: any) => (
          <div key={article._id} className="border p-6 rounded-lg shadow-sm">
            <Heading level="h2">{article.title}</Heading>
            <div className="prose dark:prose-invert max-w-none">
              <PortableText value={article.content} components={components} />
            </div>
          </div>
        ))}

        {articles.length === 0 && (
          <p className="text-muted-foreground">
            No help articles found. Please check back later.
          </p>
        )}
      </div>
    </div>
  );
}
