import { MarketingFrame } from "@/components/home/marketing-frame";
import { PaymentPage } from "@/components/payment/payment-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Thanh toán | AI Phỏng Vấn Du Học",
  description: "Bảng giá và thanh toán SePay/VietQR cho các gói luyện phỏng vấn AI.",
  path: "/payment",
  noIndex: true
});

export default function PaymentRoutePage() {
  return (
    <MarketingFrame>
      <PaymentPage />
    </MarketingFrame>
  );
}
