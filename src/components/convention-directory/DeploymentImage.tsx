"use client";
import { useState } from "react";
import { DIRECTORY_PLACEHOLDER } from "@/lib/convention-directory/model";

export function DeploymentImage({
  images,
  alt,
  className = "aspect-video w-full object-cover",
}: {
  images?: string[];
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src =
    [...(images ?? []), DIRECTORY_PLACEHOLDER].find(
      (url) => !failed.includes(url),
    ) || DIRECTORY_PLACEHOLDER;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() =>
        setFailed((old) => (old.includes(src) ? old : [...old, src]))
      }
    />
  );
}
