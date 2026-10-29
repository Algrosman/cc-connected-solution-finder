/* Pre-built advisory packages shown after the four areas in the catalog.
   Each package lists existing offerings by phase; the full text is in brochures/package-content.json
   and the PDF is generated from it with scripts/render_brochures.js. */
window.CC_PACKAGES = [
  {
    id: "PKG-NEW",
    title: "All-in-One New Hospital Package",
    fit: ["new"],
    tagline: "Eight Cleveland Clinic offerings across finance, safety and quality, digital and education, sequenced as one advisory program from design to opening day.",
    note: "One engagement lead coordinates all four areas. Offerings can be added or swapped at scoping.",
    pdf: "brochures/0_Packages/All-in-One_New_Hospital_Package_Profile.pdf",
    // Shown in the last phase's empty slot so all three columns end level
    milestone: { label: "Milestone", title: "Opening day", text: "Every area ready on the same day" },
    phases: [
      { name: "Plan", when: "Design and pre-construction", ids: ["FIN-05", "IT-01", "SQPE-03"] },
      { name: "Prepare", when: "During construction", ids: ["FIN-04", "SQPE-04", "EDU-04"] },
      { name: "Activate", when: "The run-up to opening", ids: ["IT-06", "EDU-05"] }
    ]
  }
];
