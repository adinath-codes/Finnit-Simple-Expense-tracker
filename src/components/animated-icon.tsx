import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Finn, JournalType } from '@/constants/theme';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
const SPLASH_TRACK_WIDTH = 104;
const SPLASH_EXIT_DELAY = 1220;

export function AnimatedSplashOverlay({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [visible, setVisible] = useState(true);
  const started = useRef(false);
  const { width } = useWindowDimensions();
  const characterSize = Math.min(Math.max(width * 0.68, 232), 304);

  const overlayOpacity = useSharedValue(1);
  const sceneScale = useSharedValue(reducedMotion ? 1 : 0.82);
  const characterOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const characterY = useSharedValue(reducedMotion ? 0 : 22);
  const characterRotation = useSharedValue(reducedMotion ? 0 : -2.2);
  const copyOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const copyY = useSharedValue(reducedMotion ? 0 : 10);
  const accentScale = useSharedValue(reducedMotion ? 1 : 0);
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  const finish = () => setVisible(false);

  const start = () => {
    if (reducedMotion) {
      overlayOpacity.value = withTiming(0, { duration: 180 }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      });
      return;
    }

    characterOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    characterY.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    characterRotation.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    sceneScale.value = withSequence(
      withTiming(1.035, {
        duration: 480,
        easing: Easing.out(Easing.cubic),
      }),
      withSpring(1, { damping: 19, stiffness: 180, mass: 0.7 }),
      withDelay(
        570,
        withTiming(1.09, {
          duration: 360,
          easing: Easing.inOut(Easing.cubic),
        }),
      ),
    );
    accentScale.value = withDelay(
      210,
      withSequence(
        withSpring(1.18, { damping: 12, stiffness: 260, mass: 0.55 }),
        withSpring(1, { damping: 16, stiffness: 190, mass: 0.6 }),
      ),
    );
    copyOpacity.value = withDelay(
      260,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }),
    );
    copyY.value = withDelay(
      260,
      withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) }),
    );
    progress.value = withDelay(
      350,
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.cubic) }),
    );
    overlayOpacity.value = withDelay(
      SPLASH_EXIT_DELAY,
      withTiming(0, { duration: 330, easing: Easing.inOut(Easing.quad) }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finish);
      }),
    );
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sceneStyle = useAnimatedStyle(() => ({
    opacity: characterOpacity.value,
    transform: [
      { translateY: characterY.value },
      { rotateZ: `${characterRotation.value}deg` },
      { scale: sceneScale.value },
    ],
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyOpacity.value,
    transform: [{ translateY: copyY.value }],
  }));
  const accentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: accentScale.value }],
  }));
  const progressStyle = useAnimatedStyle(() => {
    const scaleX = interpolate(
      progress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: interpolate(progress.value, [0, 0.08, 1], [0, 1, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress.value, [0, 1], [-SPLASH_TRACK_WIDTH / 2, 0], Extrapolation.CLAMP) },
        { scaleX },
      ],
    };
  });

  if (!visible) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={() => {
        if (started.current) return;
        started.current = true;
        void SplashScreen.hideAsync().finally(start);
      }}
      pointerEvents="auto"
      style={[styles.splashOverlay, overlayStyle]}
    >
      <Animated.View style={[styles.splashScene, sceneStyle]}>
        <View style={[styles.characterStage, { width: characterSize, height: characterSize }]}>
          <Animated.View style={[styles.sparkCluster, accentStyle]}>
            <View style={[styles.spark, styles.sparkTall]} />
            <View style={[styles.spark, styles.sparkShort]} />
          </Animated.View>
          <Image
            accessible={false}
            contentFit="contain"
            source={require('@/assets/images/character/toast/info.png')}
            style={{ width: characterSize, height: characterSize }}
            transition={0}
          />
        </View>

        <Animated.View style={[styles.brandBlock, copyStyle]}>
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>Finn</Text>
            <Animated.View style={[styles.brandDot, accentStyle]} />
          </View>
          <Text style={styles.tagline}>Money, remembered.</Text>
        </Animated.View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Finn.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  splashScene: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 22,
  },
  characterStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkCluster: {
    position: 'absolute',
    right: '12%',
    top: '25%',
    width: 34,
    height: 31,
    zIndex: 2,
  },
  spark: {
    position: 'absolute',
    width: 4,
    borderRadius: 3,
    backgroundColor: Finn.primary,
  },
  sparkTall: {
    height: 19,
    right: 8,
    top: 0,
    transform: [{ rotateZ: '18deg' }],
  },
  sparkShort: {
    height: 12,
    right: 0,
    top: 17,
    transform: [{ rotateZ: '58deg' }],
  },
  brandBlock: {
    alignItems: 'center',
    marginTop: -14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  wordmark: {
    color: Finn.ink,
    fontFamily: JournalType.black,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2.6,
    lineHeight: 54,
  },
  brandDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Finn.primary,
    marginLeft: 5,
    marginTop: 4,
  },
  tagline: {
    color: Finn.secondary,
    fontFamily: JournalType.medium,
    fontSize: 14,
    letterSpacing: 0.15,
    marginTop: 3,
  },
  progressTrack: {
    width: SPLASH_TRACK_WIDTH,
    height: 4,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: Finn.line,
    marginTop: 34,
  },
  progressFill: {
    width: SPLASH_TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: Finn.primary,
  },
});
