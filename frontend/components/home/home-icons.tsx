import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
  MessageSquareText,
  School,
  ShieldCheck
} from "lucide-react";

export type HomeIconName =
  | "book"
  | "chart"
  | "clipboard"
  | "graduation"
  | "message"
  | "school"
  | "shield";

export const homeIcons = {
  book: BookOpenCheck,
  chart: BarChart3,
  clipboard: ClipboardCheck,
  graduation: GraduationCap,
  message: MessageSquareText,
  school: School,
  shield: ShieldCheck
} satisfies Record<HomeIconName, typeof GraduationCap>;
