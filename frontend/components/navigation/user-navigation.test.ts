import { describe, expect, it } from "vitest";
import {
  getActiveUserNavigationItem,
  getMobileUserNavigationItems,
  getPrimaryUserNavigationItems,
  getSecondaryUserNavigationItems,
  getUserNavigationItems,
  getUserNavigationUiCopy,
  getUserNavigationTitle,
  isUserNavigationItemActive,
} from "./user-navigation";

describe("user navigation", () => {
  it("cung cấp đủ tám mục và phân nhóm rõ ràng", () => {
    expect(getUserNavigationItems("vi")).toHaveLength(8);
    expect(getPrimaryUserNavigationItems("vi").map((item) => item.id)).toEqual([
      "overview",
      "new-interview",
      "history",
      "progress",
      "practice-plan"
    ]);
    expect(getSecondaryUserNavigationItems("vi").map((item) => item.id)).toEqual([
      "profile",
      "payment",
      "guide"
    ]);
    expect(getMobileUserNavigationItems("vi").map((item) => item.id)).toEqual([
      "overview",
      "new-interview",
      "history",
      "progress"
    ]);
  });

  it("xác định route chính và route con đang active", () => {
    expect(isUserNavigationItemActive("/interview/setup", "/interview/setup")).toBe(true);
    expect(isUserNavigationItemActive("/interview/setup/quick", "/interview/setup")).toBe(true);
    expect(isUserNavigationItemActive("/interview/history", "/interview/setup")).toBe(false);
    expect(getActiveUserNavigationItem("/profile")?.id).toBe("profile");
  });

  it("phân biệt tổng quan với các khu vực neo trên dashboard", () => {
    expect(getActiveUserNavigationItem("/dashboard")?.id).toBe("overview");
    expect(getActiveUserNavigationItem("/dashboard#progress")?.id).toBe("progress");
    expect(getActiveUserNavigationItem("/dashboard#practice-plan")?.id).toBe("practice-plan");
    expect(isUserNavigationItemActive("/dashboard#progress", "/dashboard")).toBe(false);
    expect(isUserNavigationItemActive("/dashboard?range=30#progress", "/dashboard#progress")).toBe(true);
  });

  it("trả về tiêu đề thân thiện khi route không thuộc điều hướng", () => {
    expect(getUserNavigationTitle("/interview/history")).toBe("Lịch sử");
    expect(getUserNavigationTitle("/notifications")).toBe("Không gian luyện phỏng vấn");
  });

  it("dịch đầy đủ các mục và tiêu đề dự phòng theo locale", () => {
    const englishItems = getUserNavigationItems("en");
    const chineseItems = getUserNavigationItems("zh");

    expect(englishItems).toHaveLength(8);
    expect(chineseItems).toHaveLength(8);
    expect(englishItems.find((item) => item.id === "practice-plan")).toMatchObject({
      label: "Practice plan",
      shortLabel: "Plan"
    });
    expect(chineseItems.find((item) => item.id === "new-interview")).toMatchObject({
      label: "开始面试",
      shortLabel: "面试"
    });
    expect(getUserNavigationTitle("/dashboard#progress", "en")).toBe("Progress");
    expect(getUserNavigationTitle("/dashboard#practice-plan", "zh")).toBe("练习计划");
    expect(getUserNavigationTitle("/notifications", "en")).toBe("Interview practice space");
    expect(getUserNavigationTitle("/notifications", "zh")).toBe("面试练习空间");
  });

  it("dịch nhãn accessibility của điều hướng mobile", () => {
    expect(getUserNavigationUiCopy("vi").openMenuLabel).toBe("Mở menu điều hướng");
    expect(getUserNavigationUiCopy("en").mobileNavigationLabel).toBe("Main navigation on mobile");
    expect(getUserNavigationUiCopy("zh").closeMenuLabel).toBe("关闭导航菜单");
  });
});
