import { defineField, defineType } from "sanity";

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
      name: "content",
      type: "array",
      of: [{ type: "block" }],
    }),
  ],
});
