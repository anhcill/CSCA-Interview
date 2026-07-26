"use client";

import { CheckCircle2, MessageSquareText, Send, Sparkles, Star, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { consumeLoginWelcomePending, getAuthToken } from "@/lib/auth-client";

type TesterExperienceConfig = {
  feedbackEnabled: boolean;
  feedbackTitle: string;
  welcomeEnabled: boolean;
  welcomeMessage: string;
  welcomeTitle: string;
};

const categories = ["Trải nghiệm chung", "Phỏng vấn AI", "Giao diện", "Lỗi kỹ thuật", "Khác"];

export function UserTestExperience() {
  const [config, setConfig] = useState<TesterExperienceConfig | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [category, setCategory] = useState(categories[0]);
  const [messageLength, setMessageLength] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;

    void apiGet<{ config: TesterExperienceConfig }>("/api/site-experience/config", {
      cacheMs: 0,
      token: getAuthToken()
    }).then((response) => {
      if (!active) return;
      setConfig(response.config);
      if (consumeLoginWelcomePending() && response.config.welcomeEnabled) {
        setWelcomeOpen(true);
      }
    }).catch(() => {
      if (active) consumeLoginWelcomePending();
    });

    return () => {
      active = false;
    };
  }, []);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = messageRef.current?.value.trim() ?? "";
    if (message.length < 5) {
      setError("Đại ca mô tả thêm một chút để đội ngũ xử lý chính xác nhé.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await apiPost("/api/site-experience/feedback", {
        category,
        message: message.trim(),
        pageUrl: window.location.href,
        rating
      }, { token: getAuthToken() });
      setSubmitted(true);
      if (messageRef.current) messageRef.current.value = "";
      setMessageLength(0);
      setRating(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa thể gửi góp ý lúc này.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeFeedback() {
    setFeedbackOpen(false);
    window.setTimeout(() => setSubmitted(false), 180);
  }

  return (
    <>
      {config?.feedbackEnabled ? (
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="focus-ring fixed bottom-24 right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-black text-primary-foreground shadow-[0_14px_34px_rgba(184,29,36,0.28)] transition hover:-translate-y-0.5 hover:bg-primary/90 lg:bottom-6 lg:right-6"
          aria-label="Gửi góp ý cho MOLY"
        >
          <MessageSquareText size={19} aria-hidden="true" />
          <span className="hidden sm:inline">{config.feedbackTitle}</span>
        </button>
      ) : null}

      {welcomeOpen && config ? (
        <Modal ariaLabel={config.welcomeTitle} onClose={() => setWelcomeOpen(false)}>
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-primary">
              <Sparkles size={30} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-primary">MOLY · 留学中国</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">{config.welcomeTitle}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-muted-foreground">{config.welcomeMessage}</p>
            <button
              type="button"
              onClick={() => setWelcomeOpen(false)}
              className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground"
            >
              Bắt đầu trải nghiệm
            </button>
          </div>
        </Modal>
      ) : null}

      {feedbackOpen && config ? (
        <Modal ariaLabel={config.feedbackTitle} onClose={closeFeedback}>
          {submitted ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={52} aria-hidden="true" />
              <h2 className="mt-4 text-xl font-black">MOLY đã nhận được góp ý</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">Cảm ơn bạn đã giúp trải nghiệm phỏng vấn tốt hơn.</p>
              <button type="button" onClick={closeFeedback} className="focus-ring mt-6 min-h-11 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground">
                Hoàn tất
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Đợt trải nghiệm MOLY</p>
              <h2 className="mt-1 text-xl font-black">{config.feedbackTitle}</h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">Bạn thấy phần nào tốt hoặc cần sửa? Góp ý sẽ được gửi thẳng tới admin.</p>

              <form onSubmit={submitFeedback} className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-black">Nội dung liên quan</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="focus-ring min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold">
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>

                <fieldset>
                  <legend className="text-sm font-black">Mức độ hài lòng <span className="font-semibold text-muted-foreground">(không bắt buộc)</span></legend>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg hover:bg-amber-50"
                        aria-label={`${value} sao`}
                      >
                        <Star size={22} className={rating && value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-black">Góp ý của bạn</span>
                  <textarea
                    ref={messageRef}
                    onInput={(event) => setMessageLength(event.currentTarget.value.length)}
                    onKeyDown={(event) => event.stopPropagation()}
                    maxLength={5000}
                    rows={5}
                    placeholder="Ví dụ: câu hỏi chưa sát ngành, AI ngắt mic sớm..."
                    className="focus-ring min-h-32 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm font-semibold leading-6 placeholder:font-medium"
                    required
                  />
                  <span className="mt-1 block text-right text-xs font-bold text-muted-foreground">{messageLength}/5000</span>
                </label>

                {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}

                <button type="submit" disabled={submitting} className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground disabled:opacity-60">
                  <Send size={17} aria-hidden="true" />
                  {submitting ? "Đang gửi..." : "Gửi góp ý"}
                </button>
              </form>
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function Modal({ ariaLabel, children, onClose }: { ariaLabel: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-label={ariaLabel} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl sm:p-7">
        <button type="button" onClick={onClose} className="focus-ring absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Đóng">
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  );
}
