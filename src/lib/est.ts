/**
 * Static facts from the official EST I papers (see docs/EST_BLUEPRINT.md).
 * Used on marketing pages so they render without a database round-trip.
 */
export const estSubjects = [
  {
    code: "est1-math",
    name: "EST I Math",
    short: "Math",
    duration: 75,
    questions: 50,
    format: "One section · calculator allowed",
    summary:
      "Algebra, data and functions in realistic contexts — tables, bar charts, graphs and multi-question scenarios, exactly as they appear on test day.",
    areas: [
      "Foundational Algebra",
      "Data Analysis and Probability",
      "Advanced Algebra and Functions",
      "Geometry and Trigonometry",
    ],
  },
  {
    code: "est1-literacy",
    name: "EST I Literacy",
    short: "Literacy",
    duration: 90,
    questions: 85,
    format: "Three modules · passage-based",
    summary:
      "Long and short passages from literature, history, social studies and science, with editing and comprehension questions side by side with the text.",
    areas: ["Words in Context", "Expression of Ideas", "Standard English Conventions"],
  },
] as const;
