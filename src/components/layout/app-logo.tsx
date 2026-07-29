import Image from "next/image";
import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  /** Pixel size (width & height). Default 36. */
  size?: number;
  priority?: boolean;
};

/**
 * ExamGrade-Markenzeichen (Dokument + Haken + Notenskala).
 */
export function AppLogo({
  className,
  size = 36,
  priority = false,
}: AppLogoProps) {
  return (
    <Image
      src="/examgrade-logo.jpg"
      alt="ExamGrade"
      width={size}
      height={size}
      priority={priority}
      className={cn(
        "shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-border/60",
        className
      )}
    />
  );
}
