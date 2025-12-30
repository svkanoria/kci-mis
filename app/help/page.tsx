import { client } from "@/sanity/lib/client";
import { PortableText } from "@portabletext/react";
import { Heading } from "@/components/typography/heading";

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
              <PortableText value={article.content} />
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
