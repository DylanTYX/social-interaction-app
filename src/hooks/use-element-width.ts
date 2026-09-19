"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The rendered width of an element, kept current as it resizes.
 *
 * For an SVG chart that wants readable text: a fixed `viewBox` scaled to a
 * phone shrinks every label with it, so a 760-unit chart on a 312px screen
 * draws its 10px labels at 4px. Drawing the chart at the width it will
 * actually occupy keeps the text at the size it was designed at.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
