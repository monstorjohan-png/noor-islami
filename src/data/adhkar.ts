import type { AdhkarGroup, NameOfGod } from '../lib/types';

/**
 * الأذكار
 * ------------------------------------------------------------------
 * قاعدة صارمة: كل نص هنا إمّا آية من المصحف أو حديث برقمه في كتابه.
 * التطبيق لا يعرض ما بُلد أدناه — بل يعرض النص الأصلي من المصدر
 * بعد التحقق من الرقم، ويذكر المرجع ليُراجَع المستخدم.
 *
 * `must`: كلمات لازم وجودها في نص المصدر — يفحصها خط الأنابيب آلياً.
 *          لو أخطأنا في الرقم، فشل الفحص وظهر التنبيه.
 */
export const ADHKAR: AdhkarGroup[] = [
  /* ---------------- أذكار الصباح ---------------- */
  {
    id: 'morning',
    title: { ar: 'أذكار الصباح', en: 'Morning Adhkar' },
    when: { ar: 'من الفجر إلى طلوع الشمس، ويُسنّ الأداء بعد صلاة الفجر', en: 'From dawn until sunrise; sunnah after Fajr' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'm-ayat-kursi',
        ar: 'آية الكرسي — من قالها حين يصبح أُجير من الجن حتى يمسي',
        ref: 'البقرة 255',
        quran: [2, 255],
        must: ['الله لا اله الا هو الحي القيوم'],
        count: 1,
      },
      {
        id: 'm-ikhlas',
        ar: 'سورة الإخلاص — تُقرأ ثلاثاً مع المعوذتين',
        ref: 'الإخلاص 112',
        quran: [112, 1],
        must: ['قل هو الله احد'],
        count: 3,
      },
      {
        id: 'm-falaq',
        ar: 'سورة الفلق — تُقرأ ثلاثاً مع المعوذتين',
        ref: 'الفلق 113',
        quran: [113, 1],
        must: ['قل اعوذ برب الفلق'],
        count: 3,
      },
      {
        id: 'm-nas',
        ar: 'سورة الناس — تُقرأ ثلاثاً مع المعوذتين',
        ref: 'الناس 114',
        quran: [114, 1],
        must: ['قل اعوذ برب الناس'],
        count: 3,
      },
      {
        id: 'm-sayyid-istighfar',
        ar: 'سيد الاستغفار',
        ref: 'البخاري 6306',
        hadith: ['bukhari', 6306],
        must: ['اللهم انت ربي لا اله الا انت'],
        count: 1,
      },
      {
        id: 'm-bismillah',
        ar: 'من قال: بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء — ثلاثاً',
        ref: 'أبو داود 5088',
        hadith: ['abudawud', 5088],
        must: ['بسم الله الذي لا يضر مع اسمه شيء'],
        count: 3,
      },
      {
        id: 'm-raditu-billah',
        ar: 'من قال: رضيت بالله رباً — ثلاثاً',
        ref: 'أبو داود 525',
        hadith: ['abudawud', 525],
        must: ['رضيت بالله ربا'],
        count: 3,
      },
      {
        id: 'm-hayy-al-qayyum',
        ar: 'حديث رؤيا الأذان — وفيه: حي على الفلاح',
        ref: 'أبو داود 499',
        hadith: ['abudawud', 499],
        must: ['حي على الفلاح'],
        count: 1,
      },
      {
        id: 'm-asbahna',
        ar: 'من قال: أصبحنا وأصبح الملك لله',
        ref: 'مسلم 6908',
        hadith: ['muslim', 6908],
        must: ['اصبحنا واصبح الملك لله'],
        count: 1,
      },
      {
        id: 'm-hudur-at-tawbah',
        ar: 'من قال: اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور',
        ref: 'الترمذي 3391',
        hadith: ['tirmidhi', 3391],
        must: ['اللهم بك اصبحنا'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار المساء ---------------- */
  {
    id: 'evening',
    title: { ar: 'أذكار المساء', en: 'Evening Adhkar' },
    when: { ar: 'من بعد صلاة العصر إلى غروب الشمس، ويُسنّ الأداء بعد صلاة المغرب', en: 'From Asr until sunset; sunnah after Maghrib' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'e-ayat-kursi',
        ar: 'آية الكرسي — من قالها حين يمسي أُجير من الجن حتى يصبح',
        ref: 'البقرة 255',
        quran: [2, 255],
        must: ['الله لا اله الا هو الحي القيوم'],
        count: 1,
      },
      {
        id: 'e-ikhlas',
        ar: 'سورة الإخلاص — تُقرأ ثلاثاً',
        ref: 'الإخلاص 112',
        quran: [112, 1],
        must: ['قل هو الله احد'],
        count: 3,
      },
      {
        id: 'e-sayyid-istighfar',
        ar: 'سيد الاستغفار',
        ref: 'البخاري 6306',
        hadith: ['bukhari', 6306],
        must: ['اللهم انت ربي لا اله الا انت'],
        count: 1,
      },
      {
        id: 'e-amsayna',
        ar: 'من قال: أمسينا وأمسى الملك لله',
        ref: 'مسلم 6907',
        hadith: ['muslim', 6907],
        must: ['امسينا وامسى الملك لله'],
        count: 1,
      },
      {
        id: 'e-hudur-at-tawbah',
        ar: 'من قال: اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير',
        ref: 'الترمذي 3391',
        hadith: ['tirmidhi', 3391],
        must: ['اللهم بك امسينا'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار بعد الصلاة ---------------- */
  {
    id: 'after-prayer',
    title: { ar: 'أذكار بعد الصلاة', en: 'After Prayer' },
    when: { ar: 'بعد السلام من كل صلاة مفروضة', en: 'After every obligatory prayer' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'a-astaghfirullah',
        ar: 'من قال بعد السلام: أستغفر الله ثلاثاً ثم اللهم أنت السلام',
        ref: 'مسلم 1334',
        hadith: ['muslim', 1334],
        must: ['استغفر الله'],
        count: 1,
      },
      {
        id: 'a-ayat-kursi',
        ar: 'آية الكرسي — يُسنّ قراءتها دبر كل صلاة مفروضة',
        ref: 'البقرة 255',
        quran: [2, 255],
        must: ['الله لا اله الا هو الحي القيوم'],
        count: 1,
      },
      {
        id: 'a-tasbih',
        ar: 'التسبيح والتحمد والتكبير — ثلاثاً وثلاثين',
        ref: 'البخاري 6329',
        hadith: ['bukhari', 6329],
        must: ['في دبر كل صلاة', 'عشرا', 'وتكبرون عشرا'],
        count: 33,
      },
    ],
  },

  /* ---------------- أذكار النوم ---------------- */
  {
    id: 'sleep',
    title: { ar: 'أذكار النوم', en: 'Before Sleep' },
    when: { ar: 'عند إرادة النوم', en: 'Before sleeping' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 's-ayat-kursi',
        ar: 'آية الكرسي عند النوم — لا يزال عليك من الله حافظ',
        ref: 'البقرة 255',
        quran: [2, 255],
        must: ['الله لا اله الا هو الحي القيوم'],
        count: 1,
      },
      {
        id: 's-amsahu',
        ar: 'من قال: اللهم أسلمت نفسي إليك',
        ref: 'البخاري 6313',
        hadith: ['bukhari', 6313],
        must: ['اللهم اسلمت نفسي اليك'],
        count: 1,
      },
      {
        id: 's-bismika',
        ar: 'من قال: باسمك اللهم أموت وأحيا',
        ref: 'البخاري 6324',
        hadith: ['bukhari', 6324],
        must: ['باسمك اللهم اموت واحيا'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار الاستيقاظ ---------------- */
  {
    id: 'waking',
    title: { ar: 'أذكار الاستيقاظ', en: 'On Waking' },
    when: { ar: 'عند الاستيقاظ من النوم', en: 'When waking up' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'w-alhamdu',
        ar: 'من قال: الحمد لله الذي أحيانا بعد ما أماتنا وإليه النشور',
        ref: 'البخاري 6312',
        hadith: ['bukhari', 6312],
        must: ['الحمد لله الذي احيانا بعد ما اماتنا'],
        count: 1,
      },
      {
        id: 'w-laylat-qadr',
        ar: 'دعاء الاستيقاظ من الليل — الدعاء المأثور',
        ref: 'البخاري 1154',
        hadith: ['bukhari', 1154],
        must: ['لا اله الا الله وحده لا شريك له'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار المسجد ---------------- */
  {
    id: 'mosque',
    title: { ar: 'أذكار المسجد', en: 'Mosque' },
    when: { ar: 'عند دخول المسجد والخروج منه', en: 'Entering and leaving the mosque' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'ms-enter',
        ar: 'عند الدخول: اللهم افتح لي أبواب رحمتك',
        ref: 'أبو داود 465',
        hadith: ['abudawud', 465],
        must: ['اللهم افتح لي ابواب رحمتك'],
        count: 1,
      },
      {
        id: 'ms-exit',
        ar: 'عند الخروج: اللهم إني أسألك من فضلك',
        ref: 'أبو داود 465',
        hadith: ['abudawud', 465],
        must: ['اللهم اني اسالك من فضلك'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار السفر ---------------- */
  {
    id: 'travel',
    title: { ar: 'أذكار السفر', en: 'Travel' },
    when: { ar: 'عند ركوب المركبة', en: 'When setting off on a journey' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 't-aslamah',
        ar: 'الركوب: سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ',
        ref: 'مسلم 3275',
        hadith: ['muslim', 3275],
        must: ['سبحان الذي سخر لنا هذا'],
        count: 1,
      },
    ],
  },

  /* ---------------- أذكار الهم والحزن ---------------- */
  {
    id: 'distress',
    title: { ar: 'أذكار الهم والحزن', en: 'Distress & Sorrow' },
    when: { ar: 'عند شدة الهم أو الضيق', en: 'When anxious or distressed' },
    source: 'أذكار الكتاب والسنة',
    items: [
      {
        id: 'd-hasbunallah',
        ar: 'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
        ref: 'التوبة 129',
        quran: [9, 129],
        must: ['حسبي الله لا اله الا هو عليه توكلت'],
        count: 7,
      },
    ],
  },
];

/**
 * أسماء الله الحسنى
 * ------------------------------------------------------------------
 * الأسماء التسعة والتسعون ثابتة متفق عليها.
 * المعاني مختصر من كتب اللغة والعلماء (الإمام الغزالي، ابن القيم).
 * `quran`: موضع ورود الاسم أو المشتق في القرآن.
 */
export const NAMES: NameOfGod[] = [
  {
    "n": 1,
    "ar": "الله",
    "trans": "Allah",
    "meaning": {
      "ar": "الاسم الجامع لكل معنى كمال، إليه تُنسب الأسماء الحسنى",
      "en": "The all-encompassing name of every perfection"
    },
    "quran": [
      112,
      1
    ]
  },
  {
    "n": 2,
    "ar": "الرحمن",
    "trans": "Ar-Rahman",
    "meaning": {
      "ar": "ذو الرحمة الواسعة التي وسعت كل شيء",
      "en": "Possessor of vast mercy, encompassing all"
    },
    "quran": [
      1,
      3
    ]
  },
  {
    "n": 3,
    "ar": "الرحيم",
    "trans": "Ar-Raheem",
    "meaning": {
      "ar": "الرحيم الدائم بعباده، وأخصّها بالمؤمنين",
      "en": "Ever-merciful, especially with the believers"
    },
    "quran": [
      1,
      3
    ]
  },
  {
    "n": 4,
    "ar": "الملك",
    "trans": "Al-Malik",
    "meaning": {
      "ar": "الذي له الملك كله، لا شريك له",
      "en": "Owner of all dominion, without partner"
    },
    "quran": [
      3,
      26
    ]
  },
  {
    "n": 5,
    "ar": "القدوس",
    "trans": "Al-Quddus",
    "meaning": {
      "ar": "المنزَّه عن كل نقص وعيب",
      "en": "Exalted above every imperfection"
    },
    "quran": [
      59,
      23
    ]
  },
  {
    "n": 6,
    "ar": "السلام",
    "trans": "As-Salam",
    "meaning": {
      "ar": "السالم من كل نقص، سلّم عباده من كل شر",
      "en": "Free from all imperfection; giver of peace"
    },
    "quran": [
      59,
      23
    ]
  },
  {
    "n": 7,
    "ar": "المؤمن",
    "trans": "Al-Mu’min",
    "meaning": {
      "ar": "المصدِّق لرسله، المؤمِّن عباده من الضرر",
      "en": "Verifier of His messengers; Giver of security"
    },
    "quran": [
      59,
      23
    ]
  },
  {
    "n": 8,
    "ar": "المهيمن",
    "trans": "Al-Muhaymin",
    "meaning": {
      "ar": "الرقيب على خلقه، شهيداً عليهم",
      "en": "Guardian and witness over His creation"
    },
    "quran": [
      59,
      23
    ]
  },
  {
    "n": 9,
    "ar": "العزيز",
    "trans": "Al-Aziz",
    "meaning": {
      "ar": "القوي الغالب الذي لا يُرام جنابه",
      "en": "The Almighty, whose might cannot be challenged"
    },
    "quran": [
      3,
      6
    ]
  },
  {
    "n": 10,
    "ar": "الجبار",
    "trans": "Al-Jabbar",
    "meaning": {
      "ar": "الذي جبر خلقه على ما أراد",
      "en": "He who compels His creation to what He wills"
    },
    "quran": [
      2,
      97
    ]
  },
  {
    "n": 11,
    "ar": "المتكبر",
    "trans": "Al-Mutakabbir",
    "meaning": {
      "ar": "المتعالي عن صفات الخلق، المتكبر عنهم",
      "en": "Exalted above His creation"
    },
    "quran": [
      16,
      29
    ]
  },
  {
    "n": 12,
    "ar": "الخالق",
    "trans": "Al-Khaliq",
    "meaning": {
      "ar": "الذي خلق كل شيء من العدم",
      "en": "Creator of all things from nothing"
    },
    "quran": [
      7,
      54
    ]
  },
  {
    "n": 13,
    "ar": "البارئ",
    "trans": "Al-Bari",
    "meaning": {
      "ar": "الذي يَبرأ الخلق من العدم",
      "en": "He who originates creation"
    },
    "quran": [
      59,
      24
    ]
  },
  {
    "n": 14,
    "ar": "المصور",
    "trans": "Al-Musawwir",
    "meaning": {
      "ar": "الذي صوّر جميع الخلق في أشكالها",
      "en": "He who shapes all creation into its forms"
    },
    "quran": [
      59,
      24
    ]
  },
  {
    "n": 15,
    "ar": "الغفار",
    "trans": "Al-Ghafur",
    "meaning": {
      "ar": "الساتر لذنوب عباده وتجاوزها",
      "en": "Forgiving and covering sins"
    },
    "quran": [
      20,
      82
    ]
  },
  {
    "n": 16,
    "ar": "القهار",
    "trans": "Al-Qahhar",
    "meaning": {
      "ar": "الذي قهر كل شيء وغلبه",
      "en": "Subduer of all things"
    },
    "quran": [
      12,
      39
    ]
  },
  {
    "n": 17,
    "ar": "الوهاب",
    "trans": "Al-Wahhab",
    "meaning": {
      "ar": "الذي يهب عطايا كثيرة لمن يشاء بلا عوض",
      "en": "Bestower of many gifts"
    },
    "quran": [
      3,
      8
    ]
  },
  {
    "n": 18,
    "ar": "الرزاق",
    "trans": "Ar-Razzaq",
    "meaning": {
      "ar": "المتكفل بأرزاق الخلق، من الرزق",
      "en": "Provider of sustenance for all creation"
    },
    "quran": [
      51,
      58
    ]
  },
  {
    "n": 19,
    "ar": "الفتاح",
    "trans": "Al-Fattah",
    "meaning": {
      "ar": "الذي يفتح لعباده أبواب الرحمة والرزق",
      "en": "Opener of gates of mercy and provision"
    },
    "quran": [
      34,
      26
    ]
  },
  {
    "n": 20,
    "ar": "العليم",
    "trans": "Al-Alim",
    "meaning": {
      "ar": "المحيط بعلمه بكل شيء",
      "en": "Knowing all things"
    },
    "quran": [
      2,
      32
    ]
  },
  {
    "n": 21,
    "ar": "القابض",
    "trans": "Al-Qabid",
    "meaning": {
      "ar": "الذي يقبض الرزق والأرواح بحكمته",
      "en": "Withholder by His wisdom"
    }
  },
  {
    "n": 22,
    "ar": "الباسط",
    "trans": "Al-Basit",
    "meaning": {
      "ar": "الذي يبسط الرزق لمن يشاء",
      "en": "Expander of provision"
    },
    "quran": [
      17,
      29
    ]
  },
  {
    "n": 23,
    "ar": "الخافض",
    "trans": "Al-Khafid",
    "meaning": {
      "ar": "الذي يخفض الجبارين منكأنا لطاعته",
      "en": "He who lowers the arrogant"
    }
  },
  {
    "n": 24,
    "ar": "الرافع",
    "trans": "Ar-Rafi",
    "meaning": {
      "ar": "الذي يرفع أوليائه تكريماً له",
      "en": "He who exalts His allies"
    },
    "quran": [
      7,
      176
    ]
  },
  {
    "n": 25,
    "ar": "المعز",
    "trans": "Al-Mu’izz",
    "meaning": {
      "ar": "الذي يذل من يشاء بغيره",
      "en": "He who gives might and honor"
    },
    "quran": [
      6,
      143
    ]
  },
  {
    "n": 26,
    "ar": "المذل",
    "trans": "Al-Mudhill",
    "meaning": {
      "ar": "الذي يذل من يشاء بعجزه",
      "en": "He who humiliates"
    }
  },
  {
    "n": 27,
    "ar": "السميع",
    "trans": "As-Sami",
    "meaning": {
      "ar": "الذي أحاط سمعه بكل الأصوات",
      "en": "All-hearing"
    },
    "quran": [
      2,
      127
    ]
  },
  {
    "n": 28,
    "ar": "البصير",
    "trans": "Al-Basir",
    "meaning": {
      "ar": "الذي يبصر كل شيء وإن دقّ وخفي",
      "en": "All-seeing"
    },
    "quran": [
      6,
      50
    ]
  },
  {
    "n": 29,
    "ar": "الحكم",
    "trans": "Al-Hakam",
    "meaning": {
      "ar": "الذي يحكم بين عباده بالحق",
      "en": "Judge between His servants with truth"
    },
    "quran": [
      12,
      40
    ]
  },
  {
    "n": 30,
    "ar": "العدل",
    "trans": "Al-Adl",
    "meaning": {
      "ar": "الذي لا يجور ولا يظلم",
      "en": "Utterly just, never unjust"
    },
    "quran": [
      16,
      90
    ]
  },
  {
    "n": 31,
    "ar": "اللطيف",
    "trans": "Al-Latif",
    "meaning": {
      "ar": "الذي يعلم دقائق الأمور ويوصل البر الخفي",
      "en": "Subtle; who brings about gentle unseen benefits"
    },
    "quran": [
      2,
      125
    ]
  },
  {
    "n": 32,
    "ar": "الخبير",
    "trans": "Al-Khabir",
    "meaning": {
      "ar": "العليم بما في الخفيات",
      "en": "All-aware of inner details"
    },
    "quran": [
      6,
      18
    ]
  },
  {
    "n": 33,
    "ar": "الحليم",
    "trans": "Al-Halim",
    "meaning": {
      "ar": "الذي لا يعاجل العقاب بل يمهل",
      "en": "Forbearing, not hasty in punishment"
    },
    "quran": [
      11,
      75
    ]
  },
  {
    "n": 34,
    "ar": "العظيم",
    "trans": "Al-Azim",
    "meaning": {
      "ar": "ذو الجلال والعظمة",
      "en": "Magnificent"
    },
    "quran": [
      2,
      105
    ]
  },
  {
    "n": 35,
    "ar": "الغفور",
    "trans": "Al-Ghafur",
    "meaning": {
      "ar": "كثير المغفرة",
      "en": "Much forgiving"
    },
    "quran": [
      6,
      165
    ]
  },
  {
    "n": 36,
    "ar": "الشكور",
    "trans": "Ash-Shakur",
    "meaning": {
      "ar": "كثير الشكر، يضاعف الحسنة",
      "en": "Most appreciative, multiplying reward"
    },
    "quran": [
      34,
      13
    ]
  },
  {
    "n": 37,
    "ar": "العلي",
    "trans": "Al-Ali",
    "meaning": {
      "ar": "العالي فوق خلقه",
      "en": "Most High"
    },
    "quran": [
      2,
      32
    ]
  },
  {
    "n": 38,
    "ar": "الكبير",
    "trans": "Al-Kabir",
    "meaning": {
      "ar": "الكبير المتعالي",
      "en": "Most Great"
    },
    "quran": [
      13,
      9
    ]
  },
  {
    "n": 39,
    "ar": "الحفيظ",
    "trans": "Al-Hafiz",
    "meaning": {
      "ar": "الحافظ لخلقه من الضياع",
      "en": "Preserver of His creation"
    }
  },
  {
    "n": 40,
    "ar": "المقيت",
    "trans": "Al-Muqit",
    "meaning": {
      "ar": "الذي يكفل عباده ويقويهم",
      "en": "Sustainer of all"
    }
  },
  {
    "n": 41,
    "ar": "الحسيب",
    "trans": "Al-Hasib",
    "meaning": {
      "ar": "الذي يحاسب عباده ويجزيهم",
      "en": "Judge and Reckoner"
    }
  },
  {
    "n": 42,
    "ar": "الجليل",
    "trans": "Al-Jalil",
    "meaning": {
      "ar": "الجليل فيا يستحق من هيبة",
      "en": "Majestic"
    }
  },
  {
    "n": 43,
    "ar": "الكريم",
    "trans": "Al-Karim",
    "meaning": {
      "ar": "الذي لا ينفد عطاؤه",
      "en": "Infinitely generous"
    },
    "quran": [
      82,
      6
    ]
  },
  {
    "n": 44,
    "ar": "الرقيب",
    "trans": "Ar-Raqib",
    "meaning": {
      "ar": "المراقب لأحوال عباده",
      "en": "Watchful over them"
    },
    "quran": [
      5,
      117
    ]
  },
  {
    "n": 45,
    "ar": "المجيب",
    "trans": "Al-Mujib",
    "meaning": {
      "ar": "الذي يجيب دعوات عباده",
      "en": "Responder to supplications"
    },
    "quran": [
      37,
      75
    ]
  },
  {
    "n": 46,
    "ar": "الواسع",
    "trans": "Al-Wasi",
    "meaning": {
      "ar": "واسع العلم والرحمة والعطاء",
      "en": "All-embracing in knowledge, mercy, bounty"
    }
  },
  {
    "n": 47,
    "ar": "الحكيم",
    "trans": "Al-Hakim",
    "meaning": {
      "ar": "الذي يضع الأشياء مواضعها",
      "en": "All-wise, placing things rightly"
    },
    "quran": [
      3,
      18
    ]
  },
  {
    "n": 48,
    "ar": "الودود",
    "trans": "Al-Wadud",
    "meaning": {
      "ar": "المحب لأوليائه",
      "en": "Loving"
    },
    "quran": [
      85,
      14
    ]
  },
  {
    "n": 49,
    "ar": "المجيد",
    "trans": "Al-Majid",
    "meaning": {
      "ar": "ذو الشرف والكرم",
      "en": "Noble"
    },
    "quran": [
      50,
      1
    ]
  },
  {
    "n": 50,
    "ar": "الباعث",
    "trans": "Al-Ba’ith",
    "meaning": {
      "ar": "الذي يبعث الخلق يوم القيامة",
      "en": "Raiser, resurrecting"
    },
    "quran": [
      22,
      5
    ]
  },
  {
    "n": 51,
    "ar": "الشهيد",
    "trans": "Ash-Shahid",
    "meaning": {
      "ar": "المطّلع على كل شيء",
      "en": "Witness over all things"
    },
    "quran": [
      100,
      7
    ]
  },
  {
    "n": 52,
    "ar": "الحق",
    "trans": "Al-Haqq",
    "meaning": {
      "ar": "حق في ذاته ووصفه لا يقبل الشرك",
      "en": "The Truth"
    },
    "quran": [
      20,
      114
    ]
  },
  {
    "n": 53,
    "ar": "الوكيل",
    "trans": "Al-Wakil",
    "meaning": {
      "ar": "الكفيل بأمور عباده",
      "en": "Trustee, Disposer of affairs"
    },
    "quran": [
      3,
      173
    ]
  },
  {
    "n": 54,
    "ar": "القوي",
    "trans": "Al-Qawiyy",
    "meaning": {
      "ar": "الذي لا تنفد قوته",
      "en": "All-Powerful"
    },
    "quran": [
      11,
      66
    ]
  },
  {
    "n": 55,
    "ar": "المتين",
    "trans": "Al-Matin",
    "meaning": {
      "ar": "ال شديد القوة",
      "en": "Firm, unfailing"
    },
    "quran": [
      51,
      58
    ]
  },
  {
    "n": 56,
    "ar": "الولي",
    "trans": "Al-Wali",
    "meaning": {
      "ar": "الناصر لأوليائه",
      "en": "Friend, Patron"
    },
    "quran": [
      3,
      13
    ]
  },
  {
    "n": 57,
    "ar": "الحميد",
    "trans": "Al-Hamid",
    "meaning": {
      "ar": "المحمود على كل حال",
      "en": "All-Praised"
    },
    "quran": [
      31,
      26
    ]
  },
  {
    "n": 58,
    "ar": "المحصي",
    "trans": "Al-Muhsi",
    "meaning": {
      "ar": "الذي أحصى كل شيء",
      "en": "All-Counting"
    }
  },
  {
    "n": 59,
    "ar": "المبدئ",
    "trans": "Al-Mubdi",
    "meaning": {
      "ar": "الذي بدأ الخلق",
      "en": "Originator"
    }
  },
  {
    "n": 60,
    "ar": "المعيد",
    "trans": "Al-Mu'id",
    "meaning": {
      "ar": "الذي يعيد الخلق بعد الموت",
      "en": "Restorer"
    }
  },
  {
    "n": 61,
    "ar": "المحيي",
    "trans": "Al-Muhyi",
    "meaning": {
      "ar": "الذي يحيي الموتى",
      "en": "Giver of life"
    }
  },
  {
    "n": 62,
    "ar": "المميت",
    "trans": "Al-Mumit",
    "meaning": {
      "ar": "الذي يميت الأحياء",
      "en": "Creator of death"
    }
  },
  {
    "n": 63,
    "ar": "الحي",
    "trans": "Al-Hayy",
    "meaning": {
      "ar": "الحي الذي لا يموت",
      "en": "Ever-Living"
    },
    "quran": [
      25,
      58
    ]
  },
  {
    "n": 64,
    "ar": "القيوم",
    "trans": "Al-Qayyum",
    "meaning": {
      "ar": "القائم بنفسه، لا يمسّه سنة ولا نوم",
      "en": "Self-Sustaining, subsisting by Himself"
    },
    "quran": [
      2,
      255
    ]
  },
  {
    "n": 65,
    "ar": "الواجد",
    "trans": "Al-Wajid",
    "meaning": {
      "ar": "الغني الذي لا يعوزه شيء",
      "en": "Self-Sufficient"
    },
    "quran": [
      4,
      64
    ]
  },
  {
    "n": 66,
    "ar": "الماجد",
    "trans": "Al-Maajid",
    "meaning": {
      "ar": "ذو المجد والكرم",
      "en": "Noble"
    }
  },
  {
    "n": 67,
    "ar": "الواحد",
    "trans": "Al-Wahid",
    "meaning": {
      "ar": "الذي لا شريك له",
      "en": "The One"
    },
    "quran": [
      12,
      39
    ]
  },
  {
    "n": 68,
    "ar": "الأحد",
    "trans": "Al-Ahad",
    "meaning": {
      "ar": "الفرد الذي لا نظير له",
      "en": "The Utterly One"
    },
    "quran": [
      7,
      180
    ]
  },
  {
    "n": 69,
    "ar": "الصمد",
    "trans": "As-Samad",
    "meaning": {
      "ar": "السيد الذي كمل في سؤدده، المقصود في الحوائج",
      "en": "The Supreme, the Lord of all"
    },
    "quran": [
      112,
      2
    ]
  },
  {
    "n": 70,
    "ar": "القادر",
    "trans": "Al-Qadir",
    "meaning": {
      "ar": "الذي لا يعجزه شيء",
      "en": "All-Powerful"
    },
    "quran": [
      6,
      65
    ]
  },
  {
    "n": 71,
    "ar": "المقتدر",
    "trans": "Al-Muqtadir",
    "meaning": {
      "ar": "القوي الذي لا يعجزه شيء",
      "en": "Perfect in Power"
    }
  },
  {
    "n": 72,
    "ar": "المقدم",
    "trans": "Al-Muqaddim",
    "meaning": {
      "ar": "الذي يقدّم من يشاء ويؤخر",
      "en": "He who brings forward"
    }
  },
  {
    "n": 73,
    "ar": "المؤخر",
    "trans": "Al-Mu’akhkhir",
    "meaning": {
      "ar": "الذي يؤخر من يشاء",
      "en": "He who defers"
    }
  },
  {
    "n": 74,
    "ar": "الأول",
    "trans": "Al-Awwal",
    "meaning": {
      "ar": "الذي ليس قبله شيء",
      "en": "The First"
    },
    "quran": [
      57,
      3
    ]
  },
  {
    "n": 75,
    "ar": "الآخر",
    "trans": "Al-Akhir",
    "meaning": {
      "ar": "الذي ليس بعده شيء",
      "en": "The Last"
    },
    "quran": [
      57,
      3
    ]
  },
  {
    "n": 76,
    "ar": "الظاهر",
    "trans": "Az-Zahir",
    "meaning": {
      "ar": "الذي ليس فوقه شيء",
      "en": "The Manifest"
    },
    "quran": [
      57,
      3
    ]
  },
  {
    "n": 77,
    "ar": "الباطن",
    "trans": "Al-Batin",
    "meaning": {
      "ar": "الذي ليس دونه شيء",
      "en": "The Impenetrable"
    },
    "quran": [
      57,
      3
    ]
  },
  {
    "n": 78,
    "ar": "الوالي",
    "trans": "Al-Wali",
    "meaning": {
      "ar": "المتصرف في ملكوت خلقه",
      "en": "Governor of all"
    },
    "quran": [
      3,
      13
    ]
  },
  {
    "n": 79,
    "ar": "المتعالي",
    "trans": "Al-Muta’ali",
    "meaning": {
      "ar": "العالي بذاته عن كل نقص",
      "en": "Most Transcendent"
    }
  },
  {
    "n": 80,
    "ar": "البر",
    "trans": "Al-Barr",
    "meaning": {
      "ar": "المحسن في حق عباده",
      "en": "Most Kind"
    },
    "quran": [
      2,
      177
    ]
  },
  {
    "n": 81,
    "ar": "التواب",
    "trans": "At-Tawwab",
    "meaning": {
      "ar": "الذي يوفق عباده للتواب ثم يقبلها",
      "en": "All-Repenting"
    },
    "quran": [
      2,
      222
    ]
  },
  {
    "n": 82,
    "ar": "المنتقم",
    "trans": "Al-Muntaqim",
    "meaning": {
      "ar": "الذي ينتقم لعباده من الظالمين",
      "en": "Avenger"
    }
  },
  {
    "n": 83,
    "ar": "العفو",
    "trans": "Al-‘Afuw",
    "meaning": {
      "ar": "الذي يمحو الذنوب ويتجاوز",
      "en": "Pardoning"
    },
    "quran": [
      2,
      219
    ]
  },
  {
    "n": 84,
    "ar": "الرؤوف",
    "trans": "Ar-Ra’uf",
    "meaning": {
      "ar": "شديد الرحمة بعباده",
      "en": "Most Compassionate"
    }
  },
  {
    "n": 85,
    "ar": "مالك الملك",
    "trans": "Malik al-Mulk",
    "meaning": {
      "ar": "الذي بيده ملكوت كل شيء",
      "en": "Owner of the Kingdom"
    },
    "quran": [
      3,
      26
    ]
  },
  {
    "n": 86,
    "ar": "ذو الجلال والإكرام",
    "trans": "Dhu al-Jalali wa al-Ikram",
    "meaning": {
      "ar": "المستحق أن يُجلّ ويُكرم",
      "en": "Lord of Majesty and Honor"
    },
    "quran": [
      55,
      27
    ]
  },
  {
    "n": 87,
    "ar": "المقسط",
    "trans": "Al-Muqst",
    "meaning": {
      "ar": "العادل في حكمه",
      "en": "Equitable"
    },
    "quran": [
      5,
      42
    ]
  },
  {
    "n": 88,
    "ar": "الجامع",
    "trans": "Al-Jami",
    "meaning": {
      "ar": "الذي يجمع الخلائق ليوم لا ريب فيه",
      "en": "All-Gathering"
    },
    "quran": [
      3,
      155
    ]
  },
  {
    "n": 89,
    "ar": "الغني",
    "trans": "Al-Ghani",
    "meaning": {
      "ar": "الغني عن كل ما سواه",
      "en": "All-Rich"
    },
    "quran": [
      31,
      26
    ]
  },
  {
    "n": 90,
    "ar": "المغني",
    "trans": "Al-Mughni",
    "meaning": {
      "ar": "الذي يغني من يشاء",
      "en": "Enricher"
    }
  },
  {
    "n": 91,
    "ar": "المانع",
    "trans": "Al-Mani",
    "meaning": {
      "ar": "الذي يمنع بقدرته",
      "en": "Withholder"
    }
  },
  {
    "n": 92,
    "ar": "الضار",
    "trans": "Ad-Darr",
    "meaning": {
      "ar": "الذي لا يضرّه إلا بقدرته",
      "en": "One who can cause harm"
    },
    "quran": [
      2,
      177
    ]
  },
  {
    "n": 93,
    "ar": "النافع",
    "trans": "An-Nafi",
    "meaning": {
      "ar": "الذي لا ينفع إلا بقدرته",
      "en": "One who can bring benefit"
    }
  },
  {
    "n": 94,
    "ar": "النور",
    "trans": "An-Nur",
    "meaning": {
      "ar": "نور السماوات والأرض",
      "en": "Light of the heavens and the earth"
    },
    "quran": [
      24,
      35
    ]
  },
  {
    "n": 95,
    "ar": "الهادي",
    "trans": "Al-Hadi",
    "meaning": {
      "ar": "الذي يهدي عباده إلى الحق",
      "en": "Guide"
    },
    "quran": [
      2,
      16
    ]
  },
  {
    "n": 96,
    "ar": "البديع",
    "trans": "Al-Badi",
    "meaning": {
      "ar": "الذي لم يكن له مثل ولا كفو",
      "en": "Originator with no precedent"
    }
  },
  {
    "n": 97,
    "ar": "الباقي",
    "trans": "Al-Baqi",
    "meaning": {
      "ar": "الباقي بعد فناء خلقه",
      "en": "Everlasting"
    },
    "quran": [
      18,
      46
    ]
  },
  {
    "n": 98,
    "ar": "الوارث",
    "trans": "Al-Warith",
    "meaning": {
      "ar": "الباقي بعد زوال كل شيء",
      "en": "Inheritor of all"
    },
    "quran": [
      2,
      233
    ]
  },
  {
    "n": 99,
    "ar": "الرشيد",
    "trans": "Ar-Rashid",
    "meaning": {
      "ar": "الذي أرشد الخلق إلى مصالحهم",
      "en": "Guide to good"
    },
    "quran": [
      11,
      87
    ]
  },
  {
    "n": 100,
    "ar": "الصبور",
    "trans": "As-Sabur",
    "meaning": {
      "ar": "الذي لا يعاجل ولا ينتقم",
      "en": "Most Patient"
    }
  }
];;
