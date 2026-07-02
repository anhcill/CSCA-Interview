import { prisma } from "../../db/prisma.js";
import { NotFoundError } from "../../utils/errors.js";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata?: any
) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      metadata: metadata || null,
    },
  });
}

export async function getUserNotifications(userId: string, limit = 20, offset = 0) {
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({
      where: { userId },
    }),
  ]);

  return {
    notifications,
    total,
  };
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new NotFoundError("Không tìm thấy thông báo");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { count };
}
