"use client";

import { useEffect, useState } from "react";

export function useHideOnScroll(threshold = 96) {
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;

    function handleScroll() {
      const nextY = window.scrollY;
      setHiddenOnScroll(nextY > threshold && nextY > lastY);
      lastY = nextY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return hiddenOnScroll;
}
