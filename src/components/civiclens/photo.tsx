"use client";

// CivicLens — optimized passthrough image (photos are already compressed client-side).

import Image, { type ImageProps } from "next/image";

type PhotoProps = Omit<ImageProps, "unoptimized" | "loader" | "alt"> & {
  alt: string; // required for accessibility
};

export function Photo(props: PhotoProps) {
  return <Image {...props} unoptimized alt={props.alt} />;
}
