/*
  Solution finder questions.

  How it works
  - Every visitor answers "status" (new or existing hospital) and "domain" first.
  - Each domain then asks one to three questions. A question can be limited to one
    hospital status ("status") or shown only after a specific earlier answer ("when").
  - "short" is the label shown in the "Your answers" list.
  - Each option adds points to product IDs ("scores"). The highest-scoring product that
    is offered to the visitor's hospital type is recommended; the next two are shown
    as "Also consider". Smaller scores (2 and 1) on an option set those two alternatives.
  - Product IDs must match data/products.js. Options can also carry "status" to show
    them only to new or existing hospitals.
*/
window.CC_FINDER = {
  domains: [
    {
      id: "finance",
      name: "Finance",
      short: "Finance",
      blurb: "Feasibility, business cases, partnerships, performance improvement, planning and finance transformation.",
      packet: {
        href: "brochures/1_Finance/00_Finance_Advisory_Offerings_Packet.pdf",
        title: "Finance Advisory packet",
        text: "A two-page executive summary of the finance advisory lifecycle, followed by every Finance profile in one PDF."
      }
    },
    {
      id: "sqpe",
      name: "Safety, Quality & Patient Experience (SQPE)",
      phrase: "safety, quality and patient experience",
      short: "SQPE",
      blurb: "Assessment, governance, maturity guides and training that raise safety, quality and the patient experience."
    },
    {
      id: "digital",
      name: "Digital Tools & Analytics",
      short: "Digital",
      blurb: "Digital strategy, EHR, infrastructure and cybersecurity, data and AI governance, and the patient's digital journey."
    },
    {
      id: "education",
      name: "Education",
      short: "Education",
      blurb: "Observerships, fellowships, leadership development, simulation and Cleveland Clinic experts for your teams."
    }
  ],

  status: {
    id: "status",
    title: "Where is your hospital today?",
    help: "This tells us which solutions are designed for your stage.",
    options: [
      { id: "existing", label: "We operate an existing hospital", detail: "The hospital is open and treating patients." },
      { id: "new", label: "We are building a new hospital", detail: "The hospital is in planning, design or construction." }
    ]
  },

  domain: {
    id: "domain",
    title: "Where would you like Cleveland Clinic's support?",
    help: "Pick one area. You can come back and explore another afterwards."
  },

  questions: {
    finance: [
      {
        id: "fin-stage",
        short: "Leadership question",
        title: "Which question is your leadership trying to answer?",
        help: "These follow the Cleveland Clinic Healthcare Financial Advisory Lifecycle.",
        options: [
          { id: "plan", label: "Can we do this?", detail: "Deciding whether to build, expand, invest or partner.",
            scores: { "FIN-01": 2, "FIN-02": 1, "FIN-07": 1 } },
          { id: "measure", status: ["existing"], label: "How are we performing?", detail: "Understanding margins, costs and the numbers leaders see.",
            scores: { "FIN-03": 2, "FIN-04": 2 } },
          { id: "measure-new", status: ["new"], label: "What should we measure from day one?", detail: "Designing the KPIs, dashboards and reporting leaders will rely on.",
            scores: { "FIN-04": 4 } },
          { id: "manage", label: "How do we plan with confidence?", detail: "Volume and revenue models, budgets, forecasts and capital plans.",
            scores: { "FIN-05": 4 } },
          { id: "transform", label: "Do we have the right finance organization?", detail: "Finance structure, processes, governance and chart of accounts.",
            scores: { "FIN-06": 4 } }
        ]
      },
      {
        id: "fin-plan",
        short: "Evaluating",
        when: { "fin-stage": ["plan"] },
        title: "What are you evaluating?",
        options: [
          { id: "facility", label: "A new facility, service line or market entry", detail: "Market sizing, feasibility and a board-ready business case.",
            scores: { "FIN-01": 3 } },
          { id: "partnership", label: "A partnership, joint venture or acquisition", detail: "Deal economics, structures and financial due diligence.",
            scores: { "FIN-02": 4 } },
          { id: "large", label: "A large-scale development", detail: "A new campus, academic medical center, network or national program.",
            scores: { "FIN-07": 4 } }
        ]
      },
      {
        id: "fin-gap",
        short: "Gap today",
        when: { "fin-stage": ["measure"] },
        title: "Where is the gap today?",
        options: [
          { id: "margin", label: "Margins are under pressure", detail: "We need to find cost savings and revenue opportunities.",
            scores: { "FIN-03": 3 } },
          { id: "service-line", label: "We can't see which service lines make money", detail: "Cost accounting and margin by service line.",
            scores: { "FIN-03": 3 } },
          { id: "reporting", label: "Leaders get late or conflicting reports", detail: "KPIs are defined differently and dashboards disagree.",
            scores: { "FIN-04": 4 } }
        ]
      },
      {
        id: "fin-scale",
        short: "Scope",
        title: "How large is the organization in scope?",
        options: [
          { id: "single", label: "A single hospital", scores: { "FIN-01": 1, "FIN-03": 1, "FIN-04": 1, "FIN-05": 1 } },
          { id: "network", label: "A multi-site network or health system", scores: { "FIN-05": 1, "FIN-06": 1, "FIN-07": 1 } },
          { id: "national", label: "A national, government or academic program", scores: { "FIN-07": 2, "FIN-06": 1 } }
        ]
      }
    ],

    sqpe: [
      {
        id: "sqpe-goal",
        short: "Most helpful now",
        status: ["existing"],
        title: "What would help your hospital most right now?",
        options: [
          { id: "program", label: "A structured, year-round program", detail: "Baseline assessment, quarterly metric reviews and an annual reassessment.",
            scores: { "SQPE-01": 4, "SQPE-02": 1 } },
          { id: "maturity", label: "An honest read on how mature we are", detail: "Compare your leaders' view with Cleveland Clinic's assessment.",
            scores: { "SQPE-02": 4, "SQPE-01": 1 } },
          { id: "topics", label: "Practical guidance on specific topics", detail: "Infection prevention, medication safety, falls, nursing practice and more.",
            scores: { "SQPE-04": 4 } },
          { id: "workforce", label: "Skills and culture across our workforce", detail: "Training and ongoing learning for caregivers and leaders.",
            scores: { "SQPE-05": 1, "SQPE-06": 1, "SQPE-07": 1 } }
        ]
      },
      {
        id: "sqpe-goal-new",
        short: "Most helpful before opening",
        status: ["new"],
        title: "What would help your hospital most before opening?",
        options: [
          { id: "design-in", label: "Designing safety and quality in from day one", detail: "Governance, priority metrics, policies and a readiness roadmap.",
            scores: { "SQPE-03": 4 } },
          { id: "accreditation", label: "Getting ready for accreditation", detail: "Opening and accreditation milestones planned together.",
            scores: { "SQPE-03": 3, "SQPE-04": 2 } },
          { id: "topics", label: "Guides showing what good practice looks like", detail: "Concise references for infection prevention, medication safety and more.",
            scores: { "SQPE-04": 4 } },
          { id: "workforce", label: "Training our future workforce", detail: "Courses and expert sessions for caregivers and leaders.",
            scores: { "SQPE-05": 1, "SQPE-07": 1 } }
        ]
      },
      {
        id: "sqpe-learn",
        short: "How teams learn",
        when: { "sqpe-goal": ["workforce"], "sqpe-goal-new": ["workforce"] },
        title: "How should your teams learn?",
        options: [
          { id: "elearning", label: "On-demand eLearning", detail: "Consistent courses that scale across shifts and sites.",
            scores: { "SQPE-05": 4 } },
          { id: "trainers", status: ["existing"], label: "Train our own leaders to teach", detail: "Internal faculty for HEART, REDE, high reliability and more.",
            scores: { "SQPE-06": 4 } },
          { id: "experts", label: "Regular sessions with Cleveland Clinic experts", detail: "A monthly speaker series and sessions on topics you choose.",
            scores: { "SQPE-07": 4 } }
        ]
      },
      {
        id: "sqpe-focus",
        short: "Top priority",
        title: "Which priority matters most?",
        options: [
          { id: "safety", label: "Patient safety and infection prevention", scores: { "SQPE-04": 1, "SQPE-03": 1 } },
          { id: "quality", label: "Clinical quality and outcome metrics", scores: { "SQPE-01": 1, "SQPE-02": 1, "SQPE-03": 1 } },
          { id: "experience", label: "Patient experience and communication", scores: { "SQPE-06": 1, "SQPE-07": 1, "SQPE-05": 1 } },
          { id: "culture", label: "Safety culture and high reliability", scores: { "SQPE-02": 1, "SQPE-06": 1, "SQPE-05": 1 } }
        ]
      }
    ],

    digital: [
      {
        id: "dig-area",
        short: "Digital agenda",
        title: "Which part of your digital agenda needs attention?",
        options: [
          { id: "strategy", label: "Overall digital strategy", detail: "Where to invest, in what order, tied to your capital plan.",
            scores: { "IT-01": 4 } },
          { id: "core", label: "EHR, infrastructure and cybersecurity", detail: "The core systems the hospital runs on.",
            scores: {} },
          { id: "data", label: "Data, analytics and AI", detail: "Measures, data governance and the responsible use of AI.",
            scores: {} },
          { id: "patient", label: "The patient's digital experience", detail: "Apps, portals and digital journeys aligned to clinical pathways.",
            scores: { "IT-07": 4, "IT-03": 2, "IT-04": 1 } }
        ]
      },
      {
        id: "dig-strategy",
        short: "Next milestone",
        when: { "dig-area": ["strategy"] },
        title: "What is your next milestone?",
        options: [
          { id: "plan-refresh", label: "A strategic plan or capital planning cycle", scores: { "IT-01": 2, "IT-02": 2, "IT-04": 1 } },
          { id: "go-live", status: ["new"], label: "An opening date we have to hit", detail: "Build, testing, training and cutover on a fixed date.", scores: { "IT-06": 5, "IT-03": 1 } },
          { id: "go-live", status: ["existing"], label: "A major go-live or system migration", detail: "Build, testing, training and cutover on a fixed date.", scores: { "IT-06": 5, "IT-03": 1 } },
          { id: "system-decision", label: "A major system decision", detail: "Such as an EHR selection or a new data center.", scores: { "IT-01": 1, "IT-03": 2, "IT-02": 2 } }
        ]
      },
      {
        id: "dig-core",
        short: "Most pressing",
        when: { "dig-area": ["core"] },
        title: "What is most pressing?",
        options: [
          { id: "ehr", label: "Selecting, implementing or improving our EHR", scores: { "IT-03": 4, "IT-06": 2, "IT-04": 1 } },
          { id: "integration", label: "Hosting, integration and interoperability", scores: { "IT-02": 4, "IT-03": 2, "IT-04": 1 } },
          { id: "cyber", label: "Cybersecurity, privacy and downtime resilience", scores: { "IT-02": 4, "IT-03": 2, "IT-05": 1 } },
          { id: "activation", label: "Getting to go-live safely and on time", scores: { "IT-06": 5, "IT-03": 2, "IT-02": 1 } }
        ]
      },
      {
        id: "dig-data",
        short: "Most pressing",
        when: { "dig-area": ["data"] },
        title: "What is most pressing?",
        options: [
          { id: "measures", label: "Agreeing the measures leaders rely on", detail: "A focused measure set and certified metric definitions.", scores: { "IT-04": 4, "IT-01": 2, "IT-05": 1 } },
          { id: "foundations", label: "Data governance, architecture and team", detail: "The foundations analytics depends on.", scores: { "IT-04": 4, "IT-05": 2, "IT-02": 1 } },
          { id: "ai", label: "Governing the safe use of AI", detail: "Policies, review and monitoring for every AI tool.", scores: { "IT-05": 4, "IT-04": 2, "IT-01": 1 } }
        ]
      }
    ],

    education: [
      {
        id: "edu-who",
        short: "Who to develop",
        title: "Who do you want to develop?",
        options: [
          { id: "physicians", label: "Physicians and clinical trainees", scores: { "EDU-01": 1, "EDU-02": 1, "EDU-06": 1, "EDU-07": 1 } },
          { id: "caregivers", label: "Nurses, pharmacists and frontline caregivers", scores: { "EDU-04": 1, "EDU-05": 1, "EDU-01": 1 } },
          { id: "leaders", label: "Executives and leaders", scores: { "EDU-03": 6 } },
          { id: "educators", label: "Medical school faculty and educators", scores: { "EDU-06": 7 } }
        ]
      },
      {
        id: "edu-format",
        short: "Experience",
        title: "What kind of experience fits best?",
        options: [
          { id: "observe", label: "Send people to Cleveland Clinic to observe", scores: { "EDU-01": 4, "EDU-03": 1 } },
          { id: "hands-on", label: "Hands-on training, simulation or fellowships", scores: { "EDU-02": 2, "EDU-05": 3 } },
          { id: "experts", label: "Bring Cleveland Clinic experts to our teams", scores: { "EDU-06": 5 } },
          { id: "cases", status: ["existing"], label: "Specialist opinions on our physicians' complex cases", detail: "A written report from a Cleveland Clinic specialist, typically within three days.",
            scores: { "EDU-07": 10, "EDU-06": 2, "EDU-01": 1 } },
          { id: "in-house", label: "Build a lasting program in our organization", scores: { "EDU-04": 4, "EDU-05": 1, "EDU-06": 1 } }
        ]
      },
      {
        id: "edu-time",
        short: "Time commitment",
        when: { "edu-format": ["observe", "hands-on", "experts", "in-house"] },
        title: "How much time can participants commit?",
        options: [
          { id: "days", label: "A few hours to a few days", scores: { "EDU-06": 2, "EDU-04": 1, "EDU-05": 2, "EDU-03": 1 } },
          { id: "weeks", label: "One to four weeks", scores: { "EDU-01": 2, "EDU-05": 1, "EDU-03": 1 } },
          { id: "months", label: "Several months", scores: { "EDU-03": 1, "EDU-04": 1, "EDU-06": 1 } },
          { id: "year", label: "A year or longer", scores: { "EDU-02": 3 } }
        ]
      }
    ]
  }
};
