import type { Metadata } from "next";
import { MarketingFrame } from "@/components/home/marketing-frame";
import { PaymentPage } from "@/components/payment/payment-page";

export const metadata: Metadata = {
  title: "Thanh toán | AI Phỏng Vấn Du Học",
  description: "Bảng giá và thanh toán SePay/VietQR cho các gói luyện phỏng vấn AI."
};

export default function PaymentRoutePage() {
  return (
    <MarketingFrame>
      <PaymentPage />
    </MarketingFrame>
  );
}
