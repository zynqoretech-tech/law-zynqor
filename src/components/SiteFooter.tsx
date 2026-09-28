import { Link } from "@tanstack/react-router";
import logo from "@/assets/alwakeel-logo.jpeg";

export function SiteFooter() {
  return (
    <footer className="border-t border-gold-soft/40 bg-overlay/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="الوكيل"
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-gold/40"
            />
            <div>
              <div className="font-display text-lg text-gradient-gold font-bold">الوكيل</div>
              <div className="text-[10px] text-gold/60">— والله خير وكيل —</div>
            </div>
          </div>
          <p className="text-xs text-foreground/60 mt-4 leading-relaxed">
            أول منصة قانونية ذكية في مصر تجمع المحامين والموكلين تحت سقف واحد.
          </p>
        </div>

        <FooterCol title="استكشف">
          <FooterLink to="/">الرئيسية</FooterLink>
          <FooterLink to="/marketplace">السوق القانوني</FooterLink>
          <FooterLink to="/ai-assistant">المساعد الذكي</FooterLink>
          <FooterLink to="/pricing">الأسعار</FooterLink>
          <FooterLink to="/about">من نحن</FooterLink>
        </FooterCol>

        <FooterCol title="قانوني">
          <FooterLink to="/privacy">سياسة الخصوصية</FooterLink>
          <FooterLink to="/terms">شروط الاستخدام</FooterLink>
        </FooterCol>

        <FooterCol title="الحساب">
          <FooterLink to="/auth">تسجيل الدخول</FooterLink>
          <FooterLink to="/auth">إنشاء حساب</FooterLink>
        </FooterCol>
      </div>

      <div className="border-t border-gold-soft/20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-foreground/50">
          <div>© 2025 الوكيل — جميع الحقوق محفوظة</div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.zynqor.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/60 hover:text-gold transition"
            >
              powered by <span className="text-gold font-semibold">Zynqor</span>
            </a>
            <span className="text-gold/60">والله خير وكيل</span>
          </div>
        </div>
      </div>

    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-gold mb-3">{title}</div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-xs text-foreground/70 hover:text-gold transition"
      >
        {children}
      </Link>
    </li>
  );
}
