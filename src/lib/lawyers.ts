export type Lawyer = {
  id: string;
  name: string;
  title: string;
  city: string;
  specialties: string[];
  years: number;
  rating: number;
  reviews: number;
  hourly: number;
  bio: string;
  languages: string[];
};

export const LAWYERS: Lawyer[] = [
  {
    id: "ahmed-shawky",
    name: "أ. أحمد شوقي",
    title: "محامٍ بالنقض",
    city: "القاهرة",
    specialties: ["قضايا تجارية", "تحكيم دولي"],
    years: 18,
    rating: 4.9,
    reviews: 142,
    hourly: 1500,
    bio: "محامٍ بالنقض ومستشار قانوني لكبرى الشركات في مصر والخليج، خبرة 18 عاماً في التحكيم التجاري الدولي.",
    languages: ["العربية", "الإنجليزية", "الفرنسية"],
  },
  {
    id: "mona-elsharkawy",
    name: "أ. منى الشرقاوي",
    title: "محامية أحوال شخصية",
    city: "الإسكندرية",
    specialties: ["أحوال شخصية", "ميراث"],
    years: 12,
    rating: 4.8,
    reviews: 98,
    hourly: 800,
    bio: "متخصصة في قضايا الأسرة والميراث، مع التركيز على حماية حقوق المرأة والأطفال.",
    languages: ["العربية", "الإنجليزية"],
  },
  {
    id: "khaled-mansour",
    name: "أ. خالد منصور",
    title: "محامٍ جنائي",
    city: "الجيزة",
    specialties: ["قضايا جنائية", "جرائم اقتصادية"],
    years: 22,
    rating: 5.0,
    reviews: 210,
    hourly: 2000,
    bio: "محامٍ جنائي بخبرة 22 عاماً، متخصص في الجرائم الاقتصادية وقضايا غسيل الأموال.",
    languages: ["العربية", "الإنجليزية"],
  },
  {
    id: "sara-ibrahim",
    name: "أ. سارة إبراهيم",
    title: "محامية عمالية",
    city: "القاهرة",
    specialties: ["قانون العمل", "تأمينات اجتماعية"],
    years: 9,
    rating: 4.7,
    reviews: 76,
    hourly: 600,
    bio: "متخصصة في نزاعات العمل والفصل التعسفي، مع سجل قوي في استرداد حقوق العمال.",
    languages: ["العربية"],
  },
  {
    id: "mostafa-elgendy",
    name: "أ. مصطفى الجندي",
    title: "محامٍ عقاري",
    city: "المنصورة",
    specialties: ["قضايا عقارية", "إيجارات"],
    years: 15,
    rating: 4.8,
    reviews: 120,
    hourly: 700,
    bio: "خبير في النزاعات العقارية وتسجيل الأراضي والإخلاء وقضايا الإيجار القديم والجديد.",
    languages: ["العربية"],
  },
  {
    id: "nour-hassan",
    name: "أ. نور حسن",
    title: "مستشارة قانونية للشركات",
    city: "القاهرة",
    specialties: ["شركات", "ملكية فكرية"],
    years: 11,
    rating: 4.9,
    reviews: 88,
    hourly: 1200,
    bio: "مستشارة قانونية للشركات الناشئة والتقنية، متخصصة في حماية الملكية الفكرية والعلامات التجارية.",
    languages: ["العربية", "الإنجليزية"],
  },
];
