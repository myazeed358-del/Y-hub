import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { attendanceRepository as repo } from "./repository";
export function QrPanel({ session, ar }: { session: string; ar: boolean }) {
  const [image, setImage] = useState(""),
    [expires, setExpires] = useState(""),
    [failed, setFailed] = useState(false),
    [interval, setIntervalSeconds] = useState(10);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let expiry: ReturnType<typeof setTimeout>;
    async function refresh() {
      setImage("");
      try {
        const started = performance.now();
        const qr = await repo.qr(session);
        // Use server time so a wrong device clock can't extend the QR.
        const remaining = Date.parse(qr.expiresAt) - Date.parse(qr.serverTime) -
          (performance.now() - started);
        if (remaining <= 0) throw new Error("Expired");
        const url = new URL("/y-attendance", window.location.origin);
        url.hash = qr.token;
        const png = await QRCode.toDataURL(url.href, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!active) return;
        const ttl = Date.parse(qr.expiresAt) - Date.parse(qr.serverTime) -
          (performance.now() - started);
        if (ttl <= 0) throw new Error("Expired");
        setIntervalSeconds(qr.intervalSeconds);
        setImage(png);
        setExpires(qr.expiresAt);
        setFailed(false);
        expiry = setTimeout(() => {
          setImage("");
        }, Math.max(0, ttl));
        timer = setTimeout(() => void refresh(), Math.max(100, ttl + 100));
      } catch {
        if (active) {
          setFailed(true);
          setImage("");
          timer = setTimeout(() => void refresh(), 3000);
        }
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [session]);
  return (
    <div className="space-y-2">
      {image
        ? (
          <img
            src={image}
            width={320}
            height={320}
            alt={ar ? "رمز الحضور المتجدد" : "Rotating attendance QR"}
            className="max-w-full"
          />
        )
        : <p role="status">{ar ? "جارٍ تحديث الرمز…" : "Refreshing QR…"}</p>}
      {expires && (
        <p className="text-sm">
          {ar ? "صالح حتى" : "Valid until"}{" "}
          {new Date(expires).toLocaleTimeString()}
        </p>
      )}
      {failed && (
        <p role="alert">
          {ar
            ? "تعذر تحميل رمز صالح. أعد فتح الجلسة للتحقق من حالتها."
            : "Unable to obtain a valid QR. Refresh the session status."}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {ar
          ? `يتجدد كل ${interval} ثانية. استخدم كاميرا الهاتف لفتح الرابط ثم تأكيد الحضور. مشاركة الرمز بين الأشخاص ما زالت ممكنة.`
          : `Changes every ${interval} seconds. Open with your phone camera and confirm attendance. Sharing a live code remains possible.`}
      </p>
    </div>
  );
}
