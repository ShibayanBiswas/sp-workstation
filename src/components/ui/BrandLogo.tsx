"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";

type Props = {
  className?: string;
  priority?: boolean;
};

/**
 * Theme-aware Anand Rathi logo.
 * PNG wordmark for light surfaces; inverted PNG on dark surfaces so it never disappears.
 */
export function BrandLogo({ className = "h-10 w-auto md:h-11", priority = false }: Props) {
  const { theme } = useTheme();

  return (
    <Image
      src="/brand/arwl-logo.png"
      alt="Anand Rathi Wealth"
      width={240}
      height={54}
      priority={priority}
      className={`${className} object-contain object-left ${
        theme === "dark" ? "brightness-0 invert" : ""
      }`}
    />
  );
}
