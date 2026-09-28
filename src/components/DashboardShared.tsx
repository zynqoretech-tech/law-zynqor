import { Link } from "@tanstack/react-router";

export function DashStat({
  label, value, hint, icon, loading = false,
}: {
  label: string; value: string | number; hint?: string; icon?: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-elevated rounded w-1/2 mb-3" />
        <div className="h-8 bg-elevated rounded w-3/4" />
      </div>
    );
  }
  return (
    <div className="bg-surface border border-gold-soft/40 rounded-2xl p-5 hover:border-gold/40 transition">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-foreground/60 mb-1">{label}</div>
          <div className="font-display text-3xl text-gradient-gold font-bold">{value}</div>
          {hint && <div className="text-xs text-foreground/50 mt-1">{hint}</div>}
        </div>
        {icon && <div className="text-3xl">{icon}</div>}
      </div>
    </div>
  );
}

export function DashCard({ title, href, desc }: { title: string; href: string; desc: string }) {
  return (
    <Link to={href} className="bg-surface/60 border border-border hover:border-gold rounded-2xl p-5 transition block">
      <div className="font-display text-lg text-foreground mb-1">{title}</div>
      <div className="text-sm text-foreground/60">{desc}</div>
    </Link>
  );
}

export function EmptyState({ icon, title, desc, cta, ctaHref }: {
  icon: string; title: string; desc?: string; cta?: string; ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="font-display text-xl text-foreground mb-2">{title}</h3>
      {desc && <p className="text-foreground/60 text-sm mb-6 max-w-sm">{desc}</p>}
      {cta && ctaHref && (
        <Link to={ctaHref} className="bg-gold-gradient text-primary-foreground font-semibold px-6 py-2.5 rounded-xl shadow-gold hover:scale-[1.02] transition">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open, title, desc, onConfirm, onCancel, danger = true,
}: {
  open: boolean; title: string; desc?: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-surface border border-gold-soft/40 rounded-2xl p-6 max-w-sm w-full shadow-gold">
        <h3 className="font-display text-xl text-foreground mb-2">{title}</h3>
        {desc && <p className="text-sm text-foreground/60 mb-6">{desc}</p>}
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 font-semibold py-2.5 rounded-lg transition ${
              danger
                ? "bg-destructive/20 border border-destructive/40 text-destructive hover:bg-destructive/30"
                : "bg-gold-gradient text-primary-foreground shadow-gold"
            }`}
          >
            تأكيد
          </button>
          <button onClick={onCancel} className="flex-1 border border-border text-foreground/70 py-2.5 rounded-lg hover:bg-surface">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}