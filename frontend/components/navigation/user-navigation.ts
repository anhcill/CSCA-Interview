import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Target,
  User,
  type LucideIcon
} from "lucide-react";
import type { Locale } from "@/lib/i18n";

export type UserNavigationGroup = "primary" | "secondary";
export type UserNavigationId =
  | "overview"
  | "new-interview"
  | "history"
  | "progress"
  | "practice-plan"
  | "profile"
  | "payment"
  | "guide";

interface UserNavigationCopy {
  label: string;
  shortLabel: string;
  description: string;
}

interface UserNavigationDefinition {
  id: UserNavigationId;
  href: string;
  icon: LucideIcon;
  group: UserNavigationGroup;
  copy: Record<Locale, UserNavigationCopy>;
}

export interface UserNavigationItem extends UserNavigationCopy {
  id: UserNavigationId;
  href: string;
  icon: LucideIcon;
  group: UserNavigationGroup;
}

export interface UserNavigationUiCopy {
  primaryNavigationLabel: string;
  secondaryNavigationLabel: string;
  mobileNavigationLabel: string;
  menuLabel: string;
  openMenuLabel: string;
  closeMenuLabel: string;
  fallbackTitle: string;
}

const navigationUiCopy: Record<Locale, UserNavigationUiCopy> = {
  vi: {
    primaryNavigationLabel: "Điều hướng chính",
    secondaryNavigationLabel: "Tài khoản và hỗ trợ",
    mobileNavigationLabel: "Điều hướng chính trên thiết bị di động",
    menuLabel: "Menu",
    openMenuLabel: "Mở menu điều hướng",
    closeMenuLabel: "Đóng menu điều hướng",
    fallbackTitle: "Không gian luyện phỏng vấn"
  },
  en: {
    primaryNavigationLabel: "Main navigation",
    secondaryNavigationLabel: "Account and support",
    mobileNavigationLabel: "Main navigation on mobile",
    menuLabel: "Menu",
    openMenuLabel: "Open navigation menu",
    closeMenuLabel: "Close navigation menu",
    fallbackTitle: "Interview practice space"
  },
  zh: {
    primaryNavigationLabel: "主导航",
    secondaryNavigationLabel: "账户与支持",
    mobileNavigationLabel: "移动端主导航",
    menuLabel: "菜单",
    openMenuLabel: "打开导航菜单",
    closeMenuLabel: "关闭导航菜单",
    fallbackTitle: "面试练习空间"
  }
};

const userNavigationDefinitions: readonly UserNavigationDefinition[] = [
  {
    id: "overview",
    href: "/dashboard",
    icon: BarChart3,
    group: "primary",
    copy: {
      vi: {
        label: "Tổng quan",
        shortLabel: "Tổng quan",
        description: "Xem mức độ sẵn sàng và hoạt động gần đây"
      },
      en: {
        label: "Overview",
        shortLabel: "Overview",
        description: "Review your readiness and recent activity"
      },
      zh: {
        label: "概览",
        shortLabel: "概览",
        description: "查看面试准备度和近期活动"
      }
    }
  },
  {
    id: "new-interview",
    href: "/interview/setup",
    icon: GraduationCap,
    group: "primary",
    copy: {
      vi: {
        label: "Phỏng vấn mới",
        shortLabel: "Phỏng vấn",
        description: "Thiết lập và bắt đầu một buổi phỏng vấn"
      },
      en: {
        label: "New interview",
        shortLabel: "Interview",
        description: "Set up and start a new interview"
      },
      zh: {
        label: "开始面试",
        shortLabel: "面试",
        description: "设置并开始一场新的模拟面试"
      }
    }
  },
  {
    id: "history",
    href: "/interview/history",
    icon: ClipboardList,
    group: "primary",
    copy: {
      vi: {
        label: "Lịch sử",
        shortLabel: "Lịch sử",
        description: "Xem lại các buổi phỏng vấn đã thực hiện"
      },
      en: {
        label: "History",
        shortLabel: "History",
        description: "Review your previous interview sessions"
      },
      zh: {
        label: "面试记录",
        shortLabel: "记录",
        description: "查看已完成的模拟面试"
      }
    }
  },
  {
    id: "progress",
    href: "/dashboard#progress",
    icon: Activity,
    group: "primary",
    copy: {
      vi: {
        label: "Tiến bộ",
        shortLabel: "Tiến bộ",
        description: "Theo dõi điểm số và kỹ năng theo thời gian"
      },
      en: {
        label: "Progress",
        shortLabel: "Progress",
        description: "Track scores and skill growth over time"
      },
      zh: {
        label: "学习进度",
        shortLabel: "进度",
        description: "持续跟踪分数和能力提升"
      }
    }
  },
  {
    id: "practice-plan",
    href: "/dashboard#practice-plan",
    icon: Target,
    group: "primary",
    copy: {
      vi: {
        label: "Kế hoạch luyện tập",
        shortLabel: "Kế hoạch",
        description: "Thực hiện các nhiệm vụ luyện tập được đề xuất"
      },
      en: {
        label: "Practice plan",
        shortLabel: "Plan",
        description: "Complete your recommended practice tasks"
      },
      zh: {
        label: "练习计划",
        shortLabel: "计划",
        description: "完成系统推荐的练习任务"
      }
    }
  },
  {
    id: "profile",
    href: "/profile",
    icon: User,
    group: "secondary",
    copy: {
      vi: {
        label: "Hồ sơ",
        shortLabel: "Hồ sơ",
        description: "Cập nhật thông tin và mục tiêu ứng tuyển"
      },
      en: {
        label: "Profile",
        shortLabel: "Profile",
        description: "Update your information and application goals"
      },
      zh: {
        label: "个人资料",
        shortLabel: "资料",
        description: "更新个人信息和申请目标"
      }
    }
  },
  {
    id: "payment",
    href: "/payment",
    icon: CreditCard,
    group: "secondary",
    copy: {
      vi: {
        label: "Gói sử dụng",
        shortLabel: "Gói",
        description: "Quản lý gói và quyền lợi đang sử dụng"
      },
      en: {
        label: "Plans",
        shortLabel: "Plans",
        description: "Manage your plan and included benefits"
      },
      zh: {
        label: "使用套餐",
        shortLabel: "套餐",
        description: "管理当前套餐和所含权益"
      }
    }
  },
  {
    id: "guide",
    href: "/guide",
    icon: BookOpen,
    group: "secondary",
    copy: {
      vi: {
        label: "Hướng dẫn",
        shortLabel: "Hướng dẫn",
        description: "Tìm hiểu cách luyện phỏng vấn hiệu quả"
      },
      en: {
        label: "Guide",
        shortLabel: "Guide",
        description: "Learn how to practise interviews effectively"
      },
      zh: {
        label: "使用指南",
        shortLabel: "指南",
        description: "了解如何高效进行面试练习"
      }
    }
  }
] as const;

function localizeNavigationItem(definition: UserNavigationDefinition, locale: Locale): UserNavigationItem {
  return {
    id: definition.id,
    href: definition.href,
    icon: definition.icon,
    group: definition.group,
    ...definition.copy[locale]
  };
}

export function getUserNavigationItems(locale: Locale) {
  return userNavigationDefinitions.map((item) => localizeNavigationItem(item, locale));
}

export function getPrimaryUserNavigationItems(locale: Locale) {
  return getUserNavigationItems(locale).filter((item) => item.group === "primary");
}

export function getSecondaryUserNavigationItems(locale: Locale) {
  return getUserNavigationItems(locale).filter((item) => item.group === "secondary");
}

export function getMobileUserNavigationItems(locale: Locale) {
  return getPrimaryUserNavigationItems(locale).slice(0, 4);
}

export function getUserNavigationUiCopy(locale: Locale) {
  return navigationUiCopy[locale];
}

interface ParsedNavigationLocation {
  pathname: string;
  hash: string;
}

function normalizePathname(pathname: string) {
  const normalized = pathname.trim() || "/";
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function parseNavigationLocation(location: string): ParsedNavigationLocation {
  const [locationWithoutHash, rawHash = ""] = location.split("#", 2);
  const [rawPathname] = locationWithoutHash.split("?", 1);

  return {
    pathname: normalizePathname(rawPathname),
    hash: rawHash ? `#${rawHash}` : ""
  };
}

export function isUserNavigationItemActive(
  currentLocation: string,
  itemOrHref: Pick<UserNavigationItem, "href"> | string
) {
  const href = typeof itemOrHref === "string" ? itemOrHref : itemOrHref.href;
  const current = parseNavigationLocation(currentLocation);
  const target = parseNavigationLocation(href);

  if (target.hash) {
    return current.pathname === target.pathname && current.hash === target.hash;
  }

  if (target.pathname === "/dashboard" && current.hash) {
    return false;
  }

  return current.pathname === target.pathname || current.pathname.startsWith(`${target.pathname}/`);
}

export function getActiveUserNavigationItem(currentLocation: string, locale: Locale = "vi") {
  return getUserNavigationItems(locale).find((item) => isUserNavigationItemActive(currentLocation, item));
}

export function getUserNavigationTitle(currentLocation: string, locale: Locale = "vi") {
  return getActiveUserNavigationItem(currentLocation, locale)?.label ?? navigationUiCopy[locale].fallbackTitle;
}
