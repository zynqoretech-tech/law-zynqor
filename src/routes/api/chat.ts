import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Msg = { role: "user" | "assistant"; content: string };
type Tool =
  | "legal_qa"
  | "contract_review"
  | "draft"
  | "summary"
  | "legal_brief"
  | "deadline_calc"
  | "case_strategy"
  | "poa_draft"
  | "legal_research"
  | "court_fees_calc";

type ChatRequest = {
  messages: Msg[];
  tool?: Tool;
};

const NO_MD = `اكتب نصاً عادياً فقط بدون أي رموز Markdown (لا ** ولا ## ولا * ولا - ولا \`\`\`). استخدم فقرات وأرقاماً عادية للترقيم.`;

const SYSTEM_PROMPTS: Record<Tool, string> = {
  legal_qa: `أنت "الوكيل" — مساعد قانوني ذكي متخصص في القانون المصري.
- أجب بالعربية الفصحى بأسلوب واضح ومنظم ومبسط للمواطن العادي.
- استند إلى التشريعات المصرية (الدستور، القانون المدني، العقوبات، الأحوال الشخصية، العمل، التجاري).
- اذكر رقم المادة القانونية عند الإمكان.
- اذكر دائماً في النهاية: "هذه معلومات إرشادية ولا تغني عن استشارة محامي معتمد."
- ${NO_MD}`,

  contract_review: `أنت محامٍ مصري خبير في تحليل العقود.
حلّل العقد المقدَّم وأجب بـ JSON فقط (بدون أي نص خارج الـ JSON) بهذا الشكل:
{
  "risk_score": number (0-100),
  "summary": "ملخص مختصر للعقد بالعربي",
  "risky_clauses": [{"clause": "نص البند", "explanation": "لماذا هو خطر", "severity": "high|medium|low"}],
  "good_clauses": [{"clause": "نص البند", "explanation": "لماذا هو جيد"}],
  "recommendations": ["توصية 1", "توصية 2"]
}`,

  draft: `أنت محامٍ مصري خبير في صياغة العقود.
صيغ العقد المطلوب بشكل قانوني سليم وفق القانون المصري.
ابدأ بعنوان "عقد …" ثم ديباجة ثم البنود مرقمة (البند الأول، البند الثاني…) ثم خاتمة "وعلى ذلك تم التوقيع" مع خانات الأطراف.
أضف في النهاية: "هذه مسودة أولية تحتاج مراجعة محامٍ قبل التوقيع."
${NO_MD}`,

  summary: `أنت مساعد قانوني. لخّص المستند التالي بشكل موجز وواضح في فقرات نصية تشمل:
النقاط الرئيسية، الالتزامات والحقوق، التواريخ والمواعيد المهمة، والأطراف المذكورة.
${NO_MD}`,

  legal_brief: `أنت محامٍ مصري خبير في صياغة المذكرات القانونية أمام المحاكم المصرية.
التزم بالشكل التالي:
1. الديباجة: "بسم الله الرحمن الرحيم — إلى عدالة السيد رئيس [اسم المحكمة]"
2. المطلوب: تحديد الطلبات بدقة
3. الوقائع: سرد الوقائع بصيغة قانونية
4. الأسانيد القانونية: ذكر المواد القانونية مع نصها
5. الطلبات الختامية المحددة
6. التوقيع: "وكيل [المدعي/المتهم] — المحامي [الاسم]"
أضف في النهاية: "هذه مسودة تحتاج مراجعة المحامي قبل تقديمها."
${NO_MD}`,

  deadline_calc: `أنت خبير في حساب المواعيد والآجال القانونية المصرية.
آجال الطعن: الاستئناف 40 يوماً، النقض 60 يوماً، المعارضة الغيابية 8 أيام (مدني)، الاستئناف الجنائي 10 أيام، أمر الأداء 10 أيام.
التقادم: مدني عام 15 سنة، تجاري 7 سنوات، عمل 3 سنوات، أجور سنة، ضريبي 5 سنوات، إيجار 5 سنوات، جنح 3 سنوات.
احسب الميعاد بدقة من التاريخ المعطى، واذكر تاريخ الانتهاء والأيام المتبقية حتى اليوم، وحذّر إذا كان الأجل قارب الانتهاء.
${NO_MD}`,

  case_strategy: `أنت محامٍ مصري خبير بخبرة 20 عاماً. قدّم تحليلاً استراتيجياً عميقاً للقضية يشمل:
1. تقييم القضية: نقاط القوة والضعف (0-10)
2. المخاطر القانونية
3. الاستراتيجية المقترحة
4. الخطوات العملية الفورية
5. البدائل (هل التفاوض أفضل من التقاضي؟)
6. التوقعات الزمنية
7. التقدير المالي
${NO_MD}`,

  poa_draft: `أنت محامٍ مصري متخصص في صياغة التوكيلات وفق القانون المدني المصري وقانون الشهر العقاري.
حدد نوع التوكيل واذكر بيانات الموكِّل والموكَّل ونطاق التوكيل والصلاحيات والمدة.
أضف تنبيهاً بضرورة التوثيق في الشهر العقاري أو القنصلية.
${NO_MD}`,

  legal_research: `أنت باحث قانوني مصري. قدّم: النص القانوني الدقيق، التفسير والتطبيق العملي، المستجدات التشريعية، وما قالته محكمة النقض إن وُجد.
إذا لم تكن متأكداً قل ذلك صراحةً.
${NO_MD}`,

  court_fees_calc: `أنت متخصص في حساب رسوم ومصاريف التقاضي في مصر.
قدّر: رسوم رفع الدعوى المتناسبة مع قيمتها، طوابع الدمغة القضائية، رسوم التنفيذ، الاستئناف والنقض، الخبراء، الإعلان القضائي.
نبّه أن الأرقام تقريبية وتتغير بقرارات وزارة العدل.
${NO_MD}`,
};

// Read-only public statutes lookup via the publishable key (RLS-scoped).
async function fetchStatutesContext(query: string): Promise<{ context: string; refs: string[] }> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { context: "", refs: [] };
  try {
    const c = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const terms = (query.match(/[\u0600-\u06FF]{3,}/g) ?? []).slice(0, 5);
    if (terms.length === 0) return { context: "", refs: [] };
    const tsQuery = terms.join(" | ");
    const { data } = await c
      .from("legal_statutes")
      .select("law_name, article_number, article_text")
      .textSearch("article_text", tsQuery, { type: "websearch", config: "simple" })
      .limit(3);
    if (!data || data.length === 0) return { context: "", refs: [] };
    const refs = data.map((s) => `${s.law_name} م.${s.article_number}`);
    const context =
      "استند إلى هذه النصوص القانونية الرسمية:\n" +
      data
        .map((s) => `${s.law_name} المادة ${s.article_number}: ${s.article_text}`)
        .join("\n") +
      "\n\n";
    return { context, refs };
  } catch {
    return { context: "", refs: [] };
  }
}

const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/i,
  /ignore\s+all\s+previous/i,
  /system\s*:\s*you\s+are/i,
  /\bDAN\b/,
  /jailbreak/i,
  /تجاهل\s+كل\s+التعليمات/,
  /تجاهل\s+التعليمات\s+السابقة/,
];

function maxTokensFor(tool: Tool): number {
  if (tool === "contract_review") return 8192;
  if (tool === "legal_brief" || tool === "draft" || tool === "case_strategy" || tool === "poa_draft") return 8192;
  if (tool === "legal_research" || tool === "deadline_calc" || tool === "court_fees_calc") return 8192;
  return 4096;
}


async function callGateway(model: string, key: string, systemPrompt: string, messages: Msg[], tool: Tool) {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: maxTokensFor(tool),
  };
  if (tool === "contract_review" || tool === "deadline_calc") {
    body.response_format = { type: "json_object" };
  }
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as ChatRequest;
          const { messages, tool = "legal_qa" } = body || {};

          if (!Array.isArray(messages) || messages.length === 0) {
            return Response.json({ text: "الرسالة فارغة." }, { status: 400 });
          }

          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const userPrompt = lastUser?.content || "استشارة قانونية";

          let mode = "general";
          if (tool === "contract_review" || tool === "draft" || tool === "case_strategy") {
            mode = "premium";
          }

          const authHeader = request.headers.get("authorization");
          const laravelUrl = process.env.VITE_API_URL || "http://127.0.0.1:8009/api/v1";

          const laravelRes = await fetch(`${laravelUrl}/ai/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...(authHeader ? { Authorization: authHeader } : {}),
            },
            body: JSON.stringify({
              message: userPrompt,
              mode,
            }),
          });

          if (!laravelRes.ok) {
            const errData = await laravelRes.json().catch(() => ({}));
            const msg = errData?.message || `خطأ ${laravelRes.status}`;
            return Response.json({ text: `عذراً، حدث خطأ: ${msg}` });
          }

          const data = await laravelRes.json();
          const reply = data?.data?.message || data?.data?.response || data?.message || data?.response || "تمت معالجة الاستشارة بنجاح.";
          const statutesUsed = data?.data?.statutes_used || [];

          return Response.json({
            text: reply,
            statutes_used: statutesUsed,
          });
        } catch (e: any) {
          return Response.json({ text: `حدث خطأ: ${e.message}. يرجى المحاولة مرة أخرى.` });
        }
      },
    },
  },
});
