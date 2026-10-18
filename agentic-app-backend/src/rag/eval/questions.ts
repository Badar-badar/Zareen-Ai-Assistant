export interface EvalQuestion {
  id: number;
  question: string;
  // Text a retrieved chunk must contain. null = no document answers this question.
  mustContain: string | null;
  type: "exact" | "meaning" | "no-answer";
}

export const QUESTIONS: EvalQuestion[] = [
  { id: 1, type: "exact", question: "What is the SKU of the Smart Watch Series 5?", mustContain: "item-06" },
  { id: 2, type: "exact", question: "Which product is model KB-MECH-ERG80?", mustContain: "KB-MECH-ERG80" },
  { id: 3, type: "exact", question: "Which Bluetooth version do the headphones use?", mustContain: "Bluetooth 5.3" },
  { id: 4, type: "exact", question: "What is the support phone number?", mustContain: "555-0199" },
  { id: 5, type: "exact", question: "How much is overnight delivery?", mustContain: "Overnight Delivery" },
  { id: 6, type: "meaning", question: "How long do I have to send something back?", mustContain: "from the date of package delivery" },
  { id: 7, type: "meaning", question: "Can I change my delivery address after ordering?", mustContain: "within **2 hours**" },
  { id: 8, type: "meaning", question: "How long until refund money reaches my card?", mustContain: "5 to 10 business days" },
  { id: 9, type: "meaning", question: "My parcel says delivered but isn't here. What now?", mustContain: "marked delivered" },
  { id: 10, type: "meaning", question: "Which items can't be returned?", mustContain: "Final clearance" },
  { id: 11, type: "meaning", question: "Can I use two discount codes together?", mustContain: "Only one promotional discount code" },
  { id: 12, type: "meaning", question: "How do I cancel an order I just placed?", mustContain: "within **1 hour**" },
  { id: 13, type: "meaning", question: "Which buy-now-pay-later services do you accept?", mustContain: "Klarna" },
  { id: 14, type: "meaning", question: "How long is the monitor warranty?", mustContain: "3-Year Zero-Dead-Pixel" },
  { id: 15, type: "meaning", question: "Can the monitor charge my laptop?", mustContain: "65W Power Delivery" },
  { id: 16, type: "meaning", question: "How do I factory-reset the headphones?", mustContain: "Power + Volume Down" },
  { id: 17, type: "meaning", question: "What does a refund back to my card cost?", mustContain: "$5.99 return postage fee" },
  { id: 18, type: "no-answer", question: "Do you sell gaming laptops?", mustContain: null },
  { id: 19, type: "no-answer", question: "Who is the CEO of the company?", mustContain: null },
  { id: 20, type: "no-answer", question: "Do you offer gift wrapping?", mustContain: null },
];