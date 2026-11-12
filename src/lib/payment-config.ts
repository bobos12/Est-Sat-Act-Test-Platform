/** Where students send manual payments. Change the numbers here only. */
export const PAYMENT = {
  instapay: { label: "InstaPay", to: "01115655645", hint: "Send from any bank app through InstaPay." },
  vodafone_cash: { label: "Vodafone Cash", to: "01115655645", hint: "Send from your Vodafone Cash wallet." },
  whatsapp: "201115655645", // international format, digits only
  whatsappDisplay: "+20 111 565 5645",
} as const;

export type PayMethod = "instapay" | "vodafone_cash";
