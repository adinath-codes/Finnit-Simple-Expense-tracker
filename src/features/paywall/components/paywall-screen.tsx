import { Image } from "expo-image";
import { useLocales } from "expo-localization";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
     ActivityIndicator,
     Platform,
     ScrollView,
     StyleSheet,
     Text,
     useWindowDimensions,
     View,
     type NativeScrollEvent,
     type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Finn, JournalType } from "@/constants/theme";
import { useSubscription } from "@/features/paywall/providers/subscription-provider";
import {
     isRevenueCatTestStore,
     trackPaywallImpression,
} from "@/features/paywall/services/subscription-service";
import type { SubscriptionPlan } from "@/features/paywall/types/subscription.types";

const PAGE_COUNT = 4;
const PAYWALL_FONT_SIZE = {
     xxl: 24,
     xl: 19,
     lg: 14,
     md: 11,
     sm: 10,
     xs: 8,
     button: 13,
} as const;
const STORE_NAME = Platform.OS === "android" ? "Google Play" : "App Store";
const STORE_CONSOLE_NAME =
     Platform.OS === "android" ? "Google Play Console" : "App Store Connect";

const HERO_BENEFITS = [
     {
          image: require("../../../../assets/images/paywall/benefits/natural-capture.png"),
          accessibilityLabel: "Chromatic journal, pen, and coin",
          title: "Capture before the detail fades",
          body: "Write naturally. Finn keeps the amount, place, person, and purpose together.",
     },
     {
          image: require("../../../../assets/images/paywall/benefits/receipt-scan.png"),
          accessibilityLabel: "Chromatic receipt inside a scan frame",
          title: "Turn receipts into memory",
          body: "Scan once and keep useful line items without rebuilding the receipt by hand.",
     },
     {
          image: require("../../../../assets/images/paywall/benefits/money-insights.png"),
          accessibilityLabel: "Chromatic magnifying glass over a money chart",
          title: "See patterns you can act on",
          body: "Ask what changed, spot repeat spending, and make the next decision with context.",
     },
] as const;

const COMPARISON_ROWS: {
     label: string;
     manual: boolean;
}[] = [
     { label: "Capture a quick note", manual: true },
     { label: "Sort every detail for you", manual: false },
     { label: "Remember each receipt item", manual: false },
     { label: "Find patterns across months", manual: false },
     { label: "Search by person, place, or purpose", manual: false },
     { label: "Answer questions about your money", manual: false },
];

export default function PaywallScreen() {
     const { height, width } = useWindowDimensions();
     const [locale] = useLocales();
     const pageWidth = Math.min(width, 620);
     const heroScale = Math.max(
          0.86,
          Math.min(1.06, Math.min(pageWidth / 384, height / 832)),
     );
     const pager = useRef<ScrollView>(null);
     const [page, setPage] = useState(0);
     const {
          state,
          offering,
          plans,
          error,
          isBusy,
          purchase,
          restore,
          redeemOfferCode,
          refresh,
     } = useSubscription();
     const orderedPlans = useMemo(
          () =>
               [...plans].sort(
                    (left, right) => planScore(right) - planScore(left),
               ),
          [plans],
     );
     const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
     const selectedPlan =
          orderedPlans.find((plan) => plan.id === selectedPlanId) ??
          orderedPlans[0] ??
          null;
     const testStore = isRevenueCatTestStore();

     useEffect(() => {
          if (
               orderedPlans[0] &&
               !orderedPlans.some((plan) => plan.id === selectedPlanId)
          ) {
               setSelectedPlanId(orderedPlans[0].id);
          } else if (orderedPlans.length === 0 && selectedPlanId) {
               setSelectedPlanId(null);
          }
     }, [orderedPlans, selectedPlanId]);

     useEffect(() => {
          if (offering)
               void trackPaywallImpression(offering).catch(() => undefined);
     }, [offering]);

     const goToPage = (next: number) => {
          const target = Math.max(0, Math.min(PAGE_COUNT - 1, next));
          pager.current?.scrollTo({ x: target * pageWidth, animated: true });
          setPage(target);
     };

     const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
          setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
     };

     const trialConfigured = selectedPlan?.hasRequiredThreeDayTrial === true;
     const eligibleForTrial = selectedPlan?.trialEligibility === "eligible";
     const trialUnknown = selectedPlan?.trialEligibility === "unknown";
     const checkoutLabel = !selectedPlan
          ? "Store plans unavailable"
          : testStore
            ? "Run Test Store purchase"
          : eligibleForTrial
            ? "Start my 3-day free trial"
            : `Continue for ${selectedPlan.fullPrice}`;
     const pageActionLabels = [
          trialPriceLabel(
               selectedPlan,
               locale.languageTag,
               locale.currencySymbol,
               locale.currencyCode,
          ),
          "See how my trial works",
          "Try it for free",
          checkoutLabel,
     ];

     const continueAction = async () => {
          if (page < PAGE_COUNT - 1) {
               goToPage(page + 1);
               return;
          }
          if (selectedPlan) await purchase(selectedPlan);
     };

     return (
          <View style={[styles.outer, styles.heroOuter]}>
               <StatusBar style="light" />
               <SafeAreaView edges={["top"]} style={styles.safeArea}>
                    <ScrollView
                         ref={pager}
                         horizontal
                         pagingEnabled
                         nestedScrollEnabled
                         bounces={false}
                         showsHorizontalScrollIndicator={false}
                         onMomentumScrollEnd={onScrollEnd}
                         scrollEventThrottle={16}
                         style={styles.pager}
                    >
                         <Page width={pageWidth}>
                              <HeroPage scale={heroScale} />
                         </Page>
                         <Page width={pageWidth}>
                              <ComparisonPage width={pageWidth} height={height} />
                         </Page>
                         <Page width={pageWidth}>
                              <TrialTimelinePage
                                   width={pageWidth}
                                   height={height}
                              />
                         </Page>
                         <Page width={pageWidth}>
                              <PlanPage
                                   plans={orderedPlans}
                                   selectedPlan={selectedPlan}
                                   selectedPlanId={selectedPlanId}
                                   onSelect={setSelectedPlanId}
                                   state={state}
                                   error={error}
                                   testStore={testStore}
                                   onRetry={() => void refresh()}
                              />
                         </Page>
                    </ScrollView>

                    <SafeAreaView
                         edges={["bottom"]}
                         style={[
                              styles.footer,
                              styles.heroFooter,
                              page === 0 && {
                                   paddingHorizontal: 10 * heroScale,
                              },
                              page === 1 && {
                                   position: "absolute",
                                   right: 0,
                                   bottom: 0,
                                   left: 0,
                                   zIndex: 2,
                                   paddingHorizontal: clamp(
                                        pageWidth * 0.035,
                                        10,
                                        16,
                                   ),
                              },
                              page === 2 && {
                                   paddingHorizontal: clamp(
                                        pageWidth * 0.035,
                                        10,
                                        16,
                                   ),
                              },
                         ]}
                    >
                         {page <= 2 ? null : page === PAGE_COUNT - 1 &&
                           selectedPlan ? (
                              <Text style={styles.billingDisclosure}>
                                   {billingDisclosure(selectedPlan, testStore)}
                              </Text>
                         ) : (
                              <Text style={styles.billingDisclosure}>
                                   {pageReassurance(page, selectedPlan)}
                              </Text>
                         )}

                         {page === PAGE_COUNT - 1 ? (
                              <>
                                   {!testStore && trialUnknown && selectedPlan ? (
                                        <Text style={styles.eligibilityNote}>
                                             The 3-day trial is for eligible new
                                             subscribers. {STORE_NAME} confirms
                                             eligibility before purchase.
                                        </Text>
                                   ) : null}
                                   <View style={styles.utilityLinks}>
                                        <FooterLink
                                             label="Restore purchases"
                                             disabled={isBusy}
                                             onPress={() => void restore()}
                                        />
                                        {Platform.OS === "ios" ? (
                                             <FooterLink
                                                  label="Redeem offer code"
                                                  disabled={isBusy}
                                                  onPress={() =>
                                                       void redeemOfferCode()
                                                  }
                                             />
                                        ) : null}
                                   </View>
                                   <View style={styles.legalLinks}>
                                        <FooterLink
                                             label="Terms"
                                             onPress={() =>
                                                  router.push("/legal/terms")
                                             }
                                        />
                                        <Text style={styles.linkSeparator}>
                                             •
                                        </Text>
                                        <FooterLink
                                             label="Privacy"
                                             onPress={() =>
                                                  router.push("/legal/privacy")
                                             }
                                        />
                                   </View>
                              </>
                         ) : null}

                         <Button
                              label={pageActionLabels[page]}
                              disabled={
                                   isBusy ||
                                   (page === PAGE_COUNT - 1 &&
                                        (!selectedPlan ||
                                             (!testStore && !trialConfigured)))
                              }
                              onPress={() => void continueAction()}
                              style={[
                                   styles.primaryButton,
                                   styles.heroPrimaryButton,
                                   page === 0 && {
                                        height: 54 * heroScale,
                                        borderRadius: 10 * heroScale,
                                        borderWidth: 1 * heroScale,
                                   },
                                   page === 1 && {
                                        height: clamp(height * 0.07, 54, 62),
                                        borderRadius: 10,
                                        borderWidth: 1,
                                   },
                                   page === 2 && {
                                        height: clamp(height * 0.07, 54, 62),
                                        borderRadius: 10,
                                        borderWidth: 1,
                                   },
                              ]}
                         >
                              {isBusy ? (
                                   <ActivityIndicator color="#082C26" />
                              ) : (
                                   <Text
                                        style={[
                                             styles.primaryButtonText,
                                             styles.heroPrimaryButtonText,
                                             page === 0 && {
                                                  fontSize:
                                                       PAYWALL_FONT_SIZE.button *
                                                       heroScale,
                                                  letterSpacing:
                                                       0.7 * heroScale,
                                                  color: "#090C35",
                                             },
                                             page === 2 && {
                                                  fontSize:
                                                       PAYWALL_FONT_SIZE.lg,
                                             },
                                        ]}
                                   >
                                        {pageActionLabels[page]}
                                   </Text>
                              )}
                         </Button>
                    </SafeAreaView>
               </SafeAreaView>
          </View>
     );
}

function Page({ width, children }: { width: number; children: ReactNode }) {
     return <View style={[styles.page, { width }]}>{children}</View>;
}

function HeroPage({ scale }: { scale: number }) {
     const responsive = useMemo(
          () => createHeroResponsiveStyles(scale),
          [scale],
     );

     return (
          <ScrollView
               contentContainerStyle={[styles.heroContent, responsive.content]}
               showsVerticalScrollIndicator={false}
          >
               <View style={[styles.heroArtWrap, responsive.artWrap]}>
                    <View style={[styles.heroGlow, responsive.glow]} />
                    <Image
                         source={require("../../../../assets/images/paywall/finn-pro-badge.png")}
                         contentFit="contain"
                         style={[styles.finnProBadgeImage, responsive.badge]}
                         accessibilityLabel="Finn Pro"
                    />
                    <Text
                         pointerEvents="none"
                         style={[
                              styles.heroSparkle,
                              styles.heroSparkleLeft,
                              responsive.sparkleLeft,
                         ]}
                    >
                         ✦
                    </Text>
                    <Text
                         pointerEvents="none"
                         style={[
                              styles.heroSparkle,
                              styles.heroSparkleRight,
                              responsive.sparkleRight,
                         ]}
                    >
                         ✦
                    </Text>
                    <Image
                         source={require("../../../../assets/images/paywall/finn-chromatic.png")}
                         contentFit="contain"
                         style={[styles.heroArt, responsive.art]}
                         accessibilityLabel="Finn holding a glowing money journal"
                    />
               </View>
               <Text style={[styles.heroStatTitle, responsive.statTitle]}>
                    Over <Text style={styles.heroStatHighlight}>90%</Text>{" "}
                    wanted to see what each purchase leaves in their budget.
               </Text>
               <Text style={[styles.heroStatSource, responsive.statSource]}>
                    U.S. CFPB consumer research
               </Text>
               <View style={[styles.heroBenefitsCard, responsive.benefitsCard]}>
                    {HERO_BENEFITS.map((benefit) => (
                         <View
                              key={benefit.title}
                              style={[
                                   styles.heroBenefitRow,
                                   responsive.benefitRow,
                              ]}
                         >
                              <Image
                                   source={benefit.image}
                                   contentFit="contain"
                                   style={[
                                        styles.heroBenefitImage,
                                        responsive.benefitImage,
                                   ]}
                                   accessibilityLabel={
                                        benefit.accessibilityLabel
                                   }
                              />
                              <View style={styles.benefitText}>
                                   <Text
                                        style={[
                                             styles.heroBenefitTitle,
                                             responsive.benefitTitle,
                                        ]}
                                   >
                                        {benefit.title}
                                   </Text>
                                   <Text
                                        style={[
                                             styles.heroBenefitBody,
                                             responsive.benefitBody,
                                        ]}
                                   >
                                        {benefit.body}
                                   </Text>
                              </View>
                         </View>
                    ))}
               </View>
          </ScrollView>
     );
}

function ComparisonPage({ width, height }: { width: number; height: number }) {
     const responsive = useMemo(
          () => createComparisonResponsiveStyles(width, height),
          [height, width],
     );

     return (
          <ScrollView
               nestedScrollEnabled
               contentContainerStyle={[
                    styles.comparisonContent,
                    responsive.content,
               ]}
               showsVerticalScrollIndicator={false}
          >
               <View style={responsive.titleSlot}>
                    <Text style={[styles.referencePageTitle, responsive.title]}>
                         Remember more without tracking more.
                    </Text>
               </View>
               <View style={[styles.comparisonCard, responsive.card]}>
                    <View
                         style={[styles.comparisonHeader, responsive.header]}
                    >
                         <View style={styles.comparisonLabelSpacer} />
                         <Text
                              style={[
                                   styles.comparisonColumnLabel,
                                   responsive.manualColumn,
                              ]}
                         >
                              MANUAL
                         </Text>
                         <View
                              style={[
                                   styles.premiumColumnHeader,
                                   responsive.premiumColumn,
                              ]}
                         >
                              <Image
                                   source={require("../../../../assets/images/paywall/finn-pro-badge.png")}
                                   contentFit="contain"
                                   style={responsive.comparisonBadge}
                                   accessibilityLabel="Finn Pro"
                              />
                         </View>
                    </View>
                    {COMPARISON_ROWS.map((row, index) => (
                         <View
                              key={row.label}
                              style={[
                                   styles.comparisonRow,
                                   index === COMPARISON_ROWS.length - 1 &&
                                        styles.comparisonRowLast,
                              ]}
                         >
                              <Text style={styles.comparisonFeature}>
                                   {row.label}
                              </Text>
                              <View
                                   style={[
                                        styles.comparisonCell,
                                        responsive.manualColumn,
                                   ]}
                              >
                                   {row.manual ? (
                                        <Icon
                                             name="check"
                                             size={16}
                                             color="#B5C5DB"
                                             animation={false}
                                        />
                                   ) : null}
                              </View>
                              <View
                                   style={[
                                        styles.comparisonCell,
                                        styles.premiumComparisonCell,
                                        responsive.premiumColumn,
                                        index === COMPARISON_ROWS.length - 1 &&
                                             styles.premiumComparisonCellLast,
                                   ]}
                              >
                                   <Icon
                                        name="check"
                                        size={17}
                                        color="#FFFFFF"
                                        animation={false}
                                   />
                              </View>
                         </View>
                    ))}
               </View>
          </ScrollView>
     );
}

function TrialTimelinePage({
     width,
     height,
}: {
     width: number;
     height: number;
}) {
     const responsive = useMemo(
          () => createTimelineResponsiveStyles(width, height),
          [height, width],
     );
     const timeline = [
          {
               label: "Today",
               body: "Unlock full access to all Finn Pro features",
               icon: "lock" as IconName,
          },
          {
               label: "Day 2",
               body: "Get reminded when your free trial is about to end",
               icon: "bell" as IconName,
          },
          {
               label: "Day 3",
               body: "Your selected plan begins. Cancel anytime before your free trial ends",
               icon: "check" as IconName,
          },
     ];

     return (
          <ScrollView
               contentContainerStyle={[
                    styles.timelineContent,
                    responsive.content,
               ]}
               showsVerticalScrollIndicator={false}
          >
               <Image
                    source={require("../../../../assets/images/paywall/finn-pro-badge.png")}
                    contentFit="contain"
                    style={responsive.badge}
                    accessibilityLabel="Finn Pro"
               />
               <Text
                    style={[styles.referencePageTitle, responsive.title]}
               >
                    How your free trial works
               </Text>
               <View style={[styles.timelineCard, responsive.card]}>
                    <View style={[styles.timelineRail, responsive.rail]} />
                    {timeline.map((item) => (
                         <View
                              key={item.label}
                              style={[styles.timelineRow, responsive.row]}
                         >
                              <View
                                   style={[
                                        styles.timelineMarker,
                                        responsive.marker,
                                   ]}
                              >
                                   <Icon
                                        name={item.icon}
                                        size={responsive.iconSize}
                                        color="#FFFFFF"
                                        animation={false}
                                   />
                              </View>
                              <View style={styles.timelineCopy}>
                                   <Text style={styles.timelineLabel}>
                                        {item.label}
                                   </Text>
                                   <Text style={styles.timelineBody}>
                                        {item.body}
                                   </Text>
                              </View>
                         </View>
                    ))}
               </View>
          </ScrollView>
     );
}

function PlanPage({
     plans,
     selectedPlan,
     selectedPlanId,
     onSelect,
     state,
     error,
     testStore,
     onRetry,
}: {
     plans: SubscriptionPlan[];
     selectedPlan: SubscriptionPlan | null;
     selectedPlanId: string | null;
     onSelect: (id: string) => void;
     state: string;
     error: string | null;
     testStore: boolean;
     onRetry: () => void;
}) {
     const noThreeDayTrial =
          plans.length > 0 &&
          !plans.some((plan) => plan.hasRequiredThreeDayTrial);

     return (
          <ScrollView
               contentContainerStyle={styles.planContent}
               showsVerticalScrollIndicator={false}
          >
               <Image
                    source={require("../../../../assets/images/paywall/finn-pro-badge.png")}
                    contentFit="contain"
                    style={styles.planBadge}
                    accessibilityLabel="Finn Pro"
               />
               <Text style={styles.referencePageTitle}>
                    {testStore
                         ? "Choose a Test Store plan."
                         : planStartsImmediately(selectedPlan)
                         ? "Choose the Premium plan that fits."
                         : "Choose what happens after your free trial."}
               </Text>

               {state === "loading" ? (
                    <View style={styles.storeState}>
                         <ActivityIndicator color={Finn.primary} />
                         <Text style={styles.storeStateText}>
                              Loading your {STORE_NAME} plans…
                         </Text>
                    </View>
               ) : plans.length > 0 ? (
                    <View style={styles.planList}>
                         {plans.map((plan, index) => {
                              const selected = plan.id === selectedPlanId;
                              const badgeLabel =
                                   index === 0
                                        ? "BEST VALUE"
                                        : index === 1
                                          ? "MOST POPULAR"
                                          : null;
                              return (
                                   <Button
                                        key={plan.id}
                                        label={`Select ${plan.name}`}
                                        accessibilityState={{ selected }}
                                        onPress={() => onSelect(plan.id)}
                                        style={[
                                             styles.planCard,
                                             selected &&
                                                  styles.selectedPlanCard,
                                        ]}
                                   >
                                        {badgeLabel ? (
                                             <View
                                                  style={
                                                       styles.recommendedBadge
                                                  }
                                             >
                                                  <Text
                                                       style={
                                                            styles.recommendedBadgeText
                                                       }
                                                  >
                                                       {badgeLabel}
                                                  </Text>
                                             </View>
                                        ) : null}
                                        <View style={styles.planCardRow}>
                                             <View style={styles.planNameBlock}>
                                                  <Text style={styles.planName}>
                                                       {plan.name}
                                                  </Text>
                                                  <Text
                                                       adjustsFontSizeToFit
                                                       minimumFontScale={0.82}
                                                       numberOfLines={1}
                                                       style={styles.planSummary}
                                                  >
                                                       {planCardSummary(plan)}
                                                  </Text>
                                             </View>
                                             <Text
                                                  adjustsFontSizeToFit
                                                  minimumFontScale={0.78}
                                                  numberOfLines={1}
                                                  style={styles.planRate}
                                             >
                                                  {planCardRate(plan)}
                                             </Text>
                                        </View>
                                        {selected ? (
                                             <View style={styles.selectionMark}>
                                                  <Icon
                                                       name="check"
                                                       size={15}
                                                       color="#FFFFFF"
                                                       animation={false}
                                                  />
                                             </View>
                                        ) : null}
                                   </Button>
                              );
                         })}
                    </View>
               ) : (
                    <View style={styles.storeState}>
                         <Text style={styles.storeStateTitle}>
                              Plans aren’t available yet
                         </Text>
                         <Text style={styles.storeStateText}>
                              {error ??
                                   "Add a current RevenueCat offering with a subscription package."}
                         </Text>
                         <Button
                              label="Retry loading plans"
                              onPress={onRetry}
                              style={styles.retryButton}
                         >
                              <Text style={styles.retryButtonText}>Retry</Text>
                         </Button>
                    </View>
               )}

               {!testStore && noThreeDayTrial ? (
                    <View
                         accessibilityRole="alert"
                         style={styles.configurationWarning}
                    >
                         <Text style={styles.configurationWarningTitle}>
                              3-day trial setup required
                         </Text>
                         <Text style={styles.configurationWarningBody}>
                              Add a three-day free introductory offer to this
                              product in {STORE_CONSOLE_NAME} before release.
                         </Text>
                    </View>
               ) : null}
               {error && plans.length > 0 ? (
                    <Text style={styles.purchaseError}>{error}</Text>
               ) : null}
               {selectedPlan ? (
                    <Text style={styles.cancelNote}>
                         Cancel anytime in your {STORE_NAME} subscription
                         settings.
                    </Text>
               ) : null}
          </ScrollView>
     );
}

function FooterLink({
     label,
     onPress,
     disabled = false,
}: {
     label: string;
     onPress: () => void;
     disabled?: boolean;
}) {
     return (
          <Button
               label={label}
               disabled={disabled}
               onPress={onPress}
               style={styles.footerLinkButton}
          >
               <Text style={styles.footerLinkText}>{label}</Text>
          </Button>
     );
}

function clamp(value: number, minimum: number, maximum: number) {
     return Math.max(minimum, Math.min(maximum, value));
}

function createComparisonResponsiveStyles(width: number, height: number) {
     const horizontalPadding = clamp(width * 0.055, 14, 24);
     const cardWidth = width - horizontalPadding * 2;
     const premiumColumnWidth = cardWidth * 0.27;

     return {
          content: {
               paddingHorizontal: horizontalPadding,
               paddingTop: clamp(height * 0.14, 88, 126),
               paddingBottom: clamp(height * 0.14, 96, 120),
          },
          title: {
               maxWidth: width * 0.74,
               fontSize: PAYWALL_FONT_SIZE.xl,
          },
          titleSlot: {
               minHeight: clamp(height * 0.115, 82, 100),
               alignItems: "center" as const,
          },
          card: {
               minHeight: clamp(height * 0.46, 330, 410),
               marginTop: clamp(height * 0.03, 18, 28),
          },
          header: { minHeight: clamp(height * 0.06, 42, 50) },
          manualColumn: { width: cardWidth * 0.23 },
          premiumColumn: { width: premiumColumnWidth },
          comparisonBadge: {
               width: premiumColumnWidth * 0.8,
               height: clamp(height * 0.03, 20, 27),
          },
     };
}

function createTimelineResponsiveStyles(width: number, height: number) {
     const horizontalInset = clamp(width * 0.125, 34, 58);
     const railWidth = clamp(width * 0.075, 24, 32);

     return {
          content: {
               paddingHorizontal: horizontalInset,
               paddingTop: clamp(height * 0.195, 132, 166),
               paddingBottom: 0,
          },
          badge: {
               position: "absolute" as const,
               top: clamp(height * 0.012, 8, 12),
               right: clamp(width * 0.02, 6, 10),
               width: clamp(width * 0.235, 78, 104),
               height: clamp(height * 0.034, 24, 30),
          },
          title: {
               maxWidth: width * 0.76,
               fontSize: PAYWALL_FONT_SIZE.xxl,
               lineHeight: 29,
          },
          card: {
               marginTop: clamp(height * 0.025, 17, 23),
               paddingBottom: clamp(height * 0.045, 28, 40),
          },
          rail: { width: railWidth },
          row: {
               minHeight: clamp(height * 0.13, 96, 112),
               gap: clamp(width * 0.045, 15, 20),
               paddingTop: clamp(height * 0.016, 10, 14),
          },
          marker: {
               width: railWidth,
               height: railWidth,
          },
          iconSize: clamp(width * 0.05, 18, 21),
     };
}

function createHeroResponsiveStyles(scale: number) {
     const scaled = (value: number) => Math.round(value * scale * 12) / 10;
     const badgeScaled = (value: number) => Math.round(value * scale * 10) / 10;

     return {
          content: {
               paddingHorizontal: scaled(4),
               paddingTop: 0,
               paddingBottom: scaled(10),
          },
          badge: {
               top: badgeScaled(48),
               right: badgeScaled(12),
               width: badgeScaled(84),
               height: badgeScaled(24),
          },
          artWrap: {
               height: scaled(190),
               marginTop: 0,
               marginBottom: 50,
               overflow: "visible" as const,
          },
          art: {
               height: scaled(190),
               transform: [{ translateY: 50 }],
          },
          glow: {
               bottom: 0,
               width: scaled(186),
               height: scaled(186),
               borderRadius: scaled(93),
          },
          sparkleLeft: {
               left: scaled(54),
               bottom: scaled(42),
               fontSize: scaled(14),
          },
          sparkleRight: {
               right: scaled(56),
               top: scaled(34),
               fontSize: scaled(11),
          },
          statTitle: {
               maxWidth: scaled(270),
               marginTop: scaled(8),
               fontSize: scaled(PAYWALL_FONT_SIZE.xl),
               lineHeight: scaled(23),
               letterSpacing: scaled(-0.35),
          },
          statSource: {
               marginTop: scaled(3),
               fontSize: scaled(PAYWALL_FONT_SIZE.xs),
               letterSpacing: scaled(0.28),
          },
          benefitsCard: {
               minHeight: scaled(260),
               marginTop: scaled(24),
               paddingHorizontal: scaled(13),
               borderRadius: scaled(22),
          },
          benefitRow: {
               minHeight: scaled(76),
               gap: scaled(9),
               paddingVertical: scaled(7),
          },
          benefitImage: { width: scaled(62), height: scaled(62) },
          benefitTitle: {
               fontSize: scaled(PAYWALL_FONT_SIZE.lg),
               lineHeight: scaled(18),
               marginVertical:10
          },
          benefitBody: {
               fontSize: scaled(PAYWALL_FONT_SIZE.md),
               lineHeight: scaled(15),
               marginTop: scaled(1),
          },
     };
}

function planScore(plan: SubscriptionPlan) {
     let score = plan.hasRequiredThreeDayTrial ? 100 : 0;
     if (plan.durationLabel === "1 year") score += 20;
     if (plan.durationLabel === "1 month") score += 10;
     return score;
}

function planCardRate(plan: SubscriptionPlan) {
     const period =
          plan.renewalPeriodLabel === "year"
               ? "YR"
               : plan.renewalPeriodLabel === "month"
                 ? "MO"
                 : plan.renewalPeriodLabel === "week"
                   ? "WK"
                   : plan.renewalPeriodLabel.toUpperCase();
     return `${plan.fullPrice} / ${period}`;
}

function planCardSummary(plan: SubscriptionPlan) {
     if (plan.durationLabel === "1 year" && plan.monthlyEquivalent) {
          return `${plan.durationLabel} • ${plan.monthlyEquivalent} / month`;
     }

     if (plan.durationLabel === "1 month") {
          const weeklyPrice = plan.package.product.pricePerWeekString;
          if (weeklyPrice) {
               return `${plan.durationLabel} • ${weeklyPrice} / week`;
          }
     }

     return `${plan.durationLabel} • ${plan.fullPrice}`;
}

function trialPriceLabel(
     plan: SubscriptionPlan | null,
     languageTag: string,
     localeCurrencySymbol: string | null,
     localeCurrencyCode: string | null,
) {
     const currencyCode =
          plan?.package.product.currencyCode ?? localeCurrencyCode;
     let currency = localeCurrencySymbol ?? localeCurrencyCode ?? "";

     if (currencyCode) {
          try {
               currency =
                    new Intl.NumberFormat(languageTag, {
                         style: "currency",
                         currency: currencyCode,
                         currencyDisplay: "narrowSymbol",
                         minimumFractionDigits: 0,
                         maximumFractionDigits: 0,
                    })
                         .formatToParts(0)
                         .find((part) => part.type === "currency")?.value ??
                    currencyCode;
          } catch {
               currency = currencyCode;
          }
     }

     return `Try for 0${currency ? ` ${currency}` : ""}`;
}

function pageReassurance(page: number, plan: SubscriptionPlan | null) {
     if (page === 0)
          return "A clearer money picture begins with one honest note.";
     if (page === 1)
          return "Keep the habit human. Let Finn handle the structure.";
     if (planStartsImmediately(plan)) {
          return `You’ll see the exact price before ${STORE_NAME} asks you to confirm.`;
     }
     if (plan?.trialEligibility === "unknown") {
          return `${STORE_NAME} confirms trial eligibility before purchase.`;
     }
     return "No charge today for eligible new subscribers. Cancel before the trial ends.";
}

function planStartsImmediately(plan: SubscriptionPlan | null) {
     return Boolean(
          plan &&
          (!plan.hasRequiredThreeDayTrial ||
               plan.trialEligibility === "ineligible"),
     );
}

function billingDisclosure(plan: SubscriptionPlan, testStore = false) {
     if (testStore) {
          return "RevenueCat Test Store simulates checkout and entitlement access; verify the 3-day trial in each store sandbox.";
     }
     if (
          !plan.hasRequiredThreeDayTrial ||
          plan.trialEligibility === "ineligible"
     ) {
          return `${plan.fullPrice} is charged on confirmation and renews every ${plan.renewalPeriodLabel} until cancelled.`;
     }
     if (plan.trialEligibility === "unknown") {
          return `Eligible new subscribers get 3 days free, then ${plan.fullPrice} every ${plan.renewalPeriodLabel}. Auto-renews until cancelled.`;
     }
     return `Free for 3 days, then ${plan.fullPrice} every ${plan.renewalPeriodLabel}. Auto-renews until cancelled.`;
}

const styles = StyleSheet.create({
     outer: {
          flex: 1,
          alignItems: "center",
          backgroundColor: "#102A50",
          experimental_backgroundImage:
               "linear-gradient(155deg, #0C5B5B 0%, #133E7D 45%, #54205F 100%)",
     },
     heroOuter: {
          backgroundColor: "#070A3D",
          experimental_backgroundImage:
               "linear-gradient(180deg, #070A3D 0%, #0B0E4B 58%, #111353 100%)",
     },
     safeArea: { flex: 1, width: "100%", maxWidth: 620 },
     topBar: {
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 17,
     },
     backSlot: { width: 80, alignItems: "flex-start" },
     backButton: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          minHeight: 38,
     },
     backLabel: {
          color: "#E7F9FF",
          fontFamily: JournalType.medium,
          fontSize: PAYWALL_FONT_SIZE.button,
     },
     dots: { flexDirection: "row", alignItems: "center", gap: 7 },
     dot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.28)",
     },
     activeDot: { width: 20, backgroundColor: "#73FFD1" },
     accountButton: { width: 44, height: 38 },
     pager: { flex: 1 },
     page: { flex: 1 },
     heroContent: {
          flexGrow: 1,
          alignItems: "center",
          paddingHorizontal: 4,
          paddingTop: 0,
          paddingBottom: 10,
     },
     finnProBadgeImage: {
          position: "absolute",
          top: 48,
          right: 12,
          zIndex: 4,
          width: 84,
          height: 24,
     },
     heroStatTitle: {
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.xl,
          lineHeight: 23,
          letterSpacing: -0.35,
          textAlign: "center",
          maxWidth: 270,
          marginTop: 8,
     },
     heroStatHighlight: { color: Finn.primary },
     heroStatSource: {
          color: "rgba(220, 235, 247, 0.70)",
          fontFamily: JournalType.medium,
          fontSize: PAYWALL_FONT_SIZE.xs,
          letterSpacing: 0.28,
          marginTop: 3,
     },
     heroArtWrap: {
          position: "relative",
          width: "100%",
          height: 298,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 0,
          overflow: "hidden",
     },
     heroGlow: {
          position: "absolute",
          bottom: 0,
          width: 186,
          height: 186,
          borderRadius: 93,
          backgroundColor: "rgba(62, 255, 196, 0.15)",
          boxShadow: "0px 0px 80px rgba(87, 221, 255, 0.28)",
     },
     heroSparkle: {
          position: "absolute",
          zIndex: 2,
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          textShadowColor: "rgba(121,255,209,0.75)",
          textShadowRadius: 8,
     },
     heroSparkleLeft: { left: 54, bottom: 42, fontSize: 14 },
     heroSparkleRight: { right: 56, top: 34, fontSize: 11 },
     heroArt: { position: "absolute", bottom: 0, width: "94%", height: 190 },
     heroBenefitsCard: {
          width: "100%",
          maxWidth: 520,
          minHeight: 260,
          marginTop: 24,
          paddingHorizontal: 13,
          borderRadius: 22,
          backgroundColor: "#17195D",
          borderWidth: 1,
          borderColor: "#292D7A",
     },
     heroBenefitRow: {
          flexGrow: 1,
          minHeight: 76,
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          paddingVertical: 7,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "rgba(205,213,255,0.18)",
     },
     heroBenefitImage: { width: 38, height: 38 },
     heroBenefitTitle: {
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.lg,
          lineHeight: 18,
     },
     heroBenefitBody: {
          color: "#C8D8EB",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.md,
          lineHeight: 15,
          marginTop: 1,
     },
     comparisonContent: {
          flexGrow: 1,
          paddingBottom: 0,
     },
     referencePageTitle: {
          alignSelf: "center",
          maxWidth: 300,
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.xl,
          lineHeight: 23,
          letterSpacing: -0.35,
          textAlign: "center",
     },
     eyebrow: {
          color: "#79FFD1",
          fontFamily: JournalType.bold,
          fontSize: 11,
          letterSpacing: 1.25,
          textAlign: "center",
     },
     sectionTitle: {
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: 28,
          lineHeight: 33,
          letterSpacing: -0.65,
          textAlign: "center",
          marginTop: 10,
     },
     comparisonTitle: { fontSize: 26, lineHeight: 31 },
     sectionBody: {
          color: "#CBDBEF",
          fontFamily: JournalType.regular,
          fontSize: 15,
          lineHeight: 21,
          textAlign: "center",
          marginTop: 10,
     },
     benefitText: { flex: 1 },
     comparisonCard: {
          flexGrow: 1,
          overflow: "visible",
          backgroundColor: "transparent",
     },
     comparisonHeader: {
          flexDirection: "row",
          alignItems: "stretch",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "rgba(182, 207, 255, 0.15)",
     },
     comparisonLabelSpacer: { flex: 1 },
     comparisonColumnLabel: {
          width: 74,
          color: "#AABAD1",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.lg,
          letterSpacing: 0.7,
          textAlign: "center",
          textAlignVertical: "center",
     },
     premiumColumnHeader: {
          alignItems: "center",
          justifyContent: "center",
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          backgroundColor: "#242872",
     },
     premiumMiniPill: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 8,
          experimental_backgroundImage:
               "linear-gradient(105deg, #79FFD1 0%, #79C7FF 52%, #F49BFF 100%)",
          boxShadow: "0px 4px 10px rgba(115, 203, 255, 0.24)",
     },
     premiumColumnLabel: {
          color: "#092336",
          fontFamily: JournalType.bold,
          fontSize: 9,
          letterSpacing: 0.8,
     },
     comparisonRow: {
          flexGrow: 1,
          minHeight: 52,
          flexDirection: "row",
          alignItems: "stretch",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: "rgba(182, 207, 255, 0.13)",
     },
     comparisonRowLast: { borderBottomWidth: 0 },
     comparisonFeature: {
          flex: 1,
          alignSelf: "center",
          color: "#F3F7FF",
          fontFamily: JournalType.medium,
          fontSize: PAYWALL_FONT_SIZE.lg,
          lineHeight: 17,
          paddingHorizontal: 14,
          paddingVertical: 10,
     },
     comparisonCell: {
          alignItems: "center",
          justifyContent: "center",
     },
     premiumComparisonCell: {
          backgroundColor: "#242872",
     },
     premiumComparisonCellLast: {
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
     },
     comparisonDash: {
          color: "#6E7D99",
          fontFamily: JournalType.medium,
          fontSize: 16,
     },
     comparisonCallout: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 17,
          backgroundColor: "#17195D",
          borderWidth: 1,
          borderColor: "#292D7A",
          boxShadow: "0px 8px 20px rgba(52, 27, 112, 0.18)",
     },
     comparisonCalloutText: {
          flex: 1,
          color: "#DCEBFA",
          fontFamily: JournalType.medium,
          fontSize: 12,
          lineHeight: 17,
     },
     timelineContent: {
          flexGrow: 1,
          paddingBottom: 0,
     },
     timelineCard: {
          position: "relative",
          paddingHorizontal: 0,
     },
     timelineRail: {
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          borderRadius: 999,
          experimental_backgroundImage:
               "linear-gradient(180deg, #5664FF 0%, #4757F2 62%, rgba(71, 87, 242, 0.48) 78%, rgba(48, 59, 157, 0.06) 100%)",
          boxShadow: "0px 8px 18px rgba(43, 52, 157, 0.34)",
     },
     timelineRow: {
          position: "relative",
          flexDirection: "row",
          alignItems: "flex-start",
     },
     timelineMarker: {
          zIndex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
     },
     timelineMarkerMint: {
          experimental_backgroundImage:
               "linear-gradient(145deg, #31E8A5 0%, #3FBBCF 100%)",
          boxShadow: "0px 5px 14px rgba(48, 232, 169, 0.28)",
     },
     timelineMarkerBlue: {
          experimental_backgroundImage:
               "linear-gradient(145deg, #5A9BFF 0%, #6864E8 100%)",
          boxShadow: "0px 5px 14px rgba(79, 123, 244, 0.30)",
     },
     timelineMarkerPink: {
          experimental_backgroundImage:
               "linear-gradient(145deg, #F077D5 0%, #A861EF 100%)",
          boxShadow: "0px 5px 14px rgba(213, 91, 222, 0.28)",
     },
     timelineCopy: { flex: 1, paddingRight: 4 },
     timelineLabel: {
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.xl,
          lineHeight: 23,
     },
     timelineBody: {
          color: "#BEC6DD",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.lg,
          lineHeight: 20,
          marginTop: 1,
     },
     timelineDivider: {
          position: "absolute",
          left: 58,
          right: 0,
          bottom: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: "rgba(188, 211, 246, 0.18)",
     },
     planContent: {
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 54,
          paddingBottom: 24,
     },
     planBadge: {
          position: "absolute",
          top: 8,
          right: 8,
          width: 94,
          height: 28,
     },
     trialBadge: {
          alignSelf: "center",
          borderRadius: 999,
          paddingHorizontal: 13,
          paddingVertical: 7,
          backgroundColor: "#79FFD1",
     },
     trialBadgeText: {
          color: "#082C26",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.md,
          letterSpacing: 1,
     },
     planList: { gap: 14, marginTop: 30 },
     planCard: {
          position: "relative",
          width: "100%",
          alignItems: "stretch",
          minHeight: 120,
          paddingHorizontal: 14,
          paddingTop: 22,
          paddingBottom: 12,
          borderRadius: 12,
          backgroundColor: "#D9DAF1",
          borderWidth: 2,
          borderColor: "#5361F2",
          boxShadow: "0px 4px 0px #171B75",
     },
     selectedPlanCard: {
          borderColor: "#5361F2",
          backgroundColor: "#F0FAF7",
          boxShadow: "0px 4px 0px #3340CB",
     },
     recommendedBadge: {
          position: "absolute",
          top: -2,
          left: -2,
          zIndex: 2,
          minHeight: 20,
          justifyContent: "center",
          paddingHorizontal: 9,
          borderTopLeftRadius: 11,
          borderBottomRightRadius: 6,
          backgroundColor: "#3D49CC",
     },
     recommendedBadgeText: {
          color: "#FFFFFF",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.xs * 1.3,
          letterSpacing: 0.7,
     },
     planCardRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          width: "100%",
     },
     planNameBlock: { flex: 1 },
     planName: {
          color: "#3038B6",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.lg * 1.3,
          lineHeight: 23.4,
     },
     planSummary: {
          color: "#3038B6",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.md * 1.3,
          lineHeight: 19.5,
          marginTop: 1,
     },
     planRate: {
          maxWidth: "42%",
          color: "#3038B6",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.md * 1.3,
          letterSpacing: 0.35,
          textAlign: "right",
     },
     selectionMark: {
          position: "absolute",
          top: -9,
          right: -8,
          zIndex: 3,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: "#5361F2",
          borderWidth: 2,
          borderColor: "#D9E3FF",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0px 2px 5px rgba(16, 22, 100, 0.35)",
     },
     storeState: {
          alignItems: "center",
          gap: 10,
          marginTop: 25,
          padding: 22,
          borderRadius: 21,
          backgroundColor: "#F0F0FF",
          borderWidth: 1,
          borderColor: "#7378E8",
     },
     storeStateTitle: {
          color: "#25206E",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.lg,
          textAlign: "center",
     },
     storeStateText: {
          color: "#66648B",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.button,
          lineHeight: 19,
          textAlign: "center",
     },
     retryButton: {
          height: 40,
          paddingHorizontal: 22,
          borderRadius: 14,
          backgroundColor: "#79FFD1",
     },
     retryButtonText: {
          color: "#14714E",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.button,
     },
     configurationWarning: {
          marginTop: 13,
          padding: 13,
          borderRadius: 15,
          backgroundColor: "rgba(255, 229, 173, 0.96)",
     },
     configurationWarningTitle: {
          color: "#714D0D",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.button,
     },
     configurationWarningBody: {
          color: "#765D30",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.md,
          lineHeight: 16,
          marginTop: 3,
     },
     purchaseError: {
          color: "#FFD3DB",
          fontFamily: JournalType.medium,
          fontSize: PAYWALL_FONT_SIZE.md,
          lineHeight: 17,
          textAlign: "center",
          marginTop: 12,
     },
     cancelNote: {
          color: "#C9DAEC",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.md,
          textAlign: "center",
          marginTop: 15,
     },
     footer: {
          paddingHorizontal: 18,
          paddingTop: 9,
          paddingBottom: 3,
          backgroundColor: "rgba(7, 20, 49, 0.80)",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: "rgba(255,255,255,0.13)",
     },
     heroFooter: {
          paddingHorizontal: 18,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: "#070A3D",
          borderTopColor: "#292D7A",
     },
     billingDisclosure: {
          minHeight: 31,
          color: "#DCE8F6",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.md,
          lineHeight: 15,
          textAlign: "center",
          paddingHorizontal: 8,
          marginBottom: 7,
     },
     primaryButton: {
          width: "100%",
          height: 54,
          borderRadius: 17,
          backgroundColor: "#79FFD1",
          boxShadow: "0px 7px 20px rgba(67, 255, 196, 0.25)",
     },
     primaryButtonText: {
          color: "#082C26",
          fontFamily: JournalType.bold,
          fontSize: PAYWALL_FONT_SIZE.button,
     },
     heroPrimaryButton: {
          borderRadius: 10,
          backgroundColor: "#F7FBFA",
          borderWidth: 1,
          borderColor: "#DDE5E7",
          boxShadow: "0px 5px 0px #929AA7",
     },
     heroPrimaryButtonText: {
          color: "#090C35",
          fontSize: PAYWALL_FONT_SIZE.button,
          letterSpacing: 0.7,
          textTransform: "uppercase",
     },
     eligibilityNote: {
          color: "#AFC2D9",
          fontFamily: JournalType.regular,
          fontSize: PAYWALL_FONT_SIZE.sm,
          lineHeight: 14,
          textAlign: "center",
          marginTop: 7,
          paddingHorizontal: 12,
     },
     utilityLinks: {
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
          marginTop: 3,
     },
     legalLinks: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
     },
     footerLinkButton: { minHeight: 32, paddingHorizontal: 5 },
     footerLinkText: {
          color: "#D8E7F6",
          fontFamily: JournalType.medium,
          fontSize: PAYWALL_FONT_SIZE.md,
          textDecorationLine: "underline",
     },
     linkSeparator: { color: "#8EA4BC", fontSize: PAYWALL_FONT_SIZE.sm },
});
