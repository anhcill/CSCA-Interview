import { Award, BarChart3, BookOpen, GraduationCap, School, User } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

const adminCards = [
  {
    description: "Search, xem profile, lich su, khoa/mo tai khoan.",
    href: "/admin/users",
    icon: User,
    title: "Users"
  },
  {
    description: "Tong user, session, diem trung binh, cau hoi yeu.",
    href: "/admin/analytics",
    icon: BarChart3,
    title: "Analytics"
  },
  {
    description: "Quan ly ngan hang cau hoi, CSV va audio.",
    href: "/admin/questions",
    icon: BookOpen,
    title: "Cau hoi"
  },
  {
    description: "Quan ly danh sach truong dai hoc.",
    href: "/admin/schools",
    icon: School,
    title: "Truong"
  },
  {
    description: "Quan ly nganh hoc theo bac dao tao.",
    href: "/admin/majors",
    icon: GraduationCap,
    title: "Nganh"
  },
  {
    description: "Quan ly chuong trinh hoc bong.",
    href: "/admin/scholarships",
    icon: Award,
    title: "Hoc bong"
  }
] as const;

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Khu vuc quan tri</p>
          <h1 className="mt-2 text-3xl font-bold">Admin</h1>
        </div>
        <LogoutButton />
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} className="rounded-lg border bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-sm" href={card.href}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-lg font-bold">{card.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
