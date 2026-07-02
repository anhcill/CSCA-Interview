import { Router } from "express";
import { requireAuth, type AuthenticatedUser } from "../auth/auth.middleware.js";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from "./notifications.service.js";
import { parsePagination, paginatedResponse } from "../../utils/pagination.js";

export const notificationsRouter = Router();

// Tất cả các routes trong notifications đều yêu cầu authentication
notificationsRouter.use(requireAuth);

// GET /api/notifications - Lấy danh sách thông báo của người dùng (phân trang)
notificationsRouter.get("/", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const { limit, page, skip } = parsePagination(req.query);

  const result = await getUserNotifications(user.id, limit, skip);

  res.json(paginatedResponse(result.notifications, result.total, page, limit));
});

// GET /api/notifications/unread-count - Lấy số lượng thông báo chưa đọc
notificationsRouter.get("/unread-count", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const result = await getUnreadCount(user.id);
  res.json(result);
});

// PUT /api/notifications/read-all - Đánh dấu tất cả thông báo là đã đọc
notificationsRouter.put("/read-all", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  await markAllAsRead(user.id);
  res.json({ message: "Đã đánh dấu tất cả thông báo là đã đọc" });
});

// PUT /api/notifications/:id/read - Đánh dấu một thông báo cụ thể là đã đọc
notificationsRouter.put("/:id/read", async (req, res) => {
  const user = res.locals.user as AuthenticatedUser;
  const { id } = req.params;

  await markAsRead(id, user.id);
  res.json({ message: "Đã đánh dấu thông báo là đã đọc" });
});
