import { defineField, defineType } from "sanity";

const SPECIFIC_PAGE_OPTIONS = [
  { title: "Top Customers", value: "top-customers" },
  { title: "Lost Customers", value: "lost-customers" },
  { title: "Buying Pattern", value: "buying-pattern-fd" },
  { title: "Distribution Pattern", value: "distribution-pattern" },
  { title: "Route Map", value: "route-map" },
];

export const helpArticle = defineType({
  name: "helpArticle",
  title: "Help Article",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: {
        source: "title",
      },
    }),
    defineField({
      name: "scope",
      title: "Visibility",
      type: "string",
      options: {
        list: [
          { title: "Common (all pages)", value: "common" },
          { title: "Specific pages", value: "specific" },
        ],
        layout: "radio",
      },
      initialValue: "common",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "pages",
      title: "Pages",
      type: "array",
      of: [{ type: "string" }],
      description: "Select one or more pages to show this article on.",
      options: {
        list: SPECIFIC_PAGE_OPTIONS,
      },
      hidden: ({ document }) => document?.scope !== "specific",
      validation: (Rule) =>
        Rule.custom((pages, context) => {
          if (
            context.document?.scope === "specific" &&
            (!pages || (pages as string[]).length === 0)
          ) {
            return "Select at least one page.";
          }
          return true;
        }),
    }),
    defineField({
      name: "content",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
  preview: {
    select: {
      title: "title",
      scope: "scope",
      pages: "pages",
    },
    prepare({
      title,
      scope,
      pages,
    }: {
      title: string;
      scope?: string;
      pages?: string[];
    }) {
      if (scope === "common") return { title, subtitle: "Common (all pages)" };
      const labels = (pages ?? []).map(
        (p) => SPECIFIC_PAGE_OPTIONS.find((o) => o.value === p)?.title ?? p,
      );
      return { title, subtitle: labels.join(", ") || "—" };
    },
  },
});
