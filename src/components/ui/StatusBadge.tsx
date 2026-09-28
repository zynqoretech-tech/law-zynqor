const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "جارية", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  pending: { label: "معلقة", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  won: { label: "رابحة", color: "bg-gold/15 text-gold border-gold/30" },
  lost: { label: "خاسرة", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  closed: { label: "منتهية", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  paid: { label: "مدفوع", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  overdue: { label: "متأخر", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  draft: { label: "مسودة", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  partial: { label: "جزئي", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "مؤكدة", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "ملغاة", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  completed: { label: "مكتملة", color: "bg-gold/15 text-gold border-gold/30" },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "pending").toLowerCase();
  const s = STATUS_MAP[key] ?? { label: status ?? "—", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  );
}
