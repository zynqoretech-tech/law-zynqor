import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Item = { id: string; label: string; sub?: string; to: string; group: string };

const NAV: Item[] = [
  { id: "n-home", label: "لوحة التحكم", to: "/dashboard/lawyer/", group: "تنقل" },
  { id: "n-cases", label: "القضايا", to: "/dashboard/lawyer/cases/", group: "تنقل" },
  { id: "n-new-case", label: "قضية جديدة", to: "/dashboard/lawyer/cases/new", group: "تنقل" },
  { id: "n-tasks", label: "المهام", to: "/dashboard/lawyer/tasks", group: "تنقل" },
  { id: "n-deadlines", label: "الآجال القانونية", to: "/dashboard/lawyer/deadlines", group: "تنقل" },
  { id: "n-time", label: "تتبع الوقت", to: "/dashboard/lawyer/time-tracking", group: "تنقل" },
  { id: "n-expenses", label: "المصروفات", to: "/dashboard/lawyer/expenses", group: "تنقل" },
  { id: "n-clients", label: "الموكلون", to: "/dashboard/lawyer/clients", group: "تنقل" },
  { id: "n-calendar", label: "التقويم", to: "/dashboard/lawyer/calendar", group: "تنقل" },
  { id: "n-billing", label: "الأتعاب", to: "/dashboard/lawyer/billing", group: "تنقل" },
  { id: "n-templates", label: "قوالب العقود", to: "/dashboard/lawyer/templates", group: "تنقل" },
  { id: "n-research", label: "البحث القانوني", to: "/dashboard/lawyer/research", group: "تنقل" },
  { id: "n-reports", label: "التقارير", to: "/dashboard/lawyer/reports", group: "تنقل" },
  { id: "n-ai", label: "مساعد AI", to: "/dashboard/lawyer/ai", group: "تنقل" },
  { id: "n-team", label: "إدارة الفريق", to: "/dashboard/lawyer/team", group: "تنقل" },
  { id: "n-profile", label: "ملفي العام", to: "/dashboard/lawyer/profile", group: "تنقل" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { userId, isLawyer } = useAuth();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQ(""); setActive(0); }
  }, [open]);

  useEffect(() => {
    let cancel = false;
    async function run() {
      const term = q.trim();
      const navMatches = NAV.filter((n) => !term || n.label.includes(term));
      if (!term || !userId || !isLawyer) {
        if (!cancel) setResults(navMatches);
        return;
      }
      const like = `%${term}%`;
      const [cases, clients, invoices] = await Promise.all([
        supabase.from("cases").select("id,title,case_number").eq("lawyer_id", userId).or(`title.ilike.${like},case_number.ilike.${like}`).limit(5),
        supabase.from("profiles").select("id,full_name").eq("role", "client").ilike("full_name", like).limit(5),
        supabase.from("invoices").select("id,invoice_number,total_amount").eq("lawyer_id", userId).ilike("invoice_number", like).limit(5),
      ]);
      const cItems: Item[] = (cases.data ?? []).map((c: any) => ({
        id: "c-" + c.id, label: c.title, sub: c.case_number ?? "", group: "قضايا",
        to: `/dashboard/lawyer/cases/${c.id}`,
      }));
      const clItems: Item[] = (clients.data ?? []).map((c: any) => ({
        id: "cl-" + c.id, label: c.full_name, group: "موكلون",
        to: "/dashboard/lawyer/clients",
      }));
      const iItems: Item[] = (invoices.data ?? []).map((i: any) => ({
        id: "i-" + i.id, label: i.invoice_number, sub: `${Number(i.total_amount).toLocaleString()} ج`, group: "فواتير",
        to: "/dashboard/lawyer/billing",
      }));
      if (!cancel) setResults([...navMatches, ...cItems, ...clItems, ...iItems]);
    }
    run();
    return () => { cancel = true; };
  }, [q, userId, isLawyer]);

  if (!open) return null;

  const groups: Record<string, Item[]> = {};
  results.forEach((r) => { (groups[r.group] ||= []).push(r); });

  function select(item: Item) {
    setOpen(false);
    navigate({ to: item.to });
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-start justify-center pt-24 p-4" onClick={() => setOpen(false)}>
      <div className="bg-surface border border-gold-soft/40 rounded-2xl shadow-gold w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-gold" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && results[active]) { e.preventDefault(); select(results[active]); }
            }}
            placeholder="ابحث عن قضية، موكّل، فاتورة، أو صفحة…"
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-foreground/40"
          />
          <kbd className="hidden sm:inline text-[10px] text-foreground/50 border border-border px-1.5 py-0.5 rounded">Esc</kbd>
          <button onClick={() => setOpen(false)} className="text-foreground/50 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="text-center text-foreground/50 text-sm py-8">لا توجد نتائج</div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-foreground/40 bg-elevated/30">{group}</div>
                {items.map((item) => {
                  const idx = results.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => select(item)}
                      className={`w-full text-right px-4 py-2.5 flex items-center justify-between gap-3 text-sm transition ${idx === active ? "bg-gold/10 text-gold" : "text-foreground/85 hover:bg-gold/5"}`}>
                      <span className="truncate">{item.label}</span>
                      {item.sub && <span className="text-xs text-foreground/50 shrink-0">{item.sub}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-[11px] text-foreground/40 flex justify-between">
          <span>↑↓ للتنقل • Enter للفتح</span>
          <span>Ctrl/⌘ + K</span>
        </div>
      </div>
    </div>
  );
}