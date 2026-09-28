import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Star, MapPin, Briefcase, SlidersHorizontal, X, BadgeCheck, Video, Building2, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { saveAuthIntent } from "@/lib/auth-intent";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "السوق القانوني — محامون معتمدون | الوكيل" },
      { name: "description", content: "ابحث وقارن بين أفضل المحامين ومكاتب المحاماة المعتمدة في مصر حسب التخصص، التقييم، السعر، والمدينة." },
      { property: "og:title", content: "السوق القانوني — محامون معتمدون | الوكيل" },
      { property: "og:description", content: "قارن بين مكاتب المحاماة والمحامين المعتمدين واحجز استشارتك في دقائق." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Marketplace,
});

const DEFAULT_SPECIALTIES = ["الكل", "قانون الأسرة والاحوال الشخصية", "القانون الجنائي", "قانون الشركات والأعمال", "العقارات والأملاك", "قانون العمل والتوظيف"];
const DEFAULT_CITIES = ["الكل", "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية", "كفر الشيخ", "الغربية", "المنوفية", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان"];
const DB_PAGE_SIZE = 24;

type Row = {
  id: string;
  bio: string | null;
  city: string | null;
  firm_name?: string | null;
  specializations: string[] | null;
  experience_years: number | null;
  consultation_price: number | null;
  consultation_price_online: number | null;
  rating: number | null;
  reviews_count: number | null;
  verified: boolean | null;
  available_online?: boolean | null;
  available_office?: boolean | null;
  profile?: { full_name: string; avatar_url: string | null; location: string | null } | null;
};

function LawyerCardSkeleton() {
  return (
    <div className="bg-surface/80 border border-border rounded-2xl p-4 animate-pulse flex gap-4">
      <div className="h-20 w-20 shrink-0 rounded-2xl bg-elevated" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-elevated rounded w-2/3" />
        <div className="h-3 bg-elevated rounded w-1/2" />
        <div className="h-3 bg-elevated rounded w-full" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-5 w-14 bg-elevated rounded-md" />
          <div className="h-5 w-12 bg-elevated rounded-md" />
        </div>
      </div>
    </div>
  );
}

function Marketplace() {
  const navigate = useNavigate();
  const { isAuthed } = useAuth();
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState("الكل");
  const [city, setCity] = useState("الكل");
  const [specialtiesList, setSpecialtiesList] = useState<string[]>(DEFAULT_SPECIALTIES);
  const [citiesList, setCitiesList] = useState<string[]>(DEFAULT_CITIES);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxPrice, setMaxPrice] = useState(5000);
  const [minRating, setMinRating] = useState(0);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "price_asc" | "price_desc">("rating");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dbPage, setDbPage] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [catRes, cityRes] = await Promise.all([
          supabase.from("categories").select("*"),
          supabase.from("cities").select("*"),
        ]);
        const loadedCats = catRes?.data ?? [];
        if (Array.isArray(loadedCats) && loadedCats.length > 0) {
          const names: string[] = ["الكل"];
          loadedCats.forEach((cat: any) => {
            if (cat.name_ar && !names.includes(cat.name_ar)) names.push(cat.name_ar);
            if (Array.isArray(cat.children)) {
              cat.children.forEach((sub: any) => {
                if (sub.name_ar && !names.includes(sub.name_ar)) names.push(sub.name_ar);
              });
            }
          });
          setSpecialtiesList(names);
        }
        const loadedCities = cityRes?.data ?? [];
        if (Array.isArray(loadedCities) && loadedCities.length > 0) {
          const cNames: string[] = ["الكل"];
          loadedCities.forEach((c: any) => {
            const name = c.name_ar || c.name;
            if (name && !cNames.includes(name)) cNames.push(name);
          });
          setCitiesList(cNames);
        }
      } catch {/* ignore */}
    })();
  }, []);

  // Arabic-insensitive LIKE pattern: alef/hamza, taa marbuta, and alef maqsura
  // variants are matched with a single-char wildcard so "أسوان" also finds "اسوان".
  const arabicLoosePattern = (s: string) =>
    `%${s.replace(/[أإآا]/g, "_").replace(/[ةه]/g, "_").replace(/[ىي]/g, "_")}%`;

  const filterKey = `${spec}|${city}|${verifiedOnly}|${onlineOnly}|${maxPrice}|${minRating}|${sortBy}`;

  // Reset paging whenever any filter changes.
  useEffect(() => {
    setDbPage(0);
  }, [filterKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from("lawyers")
        .select("*, profile:profiles!id(full_name, avatar_url, location)", { count: "exact" })
        .range(dbPage * DB_PAGE_SIZE, (dbPage + 1) * DB_PAGE_SIZE - 1);

      if (sortBy === "rating") query = query.order("rating", { ascending: false, nullsFirst: false });
      if (sortBy === "price_asc") query = query.order("consultation_price", { ascending: true, nullsFirst: false });
      if (sortBy === "price_desc") query = query.order("consultation_price", { ascending: false, nullsFirst: false });

      if (verifiedOnly) query = query.eq("verified", true);
      if (onlineOnly) query = query.eq("available_online", true);
      if (spec !== "الكل") query = query.contains("specializations", [spec]);
      if (city !== "الكل") query = query.ilike("city", arabicLoosePattern(city));
      if (maxPrice < 5000) query = query.lte("consultation_price", maxPrice);
      if (minRating > 0) query = query.gte("rating", minRating);

      const { data, count } = await query;
      if (cancelled) return;
      const mapped = (data ?? []).map((l: any) => ({ ...l, profile: l.profile ?? null }));
      setRows((prev) => (dbPage === 0 ? mapped : [...prev, ...mapped]));
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dbPage, filterKey]);

  // Client-side text search on already-loaded page (Arabic-insensitive)
  const norm = (s: string) =>
    s.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim().toLowerCase();
  const nq = norm(q);
  const filtered = nq
    ? rows.filter((l) => {
        const name = norm(l.profile?.full_name ?? "");
        const firm = norm(l.firm_name ?? "");
        const c = norm(l.city ?? l.profile?.location ?? "");
        const specs = (l.specializations ?? []).map(norm);
        return name.includes(nq) || firm.includes(nq) || c.includes(nq) || specs.some((s) => s.includes(nq));
      })
    : rows;

  const hasMore = total > rows.length;

  const activeFilters =
    (spec !== "الكل" ? 1 : 0) + (city !== "الكل" ? 1 : 0) + (onlineOnly ? 1 : 0) +
    (verifiedOnly ? 1 : 0) + (maxPrice < 5000 ? 1 : 0) + (minRating > 0 ? 1 : 0);

  function resetAll() {
    setQ(""); setSpec("الكل"); setCity("الكل"); setMaxPrice(5000);
    setMinRating(0); setOnlineOnly(false); setVerifiedOnly(false); setSortBy("rating");
  }

  function handleBookCTA(lawyerId: string) {
    saveAuthIntent(`/lawyers/${lawyerId}`, { type: "book_consultation", lawyerId });
    navigate({
      to: "/auth",
      search: { returnUrl: `/lawyers/${lawyerId}`, invite: undefined, type: undefined },
    });
  }

  return (
    <div className="min-h-screen pb-10">
      <SiteHeader />

      {/* Sticky search + quick filters — Uber-style top bar */}
      <div className="sticky top-[65px] z-20 bg-background/95 backdrop-blur-md border-b border-gold-soft/25">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gold" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                inputMode="search"
                placeholder="ابحث باسم المكتب، التخصص، أو المدينة"
                className="w-full h-12 bg-surface border border-gold-soft/40 focus:border-gold rounded-2xl pr-11 pl-9 text-[15px] text-foreground placeholder:text-foreground/40 outline-none transition"
              />
              {q && (
                <button
                  aria-label="مسح البحث"
                  onClick={() => setQ("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="الفلاتر"
              className="relative h-12 w-12 shrink-0 rounded-2xl border border-gold-soft/40 bg-surface text-gold flex items-center justify-center active:scale-95 transition"
            >
              <SlidersHorizontal className="h-5 w-5" />
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -left-1.5 h-5 min-w-5 px-1 rounded-full bg-gold-gradient text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Horizontal specialty rail */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 mt-2.5 pb-1">
            {specialtiesList.map((s) => (
              <button
                key={s}
                onClick={() => setSpec(s)}
                className={`shrink-0 px-4 h-9 rounded-full text-sm border transition whitespace-nowrap ${
                  spec === s
                    ? "bg-gold-gradient text-primary-foreground border-transparent font-semibold"
                    : "bg-surface/70 border-gold-soft/40 text-foreground/70 active:scale-95"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        {/* Result summary + sort */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm text-foreground/60">
            {loading && rows.length === 0 ? "جاري البحث..." : `${filtered.length} من ${total} مكتب/محامٍ`}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            aria-label="ترتيب النتائج"
            className="bg-surface border border-gold-soft/40 rounded-xl px-3 h-9 text-sm text-foreground/80"
          >
            <option value="rating">الأعلى تقييماً</option>
            <option value="price_asc">الأقل سعراً</option>
            <option value="price_desc">الأعلى سعراً</option>
          </select>
        </div>

        {activeFilters > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-4">
            {spec !== "الكل" && <ActiveChip label={spec} onClear={() => setSpec("الكل")} />}
            {city !== "الكل" && <ActiveChip label={city} onClear={() => setCity("الكل")} />}
            {onlineOnly && <ActiveChip label="أونلاين" onClear={() => setOnlineOnly(false)} />}
            {verifiedOnly && <ActiveChip label="موثّق" onClear={() => setVerifiedOnly(false)} />}
            {maxPrice < 5000 && <ActiveChip label={`حتى ${maxPrice.toLocaleString()} ج`} onClear={() => setMaxPrice(5000)} />}
            {minRating > 0 && <ActiveChip label={`${minRating}+ ⭐`} onClear={() => setMinRating(0)} />}
            <button onClick={resetAll} className="shrink-0 text-xs text-foreground/50 underline underline-offset-4">
              مسح الكل
            </button>
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => <LawyerCardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {filtered.map((l) => {
                const name = l.profile?.full_name ?? "محامٍ";
                const cityLabel = l.city ?? l.profile?.location ?? "—";
                const online = Number(l.consultation_price_online ?? 0);
                const office = Number(l.consultation_price ?? 0);
                const from = [online, office].filter((n) => n > 0).sort((a, b) => a - b)[0] ?? 0;
                return (
                  <article
                    key={l.id}
                    className="group bg-surface/80 border border-border hover:border-gold/50 rounded-2xl overflow-hidden transition-all hover:shadow-gold"
                  >
                    <Link to="/lawyers/$id" params={{ id: l.id }} className="block p-4 active:bg-elevated/40 transition">
                      <div className="flex gap-3.5">
                        {l.profile?.avatar_url ? (
                          <img
                            src={l.profile.avatar_url}
                            alt={name}
                            loading="lazy"
                            width={160}
                            height={160}
                            className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl object-cover border border-gold/25"
                          />
                        ) : (
                          <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl bg-gold-gradient flex items-center justify-center font-display text-3xl text-primary-foreground font-bold">
                            {name[0] ?? "أ"}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-display text-base sm:text-lg text-foreground leading-snug line-clamp-2 group-hover:text-gold transition">
                              {name}
                            </h2>
                            <span className="shrink-0 inline-flex items-center gap-1 text-sm text-gold font-semibold">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {Number(l.rating ?? 0).toFixed(1)}
                              <span className="text-foreground/40 font-normal text-xs">({l.reviews_count ?? 0})</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-foreground/60">
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{cityLabel}</span>
                            <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{l.experience_years ?? 0} سنة خبرة</span>
                            {l.verified && (
                              <span className="inline-flex items-center gap-1 text-gold"><BadgeCheck className="h-3.5 w-3.5" />موثّق</span>
                            )}
                          </div>

                          <p className="text-xs text-foreground/55 mt-1.5 line-clamp-2 leading-relaxed">
                            {l.bio ?? "محامٍ معتمد"}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(l.specializations ?? []).slice(0, 3).map((s) => (
                              <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-gold/10 border border-gold/20 text-gold/90">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-3.5 pt-3 border-t border-border">
                        <div className="flex items-center gap-2 text-[11px] text-foreground/55">
                          {l.available_online !== false && (
                            <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5 text-gold/70" />أونلاين</span>
                          )}
                          {l.available_office !== false && (
                            <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-gold/70" />في المكتب</span>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] text-foreground/45 leading-none mb-0.5">تبدأ من</div>
                          <div className="text-gold font-bold text-sm">{from.toLocaleString()} ج</div>
                        </div>
                      </div>
                    </Link>

                    <div className="px-4 pb-4">
                      {isAuthed ? (
                        <Link
                          to="/lawyers/$id"
                          params={{ id: l.id }}
                          className="w-full bg-gold-gradient text-primary-foreground font-semibold text-sm h-11 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                        >
                          احجز استشارة <ChevronLeft className="h-4 w-4" />
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleBookCTA(l.id)}
                          className="w-full border border-gold/40 text-gold font-semibold text-sm h-11 rounded-xl hover:bg-gold/10 active:scale-[0.98] transition"
                        >
                          سجّل للحجز
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className="text-center mt-6">
                <button
                  onClick={() => setDbPage((p) => p + 1)}
                  disabled={loading}
                  className="border border-gold/40 text-gold px-8 h-12 rounded-2xl hover:bg-gold/10 transition disabled:opacity-50"
                >
                  {loading ? "جاري التحميل..." : `عرض المزيد (${total - rows.length})`}
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="font-display text-xl text-foreground mb-2">لا توجد نتائج مطابقة</h3>
                <p className="text-foreground/60 text-sm mb-6 max-w-sm">جرّب تغيير التخصص أو المدينة أو رفع الحد الأعلى للسعر</p>
                <button
                  onClick={resetAll}
                  className="bg-gold-gradient text-primary-foreground font-semibold px-6 h-11 rounded-xl shadow-gold active:scale-[0.98] transition"
                >
                  إعادة تعيين الفلاتر
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Filters bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-surface border-t sm:border border-gold-soft/40 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-border mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl text-gradient-gold">الفلاتر</h2>
              <button onClick={() => setSheetOpen(false)} aria-label="إغلاق" className="text-foreground/50 hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <SheetSection title="المدينة">
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                {citiesList.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCity(c)}
                    className={`px-3.5 h-9 rounded-full text-sm border transition ${
                      city === c ? "bg-gold/15 border-gold text-gold font-semibold" : "bg-background border-border text-foreground/70"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </SheetSection>

            <SheetSection title="نوع الاستشارة والتوثيق">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setOnlineOnly(!onlineOnly)}
                  className={`px-3.5 h-9 rounded-full text-sm border transition inline-flex items-center gap-1.5 ${
                    onlineOnly ? "bg-gold/15 border-gold text-gold font-semibold" : "bg-background border-border text-foreground/70"
                  }`}
                >
                  <Video className="h-4 w-4" /> متاح أونلاين
                </button>
                <button
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={`px-3.5 h-9 rounded-full text-sm border transition inline-flex items-center gap-1.5 ${
                    verifiedOnly ? "bg-gold/15 border-gold text-gold font-semibold" : "bg-background border-border text-foreground/70"
                  }`}
                >
                  <BadgeCheck className="h-4 w-4" /> موثّق فقط
                </button>
              </div>
            </SheetSection>

            <SheetSection title={`أقصى سعر للاستشارة: ${maxPrice.toLocaleString()} ج`}>
              <input
                type="range" min="100" max="5000" step="100" value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-gold h-8"
                aria-label="أقصى سعر"
              />
            </SheetSection>

            <SheetSection title="أقل تقييم">
              <div className="flex gap-2">
                {[0, 3, 4, 5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setMinRating(r)}
                    className={`flex-1 h-10 rounded-xl text-sm border transition ${
                      minRating === r ? "bg-gold/15 border-gold text-gold font-semibold" : "bg-background border-border text-foreground/70"
                    }`}
                  >
                    {r === 0 ? "الكل" : `${r}+ ⭐`}
                  </button>
                ))}
              </div>
            </SheetSection>

            <div className="flex gap-2 pt-2 sticky bottom-0 bg-surface pb-1">
              <button
                onClick={resetAll}
                className="px-5 h-12 rounded-2xl border border-border text-foreground/70 text-sm"
              >
                إعادة تعيين
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 h-12 rounded-2xl bg-gold-gradient text-primary-foreground font-semibold shadow-gold active:scale-[0.98] transition"
              >
                عرض النتائج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs">
      {label}
      <button onClick={onClear} aria-label={`إزالة ${label}`} className="opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="text-sm font-semibold text-foreground/80 mb-2.5">{title}</h3>
      {children}
    </section>
  );
}
