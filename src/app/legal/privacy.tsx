import { FINN_WEBSITE_URLS } from "@/constants/website-links";
import { LegalWebsiteRedirectScreen } from "@/features/legal/components/legal-website-redirect-screen";

export default function PrivacyPolicyRoute() {
  return (
    <LegalWebsiteRedirectScreen
      title="Privacy Policy"
      url={FINN_WEBSITE_URLS.privacyPolicy}
    />
  );
}
