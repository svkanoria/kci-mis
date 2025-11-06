import React from "react";
import { clsx } from "clsx";

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
};

export const Heading: React.FC<HeadingProps> = ({
  level,
  children,
  className,
  ...props
}) => {
  const Tag = level;

  const baseClasses: Record<HeadingProps["level"], string> = {
    h1: "text-4xl font-bold mb-4",
    h2: "text-3xl font-semibold mb-3",
    h3: "text-2xl font-medium mb-2",
    h4: "text-xl font-medium mb-1",
    h5: "text-lg font-normal mb-1",
    h6: "text-base font-normal mb-1",
  };

  return (
    <Tag className={clsx(baseClasses[level], className)} {...props}>
      {children}
    </Tag>
  );
};
