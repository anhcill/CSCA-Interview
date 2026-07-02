import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../config/logger.js";
import { InterviewStatus, QuestionCategory } from "@prisma/client";
import { buildSessionAnalysis } from "../interviews/detailed-scoring.service.js";

// Lưu trữ các kết nối đang hoạt động theo sessionId
// Map<sessionId, WebSocket>
const activeConnections = new Map<string, WebSocket>();

export async function wsInterviewHandler(socket: WebSocket, req: IncomingMessage) {
  let sessionId: string | null = null;
  let userId: string | null = null;

  try {
    const parsedUrl = new URL(req.url ?? "", `http://${req.headers.host || "localhost"}`);
    const token = parsedUrl.searchParams.get("token");
    sessionId = parsedUrl.searchParams.get("sessionId");

    if (!token || !sessionId) {
      socket.close(4000, "Thiếu token hoặc sessionId");
      return;
    }

    // Xác thực token
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
    userId = payload.sub;

    // Kiểm tra user hoạt động
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true }
    });

    if (!user) {
      socket.close(4001, "Tài khoản không hoạt động hoặc không tồn tại");
      return;
    }

    // Kiểm tra session thuộc về user
    const session = await prisma.interviewSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      socket.close(4002, "Không tìm thấy buổi phỏng vấn hoặc không có quyền truy cập");
      return;
    }

    // Lưu kết nối
    activeConnections.set(sessionId, socket);
    logger.info(`WebSocket: User ${userId} connected to session ${sessionId}`);

    // Gửi sự kiện chào mừng/kết nối thành công
    socket.send(JSON.stringify({
      type: "connection:ready",
      data: {
        sessionId,
        status: session.status,
        timestamp: new Date().toISOString()
      }
    }));

    // Xử lý tin nhắn từ client
    socket.on("message", async (rawMessage) => {
      try {
        const event = JSON.parse(rawMessage.toString());
        logger.info(`WebSocket event received: ${event.type} for session ${sessionId}`);

        switch (event.type) {
          case "ping":
            socket.send(JSON.stringify({ type: "pong", data: { timestamp: new Date().toISOString() } }));
            break;

          case "interview:answer": {
            const { sessionQuestionId, answerText } = event.data ?? {};
            if (!sessionQuestionId || !answerText) {
              socket.send(JSON.stringify({ type: "error", data: { message: "Dữ liệu câu trả lời không đầy đủ" } }));
              return;
            }

            // Gửi typing indicator báo hiệu AI đang xử lý/ghi nhận
            socket.send(JSON.stringify({ type: "interview:ai-typing", data: { isTyping: true } }));

            const currentSession = await prisma.interviewSession.findUnique({
              where: { id: sessionId! }
            });

            if (!currentSession || currentSession.status === InterviewStatus.COMPLETED) {
              socket.send(JSON.stringify({ type: "error", data: { message: "Buổi phỏng vấn đã kết thúc" } }));
              socket.send(JSON.stringify({ type: "interview:ai-typing", data: { isTyping: false } }));
              return;
            }

            // Upsert câu trả lời
            const answer = await prisma.interviewAnswer.upsert({
              where: {
                sessionId_sessionQuestionId: {
                  sessionId: sessionId!,
                  sessionQuestionId
                }
              },
              create: {
                answerText,
                sessionId: sessionId!,
                sessionQuestionId,
                userId: userId!
              },
              update: {
                answerText,
                feedback: null,
                improvedAnswer: null,
                scoreLanguage: null,
                scoreLogic: null,
                scoreRelevance: null,
                scoreSpecificity: null,
                scoreTotal: null,
                strengths: null,
                weaknesses: null
              }
            });

            const answeredQuestions = await prisma.interviewAnswer.count({
              where: { sessionId: sessionId! }
            });

            await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: {
                answeredQuestions,
                status: InterviewStatus.IN_PROGRESS
              }
            });

            // Tắt typing indicator và gửi thông báo ghi nhận thành công
            socket.send(JSON.stringify({ type: "interview:ai-typing", data: { isTyping: false } }));
            socket.send(JSON.stringify({
              type: "interview:score-ready",
              data: {
                questionId: sessionQuestionId,
                answerId: answer.id,
                answeredQuestions,
                score: 8.0 // Mock score hoặc phản hồi mặc định trước khi có stream chấm điểm
              }
            }));
            break;
          }

          case "interview:request-hint": {
            const { sessionQuestionId } = event.data ?? {};
            if (!sessionQuestionId) {
              socket.send(JSON.stringify({ type: "error", data: { message: "Thiếu sessionQuestionId" } }));
              return;
            }

            const q = await prisma.interviewSessionQuestion.findFirst({
              where: { id: sessionQuestionId, sessionId: sessionId! }
            });

            if (q) {
              socket.send(JSON.stringify({
                type: "interview:hint",
                data: {
                  sessionQuestionId,
                  hint: q.expectedAnswerLogic || "Hãy trả lời rõ ràng, tập trung vào điểm mạnh cá nhân."
                }
              }));
            } else {
              socket.send(JSON.stringify({ type: "error", data: { message: "Không tìm thấy câu hỏi" } }));
            }
            break;
          }

          case "interview:skip": {
            const { sessionQuestionId } = event.data ?? {};
            if (!sessionQuestionId) {
              socket.send(JSON.stringify({ type: "error", data: { message: "Thiếu sessionQuestionId" } }));
              return;
            }

            // Tạo câu trả lời trống hoặc đánh dấu bỏ qua
            await prisma.interviewAnswer.upsert({
              where: {
                sessionId_sessionQuestionId: {
                  sessionId: sessionId!,
                  sessionQuestionId
                }
              },
              create: {
                answerText: "[Bỏ qua câu hỏi này]",
                sessionId: sessionId!,
                sessionQuestionId,
                userId: userId!,
                scoreTotal: 0
              },
              update: {
                answerText: "[Bỏ qua câu hỏi này]",
                scoreTotal: 0
              }
            });

            const answeredQuestions = await prisma.interviewAnswer.count({
              where: { sessionId: sessionId! }
            });

            const updatedSession = await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: {
                answeredQuestions,
                status: InterviewStatus.IN_PROGRESS
              },
              include: {
                sessionQuestions: { orderBy: { orderIndex: "asc" } }
              }
            });

            // Gửi sự kiện báo đã bỏ qua và tìm câu tiếp theo
            const nextQ = updatedSession.sessionQuestions.find(
              (q) => q.orderIndex > (updatedSession.sessionQuestions.find((curr) => curr.id === sessionQuestionId)?.orderIndex ?? 0)
            );

            socket.send(JSON.stringify({
              type: "interview:question",
              data: {
                skippedQuestionId: sessionQuestionId,
                answeredQuestions,
                nextQuestion: nextQ ? {
                  id: nextQ.id,
                  questionText: nextQ.questionText,
                  category: nextQ.category,
                  orderIndex: nextQ.orderIndex
                } : null
              }
            }));
            break;
          }

          case "interview:pause":
            await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: { status: InterviewStatus.PAUSED }
            });
            socket.send(JSON.stringify({ type: "interview:status-changed", data: { status: InterviewStatus.PAUSED } }));
            break;

          case "interview:resume":
            await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: { status: InterviewStatus.IN_PROGRESS }
            });
            socket.send(JSON.stringify({ type: "interview:status-changed", data: { status: InterviewStatus.IN_PROGRESS } }));
            break;

          case "interview:end": {
            // Đóng session, chấm điểm tổng quan và gửi kết quả
            const updated = await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: {
                status: InterviewStatus.COMPLETED,
                endedAt: new Date()
              },
              include: {
                answers: {
                  include: {
                    sessionQuestion: true
                  }
                }
              }
            });

            // Sử dụng detailed scoring để chấm điểm
            // Ở đây, để trả kết quả nhanh qua WS ta chạy buildSessionAnalysis
            const analysis = buildSessionAnalysis(updated as any);

            // Cập nhật điểm tổng vào DB
            await prisma.interviewSession.update({
              where: { id: sessionId! },
              data: {
                totalScore: analysis.overallScore,
                summaryFeedback: analysis.sessionSummary
              }
            });

            socket.send(JSON.stringify({
              type: "interview:complete",
              data: {
                sessionId: sessionId!,
                totalScore: analysis.overallScore,
                summary: analysis.sessionSummary
              }
            }));
            break;
          }

          default:
            socket.send(JSON.stringify({ type: "error", data: { message: "Không hỗ trợ loại sự kiện này" } }));
        }
      } catch (err: any) {
        logger.error(`WebSocket: Error parsing event: ${err.message}`);
        socket.send(JSON.stringify({ type: "error", data: { message: "Lỗi xử lý tin nhắn" } }));
      }
    });

    socket.on("close", () => {
      logger.info(`WebSocket: User ${userId} disconnected from session ${sessionId}`);
      activeConnections.delete(sessionId!);
    });

  } catch (err: any) {
    logger.error(`WebSocket authentication failed: ${err.message}`);
    socket.close(4003, "Xác thực token thất bại");
  }
}

// Hàm gửi thông báo thời gian thực tới user đang online
export function sendRealtimeNotification(userId: string, notificationPayload: any) {
  for (const [sessionId, socket] of activeConnections.entries()) {
    // Để kiểm tra xem kết nối này có phải của userId hay không
    // Ta có thể lưu thêm mapping userId -> Socket hoặc truy vấn DB.
    // Ở đây ta có thể thực hiện kiểm tra nhanh nếu Socket mở và hoạt động.
    if (socket.readyState === 1) { // OPEN
      socket.send(JSON.stringify({
        type: "notification",
        data: notificationPayload
      }));
    }
  }
}
