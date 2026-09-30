import { FINN_WEBSITE_URLS } from "@/constants/website-links";
import { LegalWebsiteRedirectScreen } from "@/features/legal/components/legal-website-redirect-screen";

export default function TermsRoute() {
  return (
    <LegalWebsiteRedirectScreen
      title="Terms of Service"
      url={FINN_WEBSITE_URLS.termsOfService}
    />
  );
}
