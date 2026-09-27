export const FINN_WEBSITE_URLS = {
  termsOfService: "https://www.finn-it.app/terms",
  privacyPolicy: "https://www.finn-it.app/privacy/",
  aiPolicy: "https://www.finn-it.app/ai-policy/",
  privacyChoices: "https://www.finn-it.app/privacy-choices/",
  support: "https://www.finn-it.app/support/",
  deleteAccount: "https://www.finn-it.app/delete-account/",
  acknowledgement: "https://www.finn-it.app/acknowledgement/",
} as const;

export type FinnWebsiteUrl =
  (typeof FINN_WEBSITE_URLS)[keyof typeof FINN_WEBSITE_URLS];
