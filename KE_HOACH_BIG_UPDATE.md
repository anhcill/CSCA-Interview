# KẾ HOẠCH BIG UPDATE: PHÂN TÁCH KHÔNG GIAN ADMIN/USER, GIAO DIỆN ĐẬM CHẤT TRUNG HOA & TỐI ƯU HÓA DATABASE

Kế hoạch này cung cấp mô tả kỹ thuật chi tiết nhất cho việc tái cấu trúc hệ thống. Chúng tôi phân chia dự án thành 3 nhánh công việc chạy song song cho 3 Agent, chỉ định rõ tên file, đoạn mã thay đổi, cấu trúc cơ sở dữ liệu và các cơ chế bảo mật/hiệu năng.

---

## 🔴 PHÂN TÍCH THỰC TRẠNG CODE HIỆN TẠI (Snapshot trước Big Update)

### Cấu trúc hiện tại cần nắm rõ:

| Thành phần | File/Vị trí | Trạng thái hiện tại | Vấn đề |
|---|---|---|---|
| App Shell | `frontend/components/app-shell.tsx` | Dùng chung 1 layout sidebar cho cả User + Admin | Admin/User lẫn lộn, sidebar hiện cùng nav items |
| Admin Layout | `frontend/app/admin/layout.tsx` | Chỉ wrap class `admin-theme`, KHÔNG có shell riêng | Admin phụ thuộc hoàn toàn vào AppShell |
| CSS Theme | `frontend/app/globals.css` | Bảng màu xanh lam Education Blue (`--primary: 221 83% 53%`) | Chưa mang phong cách du học Trung |
| Design Tokens | `frontend/app/design-tokens.css` | `--color-education-600: #2563eb` (xanh lam) | Cần đổi sang đỏ hoàng gia |
| Interview Flow | `frontend/components/interview/interview-setup.tsx` | Form đơn trang, ko có wizard steps | Người dùng bị overwhelm thông tin |
| Interview Routes | `backend/src/modules/interviews/interviews.routes.ts` | ~800+ dòng, logic + query trộn lẫn trong router | Cần tách ra service layer |
| Cache Service | `backend/src/cache/cache.service.ts` | **ĐÃ CÓ SẴN** Redis + memory fallback (`getCachedJson`/`setCachedJson`) | Plan cũ nói tạo `node-cache` mới → SAI, dùng lại cái có sẵn |
| Schema Indexes | `backend/prisma/schema.prisma` | Có nhiều index đơn BỊ TRÙNG (vd: `@@index([role])` + `@@index([role], map: "idx_users_role")`) | Cleanup trùng trước khi thêm composite |
| Admin Backend Guard | `backend/src/modules/admin/admin.routes.ts` | Chưa rõ có `requireAdmin` middleware riêng chưa | Cần tạo/xác nhận middleware chặn user thường |
| Login Redirect | Frontend `auth-client.ts` | Redirect nằm ở frontend, KHÔNG phải backend JWT | Plan cũ nói sai "backend trả JWT redirect" |

### Các file hiện có trong dự án (quan trọng):

```
frontend/
├── app/
│   ├── (auth)/             ← Login/Register pages
│   ├── admin/              ← Admin pages (analytics, users, questions, schools...)
│   │   └── layout.tsx      ← CHỈ wrap class admin-theme
│   ├── dashboard/          ← User dashboard
│   ├── interview/          ← setup/, history/, result/
│   ├── profile/
│   ├── globals.css         ← CSS variables (hiện xanh lam)
│   ├── design-tokens.css   ← Design system tokens
│   └── layout.tsx          ← Root layout, wrap AppShell
├── components/
│   ├── app-shell.tsx       ← LAYOUT CHÍNH (sidebar + header + mobile nav)
│   ├── interview/          ← interview-setup, interview-room, interview-result...
│   ├── dashboard/
│   └── ui/

backend/
├── src/
│   ├── cache/cache.service.ts    ← Redis + memory cache (ĐÃ CÓ)
│   ├── modules/
│   │   ├── admin/admin.routes.ts
│   │   ├── auth/auth.middleware.ts
│   │   ├── interviews/
│   │   │   ├── interviews.routes.ts  ← 800+ dòng (cần tách)
│   │   │   └── interviews.service.ts
│   │   ├── schools/schools.routes.ts
│   │   ├── majors/majors.routes.ts
│   │   └── scholarships/scholarships.routes.ts
│   └── middleware/
├── prisma/schema.prisma    ← 30+ models, nhiều index trùng
```

---

## 👥 Tóm Tắt Nhiệm Vụ 3 Agent Song Song

```
+--------------------------------------------------------------------------------------+
|                                   BIG UPDATE PLAN                                    |
+------------------------------------+-------------------------------------------------+
| Agent                              | Trọng tâm Kỹ thuật                              |
+------------------------------------+-------------------------------------------------+
| Agent 1: UI/UX & Flow Người Dùng   | CSS HSL tokens, Top Navbar, Wizard Funnel       |
| Agent 2: Tách Biệt Admin           | AdminShell, Cổng bảo vệ, Import Excel/CSV       |
| Agent 3: SQL & Caching & Routes    | Composite Indexes, Select Query, Dùng cache sẵn |
+------------------------------------+-------------------------------------------------+
```

### ⚠️ CONFLICT ZONE & QUY TẮC MERGE

```
┌─────────────────────────────────────────────────────────────────┐
│  FILE XUNG ĐỘT: frontend/components/app-shell.tsx              │
│  → Agent 2 sửa TRƯỚC (thêm nhánh AdminShell)                  │
│  → Agent 1 sửa SAU (đổi user layout sang Top Navbar)           │
│  → Hoặc: Merge manual sau khi cả 2 agent hoàn thành            │
│                                                                 │
│  CÁC FILE KHÁC: KHÔNG có xung đột giữa 3 agent                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Kế Hoạch Chi Tiết Cho Từng Agent

### 🎨 Agent 1: Tái Thiết Kế UI/UX Người Dùng & Phong Cách Trung Hoa Cổ Điển - Hiện Đại

### 1. Nâng Cấp Hệ Màu & Tokens Lấy Cảm Hứng Du Học Trung Quốc (China Study Aesthetic)
Chúng ta sẽ thay thế bảng màu xanh lam (Education Blue) mặc định bằng hệ màu biểu trưng của văn hóa Trung Hoa (Đỏ Cung Đình, Vàng Kim, Trắng Ngà) phối hợp tinh tế với các yếu tố hiện đại.

*   **Tập tin sửa đổi**: `frontend/app/globals.css`
    *   **Mã thay đổi chi tiết**:
        ```css
        /* globals.css */
        :root {
          /* HSL: Sắc độ (Hue) - Độ bão hòa (Saturation) - Độ sáng (Lightness) */
          --background: 36 33% 96%;     /* Màu trắng ngà/Giấy tuyên chỉ ấm áp (#FAF6F0) */
          --foreground: 20 20% 12%;     /* Màu mực tàu sẫm (#1F1C18) */
          --border: 24 15% 85%;         /* Màu viền xám ấm nhạt */
          
          --primary: 357 73% 42%;       /* Đỏ thắm Cung Đình (#B81D24) */
          --primary-foreground: 0 0% 100%;
          
          --accent: 39 77% 56%;         /* Vàng hoàng kim/Vàng cát (#E5A93B) */
          --accent-foreground: 20 20% 12%;
          
          --muted: 36 20% 90%;          /* Màu đất nung/gốm nhạt */
          --muted-foreground: 20 10% 40%;
          
          --success: 145 63% 38%;       /* Xanh ngọc phỉ thúy (#2E7D32) */
          --error: 0 74% 48%;           /* Đỏ son cảnh báo */
        }

        :root.dark {
          --background: 20 20% 9%;      /* Màu xám đen của đá than mực */
          --foreground: 36 20% 94%;
          --border: 20 15% 18%;
          --primary: 357 73% 48%;       /* Đỏ thắm sáng nhẹ cho chế độ tối */
          --accent: 39 77% 50%;
          --muted: 20 15% 15%;
        }
        ```

*   **Tập tin sửa đổi**: `frontend/app/design-tokens.css`
    *   **Mã thay đổi chi tiết**:
        ```css
        /* design-tokens.css */
        :root {
          --color-education-50: #fff5f5;
          --color-education-100: #ffe3e3;
          --color-education-600: #b81d24; /* Thay màu xanh lam cũ bằng màu đỏ hoàng gia */
          --color-education-700: #961319;
          --color-scholarship-50: #fefbeb;
          --color-scholarship-500: #e5a93b; /* Vàng kim */
          
          /* Họa tiết và bóng đổ */
          --radius-ui: 10px; /* Bo góc mềm mại hơn */
          --shadow-ui: 0 10px 30px rgba(184, 29, 36, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02);
        }
        
        .page-band {
          /* Gradient chuyển sắc từ đỏ nhạt sang màu nền ấm */
          background: 
            linear-gradient(180deg, rgba(184, 29, 36, 0.05) 0%, transparent 100%),
            hsl(var(--background));
        }
        ```

### 2. Thiết Kế Top Navbar Cho Người Dùng (Thay Thế Sidebar Cũ)
Chúng ta sẽ tạo một component Navbar phía trên hoàn toàn mới cho User và tích hợp vào shell.

*   **Tập tin tạo mới**: `frontend/components/user-navbar.tsx`
    *   **Giao diện Desktop (≥1024px)**:
        *   **Chiều cao**: `h-16` (64px) cố định, `position: sticky; top: 0; z-index: 50;`
        *   Nền `bg-background/90` kèm hiệu ứng mờ kính `backdrop-blur-md` và viền dưới `border-b border-border`.
        *   **Phần bên trái**: Logo hình chiếc khiên/họa tiết ngọc bội kết hợp chữ thư pháp hiện đại.
        *   **Menu giữa**: Các liên kết Dashboard, Luyện tập, Lịch sử, Hồ sơ sắp xếp nằm ngang rộng rãi, có hiệu ứng gạch chân màu Vàng hoàng kim (`--accent`) trượt khi di chuột qua (hover animation).
        *   **Dropdown User**: Hiển thị avatar tròn của học viên, click hiển thị menu nhỏ (Xem hồ sơ cá nhân, Chuyển ngôn ngữ, Đăng xuất).
    *   **Giao diện Mobile (<1024px)**:
        *   **Hamburger Menu**: Nút 3 gạch bên phải, click mở overlay menu full-width slide từ trên xuống.
        *   **Menu items**: Xếp dọc, font lớn, min-height 48px mỗi item (đạt chuẩn touch target).
        *   **BỎ bottom tab bar cũ** trong `app-shell.tsx` cho user path (thay bằng hamburger).
        *   **Nút CTA nổi bật**: "Bắt đầu phỏng vấn" luôn hiển thị trên mobile menu.
    *   **Mã tham chiếu (skeleton)**:
        ```typescript
        // frontend/components/user-navbar.tsx
        "use client";
        import { useState } from "react";
        import Link from "next/link";
        import { usePathname } from "next/navigation";
        import { Menu, X, GraduationCap, BarChart3, ClipboardList, User, LogOut } from "lucide-react";
        import type { AuthUser } from "@/lib/auth-client";
        import type { Locale } from "@/lib/i18n";
        
        const navItems = [
          { href: "/dashboard", icon: BarChart3, label: "Dashboard" },
          { href: "/interview/setup", icon: GraduationCap, label: "Luyện tập" },
          { href: "/interview/history", icon: ClipboardList, label: "Lịch sử" },
          { href: "/profile", icon: User, label: "Hồ sơ" },
        ];
        
        interface UserNavbarProps {
          currentUser: AuthUser | null;
          locale: Locale;
        }
        
        export function UserNavbar({ currentUser, locale }: UserNavbarProps) {
          const pathname = usePathname();
          const [mobileOpen, setMobileOpen] = useState(false);
          // ... render logic
        }
        ```

### 3. Thiết Kế Luồng Phễu Phỏng Vấn Tuyến Tính (Wizard Flow)
Tối ưu hóa tệp tin `frontend/components/interview/interview-setup.tsx` để dẫn dắt học viên qua từng bước không bị rối loạn thông tin.

> **CHIA PHASE**: Wizard 6 bước quá nặng nếu làm 1 lần. Chia thành 2 phase:
> - **Phase 1 (Big Update lần này)**: 4 bước cốt lõi (Profile → Mục tiêu → Chế độ → Vào phỏng vấn)
> - **Phase 2 (Update sau)**: Thêm Study Plan AI Analysis + Radar Chart kết quả nâng cao

*   **Files tạo mới**:
    *   `frontend/components/interview/progress-tracker.tsx` — Thanh tiến trình nằm ngang
    *   `frontend/components/interview/wizard-steps.tsx` — Chứa từng Step component

*   **Bố cục giao diện Phase 1 (4-Step Wizard)**:
    *   **Thanh tiến trình (Progress Tracker)**: Nằm ngang phía trên cùng với các chấm tròn ngọc lục bảo và đường nối động biểu thị trạng thái hoàn thành.
    *   **Trình tự các bước Phase 1**:
        1.  **Bước 1: Profile cá nhân**: Nhập tên tiếng Trung, điểm HSK/IELTS, GPA.
        2.  **Bước 2: Mục tiêu**: Chọn Hệ đào tạo (Đại học/Thạc sĩ), Tên trường mục tiêu, Chuyên ngành và Hệ Học bổng apply.
        3.  **Bước 3: Thiết lập chế độ**: Chọn chế độ luyện tập (Có gợi ý, Thi thử thời gian thực, Phòng chấm điểm) + Chọn ngôn ngữ phỏng vấn.
        4.  **Bước 4: Xác nhận & Bắt đầu**: Tóm tắt thông tin đã nhập, nút "Bắt đầu phỏng vấn" gọi API `POST /api/interviews`.
    *   **Trình tự các bước Phase 2 (bổ sung sau)**:
        5.  **Bước 5: Phân tích Study Plan**: Khung nhập kế hoạch học tập → AI phân tích trực tiếp.
        6.  **Bước 6: Nhận kết quả nâng cao**: Radar Chart + báo cáo lỗi phát âm/logic.

*   **Mã tham chiếu Progress Tracker**:
    ```typescript
    // frontend/components/interview/progress-tracker.tsx
    interface ProgressTrackerProps {
      currentStep: number;
      totalSteps: number;
      stepLabels: string[];
    }
    
    export function ProgressTracker({ currentStep, totalSteps, stepLabels }: ProgressTrackerProps) {
      return (
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto mb-8">
          {stepLabels.map((label, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${isCompleted ? 'bg-[hsl(var(--success))] text-white' : ''}
                  ${isActive ? 'bg-[hsl(var(--primary))] text-white ring-4 ring-[hsl(var(--primary)/0.2)]' : ''}
                  ${!isCompleted && !isActive ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]' : ''}
                `}>
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span className="hidden sm:inline text-xs font-bold">{label}</span>
                {index < totalSteps - 1 && (
                  <div className={`h-0.5 w-8 sm:w-16 ${isCompleted ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--border))]'}`} />
                )}
              </div>
            );
          })}
        </div>
      );
    }
    ```

---

## 🛡️ Agent 2: Phân Tách Không Gian Quản Trị (Admin Portal) Độc Lập

### 1. Xây Dựng `AdminShell` Và Cơ Chế Bỏ Qua User Layout
Admin cần làm việc trên một không gian tách biệt hoàn toàn để tránh thao tác nhầm lẫn và nâng cao tính bảo mật.

*   **Tập tin sửa đổi**: `frontend/components/app-shell.tsx`
    *   **Mã thay đổi logic**:
        ```typescript
        // Trong AppShell component (app-shell.tsx)
        const isAdminPath = activePathname.startsWith("/admin");
        
        // Nếu là trang quản trị, render AdminShell riêng biệt
        if (isAdminPath) {
          return (
            <AdminShell 
              currentUser={currentUser} 
              locale={locale} 
              activePathname={activePathname}
            >
              {children}
            </AdminShell>
          );
        }
        
        // Ngược lại, hiển thị User Layout với Top Navbar mới
        return (
          <div className="min-h-screen bg-background text-foreground">
            <UserNavbar currentUser={currentUser} locale={locale} />
            <main id="main-content" className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
              {children}
            </main>
          </div>
        );
        ```

*   **Tập tin tạo mới**: `frontend/components/admin-shell.tsx`
    *   **Giao diện Admin**:
        *   Tông màu chủ đạo: Tối sang trọng (Charcoal `#1E293B`, viền thép sáng `#334155`).
        *   Bố cục: Sidebar bên trái có khả năng thu gọn (Collapse) chứa các tác vụ:
            *   📊 Báo cáo chung (Analytics)
            *   👥 Quản lý tài khoản học viên (Users)
            *   📂 Ngân hàng câu hỏi (Questions)
            *   🏫 Quản lý Trường & Ngành (Schools/Majors)
            *   🎁 Quản lý Học bổng (Scholarships)
            *   📜 Audit Logs hệ thống

### 2. Thiết Lập Hệ Thống Route Guard Bảo Vệ (Frontend + Backend)
Ngăn chặn tuyệt đối việc người dùng thường truy cập trang quản trị và điều hướng thông minh.

#### 2a. Frontend Route Guard (đã có sẵn một phần trong `app-shell.tsx`)

*   **Trạng thái hiện tại**: `app-shell.tsx` ĐÃ CÓ logic check `isAdminPath && !adminRoles.includes(role)` → set `authStatus = "forbidden"` → hiển thị `PageAccessDeniedState`. **Cái này giữ nguyên và cải thiện.**
*   **Bổ sung**:
    *   Tạo trang `/403-forbidden` đẹp mắt thay vì chỉ dùng inline component.
    *   **Tập tin tạo mới**: `frontend/app/403-forbidden/page.tsx`
    ```typescript
    // frontend/app/403-forbidden/page.tsx
    import Link from "next/link";
    export default function ForbiddenPage() {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="text-6xl font-black text-[hsl(var(--error))] mb-4">403</div>
            <h1 className="type-title mb-2">Không có quyền truy cập</h1>
            <p className="text-[hsl(var(--muted-foreground))] mb-6">
              Tài khoản của bạn không có quyền mở khu vực này.
            </p>
            <Link href="/dashboard" className="ds-button-primary inline-flex items-center px-6 py-3">
              Về Dashboard
            </Link>
          </div>
        </div>
      );
    }
    ```

#### 2b. Frontend Login Redirect (SỬA ĐÚNG VỊ TRÍ)

> **LƯU Ý QUAN TRỌNG**: Login redirect hiện nằm ở **frontend** (file auth-client hoặc login page), KHÔNG phải backend JWT redirect. Plan cũ nói sai.

*   **Vị trí sửa**: Frontend login page hoặc `lib/auth-client.ts` — sau khi login thành công:
    ```typescript
    // Trong login success handler
    const user = getStoredUser();
    if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      router.push('/admin');
    } else {
      router.push(nextUrl || '/dashboard');
    }
    ```

#### 2c. Backend Admin Middleware (BẮT BUỘC - Plan cũ thiếu)

> **Plan cũ chỉ nói frontend guard, THIẾU backend guard.** User thường vẫn có thể gọi thẳng API `/api/admin/*` bằng Postman/curl nếu không có backend middleware.

*   **Tập tin tạo mới**: `backend/src/middleware/require-admin.ts`
    ```typescript
    // backend/src/middleware/require-admin.ts
    import type { Request, Response, NextFunction } from "express";
    import type { AuthenticatedUser } from "../modules/auth/auth.middleware.js";
    
    const adminRoles = ["ADMIN", "SUPER_ADMIN"];
    
    export function requireAdmin(req: Request, res: Response, next: NextFunction) {
      const user = res.locals.user as AuthenticatedUser | undefined;
      if (!user) {
        res.status(401).json({ message: "Chưa đăng nhập" });
        return;
      }
      if (!adminRoles.includes(user.role)) {
        res.status(403).json({ message: "Không có quyền quản trị" });
        return;
      }
      next();
    }
    ```
*   **Tập tin sửa**: `backend/src/modules/admin/admin.routes.ts`
    ```typescript
    // Thêm vào đầu file
    import { requireAdmin } from "../../middleware/require-admin.js";
    
    // Áp middleware cho toàn bộ admin routes
    adminRouter.use(requireAuth);
    adminRouter.use(requireAdmin);
    ```

### 3. Xây Dựng Trình Import Excel/CSV Cho Admin
*   **Tập tin tạo mới**: `frontend/components/admin/questions-importer.tsx`
    *   **Tính năng**:
        *   Nút kéo thả file (`.xlsx`, `.csv`).
        *   Sử dụng thư viện `xlsx` hoặc `papaparse` phía Client để phân tích cấu trúc file thành JSON.
        *   Kiểm tra định dạng bằng Zod client-side để hiển thị lỗi lập tức (ví dụ: thiếu cột `questionText`, định dạng ngôn ngữ `language` không hợp lệ...).
        *   Gửi mảng câu hỏi đã validate qua endpoint API quản trị `POST /api/admin/questions/import` bằng batch transaction để tối ưu hóa.

### 4. Nâng Cấp Admin Dashboard Page
*   **Tập tin sửa**: `frontend/app/admin/page.tsx`
    *   **Giao diện mới**:
        *   4 thẻ thống kê nhanh (Tổng học viên, Tổng phỏng vấn, Điểm TB, Câu hỏi trong bank)
        *   Biểu đồ hoạt động 7 ngày gần nhất
        *   Danh sách 5 học viên hoạt động gần nhất
        *   Quick actions: Thêm câu hỏi, Import Excel, Xem audit logs

---

## ⚡ Agent 3: Đánh Chỉ Mục SQL, Tối Ưu Prisma Truy Vấn & Refactor Server Logic

### 0. Cleanup Duplicate Indexes (LÀM TRƯỚC TIÊN)

> **Vấn đề phát hiện**: Schema hiện tại có nhiều index ĐƠN bị khai báo TRÙNG. Ví dụ model `User`:
> ```prisma
> @@index([role])                          ← Prisma auto
> @@index([role], map: "idx_users_role")   ← Manual, TRÙNG với dòng trên
> ```
> Tương tự ở `AuthSession`, `UserProfile`, `School`, `Major`, `Scholarship`, `Question`, `InterviewSession`, `InterviewAnswer`.

*   **Tập tin sửa đổi**: `backend/prisma/schema.prisma`
*   **Hành động**: Xóa các `@@index` không có `map:` (Prisma auto-generated) vì đã có bản `map:` rồi. Giữ bản có `map:` vì tên index rõ ràng hơn.
*   **Danh sách index trùng cần xóa**:
    | Model | Index trùng cần XÓA | Giữ lại |
    |---|---|---|
    | User | `@@index([role])`, `@@index([isActive])`, `@@index([createdAt])` | Giữ các bản có `map:` |
    | AuthSession | `@@index([userId])`, `@@index([expiresAt])` | Giữ các bản có `map:` |
    | UserProfile | `@@index([degreeLevel])`, `@@index([targetSchool])`, `@@index([targetMajor])` | Giữ các bản có `map:` |
    | School | `@@index([city])`, `@@index([province])`, `@@index([isActive])` | Giữ các bản có `map:` |
    | Major | `@@index([degreeLevel])`, `@@index([isActive])` | Giữ các bản có `map:` |
    | Scholarship | `@@index([isActive])` | Giữ bản có `map:` |
    | Question | `@@index([degreeLevel])`, `@@index([schoolId])`, ... tất cả 8 cái | Giữ các bản có `map:` |
    | InterviewSession | `@@index([userId])`, `@@index([status])`, ... | Giữ các bản có `map:` |
    | InterviewAnswer | `@@index([sessionId])`, `@@index([userId])`, `@@index([scoreTotal])` | Giữ các bản có `map:` |

### 1. Đột Phá Tốc Độ Truy Vấn Bằng Chỉ Mục Composite (Composite Indexes)
Sau khi cleanup, khai báo các index phức hợp mới.

*   **Tập tin sửa đổi**: `backend/prisma/schema.prisma`
    *   **Mã khai báo bổ sung**:
        ```prisma
        model InterviewSession {
          // Các trường dữ liệu hiện tại...

          @@index([userId, status, createdAt(sort: Desc)], name: "idx_interview_sessions_user_status_created")
          @@index([userId, createdAt(sort: Desc)], name: "idx_interview_sessions_user_created")
          @@index([userId, status, totalScore], name: "idx_interview_sessions_user_status_score")
          @@map("interview_sessions")
        }

        model InterviewAnswer {
          // Các trường dữ liệu hiện tại...

          @@index([sessionId, scoreTotal], name: "idx_interview_answers_session_score")
          @@map("interview_answers")
        }

        model Question {
          // Các trường dữ liệu hiện tại...

          @@index([degreeLevel, schoolId, majorId, scholarshipId, isActive], name: "idx_questions_lookup")
          @@map("questions")
        }
        ```
    *   **Quy trình chạy migration**:
        ```powershell
        # Bước 1: Cleanup indexes
        npx prisma migrate dev --name cleanup_duplicate_indexes
        # Bước 2: Thêm composite indexes  
        npx prisma migrate dev --name add_composite_performance_indexes
        ```
    *   **Rollback plan** (nếu migration fail):
        ```powershell
        # Revert migration cuối cùng
        npx prisma migrate resolve --rolled-back add_composite_performance_indexes
        # Hoặc reset dev database
        npx prisma migrate reset
        ```

### 2. Tối Ưu Hóa Tải Dữ Liệu Prisma (Prisma Select Optimization)
Thay vì tải toàn bộ quan hệ (relation) chứa các trường dữ liệu văn bản AI cực dài hoặc bản ghi thừa thãi, chúng ta sẽ chỉ định chính xác các cột cần thiết ở các API danh sách.

*   **Tập tin sửa đổi**: `backend/src/modules/interviews/interviews.service.ts`
    *   **Trước tối ưu (Ví dụ)**:
        ```typescript
        // Lấy lịch sử phỏng vấn bị chậm do tải cả feedback dài của từng câu trả lời
        const sessions = await prisma.interviewSession.findMany({
          where: { userId },
          include: { answers: true }
        });
        ```
    *   **Mã sau khi tối ưu**:
        ```typescript
        // Chỉ select những cột cần thiết cho màn hình danh sách lịch sử phỏng vấn
        export async function getUserInterviewSessionsList(userId: string, limit = 10, skip = 0) {
          return await prisma.interviewSession.findMany({
            where: { userId },
            take: limit,
            skip: skip,
            select: {
              id: true,
              createdAt: true,
              status: true,
              totalScore: true,
              mode: true,
              targetSchool: true,
              targetMajor: true,
              scholarshipType: true,
              answeredQuestions: true,
              totalQuestions: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          });
        }
        ```

### 3. Refactor `interviews.routes.ts` & Triển Khai Caching Cho Metadata

#### 3a. Tách logic từ routes → service

*   **Tập tin sửa đổi**: `backend/src/modules/interviews/interviews.routes.ts` (hiện **800+ dòng**)
*   **Tập tin sửa đổi**: `backend/src/modules/interviews/interviews.service.ts`
*   **Nhiệm vụ**: Quét toàn bộ file router, bóc tách các khối query/logic ra service. Router chỉ còn: parse input → gọi service → trả response.
*   **Danh sách hàm cần tách sang `interviews.service.ts`**:

    | Hàm trong routes (hiện tại inline) | Tên hàm mới trong service |
    |---|---|
    | Logic trong `POST /` (tạo session) | `createInterviewSession(userId, data)` |
    | Logic trong `GET /stats` | `getUserInterviewStats(userId)` |
    | Logic trong `POST /:id/complete` | `completeInterviewSession(sessionId, userId)` |
    | `findBankQuestions()` | Di chuyển nguyên sang service |
    | `buildPreparedQuestions()` | Di chuyển nguyên sang service |
    | `checkAiCallBudget()` | Di chuyển nguyên sang service |
    | `findSchoolTarget/findMajorTarget/findScholarshipTarget` | Di chuyển nguyên sang service |
    | `persistInterviewReport()` | Di chuyển nguyên sang service |
    | `toSessionDto()` / `toQuestionDto()` | Di chuyển sang service hoặc file `interviews.dto.ts` |

*   **Mục tiêu**: `interviews.routes.ts` còn dưới **200 dòng**, mỗi route handler ≤ 20 dòng.

#### 3b. Caching Metadata — DÙNG LẠI `cache.service.ts` CÓ SẴN

> **⚠️ SỬA LỖI PLAN CŨ**: Plan cũ nói dùng `node-cache` mới → **SAI**. Dự án ĐÃ CÓ `backend/src/cache/cache.service.ts` cung cấp `getCachedJson<T>(key)` và `setCachedJson(key, payload, ttlMs)` với Redis + memory fallback. **DÙNG LẠI**, KHÔNG thêm dependency mới.

*   **Tập tin sửa đổi**: `backend/src/modules/schools/schools.routes.ts` (và tương tự Majors/Scholarships)
*   **Mã đúng cách (dùng cache có sẵn)**:
    ```typescript
    // backend/src/modules/schools/schools.routes.ts
    import { getCachedJson, setCachedJson } from "../../cache/cache.service.js";
    import { prisma } from "../../db/prisma.js";
    
    const CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút
    
    export async function getCachedSchools() {
      const cacheKey = "metadata:schools:active";
      const cached = await getCachedJson<any[]>(cacheKey);
      if (cached) return cached;
      
      const schools = await prisma.school.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          nameZh: true,
          nameEn: true,
          city: true,
          province: true,
          ranking: true
        },
        orderBy: { name: "asc" }
      });
      
      await setCachedJson(cacheKey, schools, CACHE_TTL_MS);
      return schools;
    }
    
    // Tương tự cho getCachedMajors(), getCachedScholarships()
    ```
*   **Áp dụng tương tự cho**:
    *   `backend/src/modules/majors/majors.routes.ts` → `getCachedMajors()`
    *   `backend/src/modules/scholarships/scholarships.routes.ts` → `getCachedScholarships()`

---

---

## 📋 TỔNG HỢP DANH SÁCH FILES CỦA TỪNG AGENT

### 🎨 Agent 1 — Files

| Hành động | File | Mô tả |
|---|---|---|
| SỬA | `frontend/app/globals.css` | Đổi bảng màu HSL sang Trung Hoa |
| SỬA | `frontend/app/design-tokens.css` | Đổi education tokens sang đỏ/vàng |
| TẠO MỚI | `frontend/components/user-navbar.tsx` | Top Navbar desktop + hamburger mobile |
| TẠO MỚI | `frontend/components/interview/progress-tracker.tsx` | Thanh tiến trình wizard |
| TẠO MỚI | `frontend/components/interview/wizard-steps.tsx` | Các step components |
| SỬA | `frontend/components/app-shell.tsx` | User path dùng Navbar (SAU Agent 2) |
| SỬA | `frontend/components/interview/interview-setup.tsx` | Refactor thành wizard 4 bước |
| SỬA | `frontend/components/interview/interview-room.tsx` | UI phòng thi phong cách mới |
| SỬA | `frontend/components/interview/interview-result.tsx` | Kết quả phong cách mới |

### 🛡️ Agent 2 — Files

| Hành động | File | Mô tả |
|---|---|---|
| TẠO MỚI | `frontend/components/admin-shell.tsx` | Admin sidebar tối, collapsible |
| TẠO MỚI | `frontend/app/403-forbidden/page.tsx` | Trang từ chối quyền truy cập |
| TẠO MỚI | `frontend/components/admin/questions-importer.tsx` | Import Excel/CSV |
| TẠO MỚI | `backend/src/middleware/require-admin.ts` | Backend admin guard middleware |
| SỬA | `frontend/components/app-shell.tsx` | Admin path → render AdminShell (LÀM TRƯỚC Agent 1) |
| SỬA | `frontend/app/admin/layout.tsx` | Tích hợp AdminShell |
| SỬA | `frontend/app/admin/page.tsx` | Admin dashboard mới |
| SỬA | `backend/src/modules/admin/admin.routes.ts` | Áp requireAdmin middleware |
| SỬA | Frontend login page/auth-client | Admin redirect logic |

### ⚡ Agent 3 — Files

| Hành động | File | Mô tả |
|---|---|---|
| SỬA | `backend/prisma/schema.prisma` | Cleanup trùng + thêm composite indexes |
| SỬA | `backend/src/modules/interviews/interviews.routes.ts` | Tách logic → service (800→200 dòng) |
| SỬA | `backend/src/modules/interviews/interviews.service.ts` | Nhận logic từ routes |
| SỬA | `backend/src/modules/schools/schools.routes.ts` | Thêm cache dùng `cache.service.ts` |
| SỬA | `backend/src/modules/majors/majors.routes.ts` | Thêm cache dùng `cache.service.ts` |
| SỬA | `backend/src/modules/scholarships/scholarships.routes.ts` | Thêm cache dùng `cache.service.ts` |
| KHÔNG TẠO | ~~node-cache mới~~ | Dùng `cache.service.ts` có sẵn |

---

## 🔢 THỨ TỰ THỰC HIỆN TỪNG AGENT (Step-by-step)

### 🎨 Agent 1 — Thứ tự 7 bước:
```
Bước 1 → globals.css + design-tokens.css (đổi bảng màu)
Bước 2 → Tạo components/user-navbar.tsx (Top Navbar + hamburger mobile)
Bước 3 → Sửa app-shell.tsx phần User layout (SAU KHI Agent 2 xong bước 2)
Bước 4 → Tạo progress-tracker.tsx + wizard-steps.tsx
Bước 5 → Refactor interview-setup.tsx → Wizard 4 bước
Bước 6 → Sửa interview-room.tsx (UI phong cách mới)
Bước 7 → Sửa interview-result.tsx (kết quả phong cách mới)
```

### 🛡️ Agent 2 — Thứ tự 7 bước:
```
Bước 1 → Tạo backend/src/middleware/require-admin.ts
Bước 2 → Sửa admin.routes.ts (áp requireAdmin)
Bước 3 → Tạo components/admin-shell.tsx
Bước 4 → Sửa app-shell.tsx phần Admin routing (LÀM TRƯỚC Agent 1)
Bước 5 → Sửa app/admin/layout.tsx + app/admin/page.tsx
Bước 6 → Tạo app/403-forbidden/page.tsx
Bước 7 → Sửa login redirect cho admin
Bước 8 → Tạo components/admin/questions-importer.tsx
```

### ⚡ Agent 3 — Thứ tự 6 bước:
```
Bước 1 → Cleanup duplicate indexes trong schema.prisma
Bước 2 → Thêm composite indexes + chạy migration
Bước 3 → Tách hàm từ interviews.routes.ts → interviews.service.ts
Bước 4 → Tối ưu Prisma select (bỏ include dư thừa)
Bước 5 → Thêm cache cho schools/majors/scholarships routes (dùng cache.service.ts)
Bước 6 → EXPLAIN ANALYZE benchmark + verify
```

---

## 📅 Quy Trình Xác Minh & Đo Lường

### 1. Kiểm thử hiệu năng SQL (Database Benchmarking)
*   Sử dụng lệnh `EXPLAIN ANALYZE` trong PostgreSQL để so sánh tốc độ quét các bảng dữ liệu trước và sau khi đánh index.
*   Mục tiêu: Truy vấn danh sách lịch sử phỏng vấn của học viên phải phản hồi `< 50ms`.
*   **Câu lệnh benchmark cụ thể**:
    ```sql
    -- Benchmark 1: Lịch sử phỏng vấn user (dùng composite index mới)
    EXPLAIN ANALYZE
    SELECT id, status, total_score, created_at
    FROM interview_sessions
    WHERE user_id = 'UUID_HERE' AND status = 'COMPLETED'
    ORDER BY created_at DESC
    LIMIT 10;
    
    -- Benchmark 2: Tìm câu hỏi theo tiêu chí (dùng idx_questions_lookup)
    EXPLAIN ANALYZE
    SELECT id, question_text, category, difficulty
    FROM questions
    WHERE degree_level = 'BACHELOR'
      AND is_active = true
      AND language = 'ZH'
    LIMIT 50;
    
    -- Benchmark 3: Điểm trung bình answers (dùng idx_interview_answers_session_score)
    EXPLAIN ANALYZE
    SELECT AVG(score_total)
    FROM interview_answers
    WHERE session_id = 'UUID_HERE' AND score_total IS NOT NULL;
    ```

### 2. Kiểm thử phân quyền (Security Testing)
*   **Backend test** (dùng curl/Postman):
    *   Đăng nhập bằng tài khoản User thường, lấy JWT token.
    *   Gửi `GET /api/admin/users` với token User → Xác nhận `403 Forbidden`.
    *   Gửi `POST /api/admin/questions/import` với token User → Xác nhận `403 Forbidden`.
    *   Đăng nhập bằng tài khoản Admin, gửi lại → Xác nhận `200 OK`.
*   **Frontend test**:
    *   Đăng nhập User thường → Nhập URL `/admin/questions` thủ công → Xác nhận redirect `/403-forbidden`.
    *   Đăng nhập Admin → Xác nhận tự động redirect về `/admin` (không về `/dashboard`).
    *   Đăng nhập Admin → Kiểm tra sidebar Admin hiển thị đúng, KHÔNG hiển thị User navbar.

### 3. Kiểm thử UI/UX (Visual Testing)
*   **Bảng màu**: Mở trang Dashboard → Xác nhận tông đỏ-vàng-ngà, KHÔNG còn xanh lam.
*   **Navbar**: Desktop ≥1024px → Top navbar nằm ngang. Mobile <1024px → Hamburger menu.
*   **Wizard**: Vào `/interview/setup` → Đi qua 4 bước → Xác nhận progress tracker cập nhật đúng.
*   **Dark mode**: Bật dark mode → Xác nhận tất cả components đọc được, contrast đạt WCAG AA.

### 4. Kiểm thử Cache (Cache Verification)
*   Gọi `GET /api/schools` lần 1 → Ghi nhận thời gian.
*   Gọi `GET /api/schools` lần 2 trong vòng 10 phút → Phải nhanh hơn đáng kể (< 5ms nếu cache hit).
*   Sau 10 phút → Cache expire → Lần gọi tiếp theo query DB lại.
