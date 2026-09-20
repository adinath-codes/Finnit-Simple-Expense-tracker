import Svg, { Path } from "react-native-svg";

/** Apple logo used only for the non-iOS branded fallback button. */
export function AppleMark({ size = 20, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.22-.22 2.39.49 3.23.49.83 0 2.12-.86 3.58-.73.61.03 2.33.25 3.43 1.86-3.19 1.85-2.69 6.02.55 7.32-.65 1.71-1.5 3.41-2.79 4.03Zm-3.8-13.23c-.15-2.52 1.88-4.59 4.2-4.79.32 2.91-2.64 5.08-4.2 4.79Z"
      />
    </Svg>
  );
}

/** Google-provided four-color G artwork for sign-in controls. */
export function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityElementsHidden>
      <Path fill="#EA4335" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
      <Path fill="#4285F4" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.713H.956v2.332A9 9 0 0 0 9 18Z" />
      <Path fill="#FBBC05" d="M3.963 10.707A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.707V4.961H.956A9 9 0 0 0 0 9c0 1.452.348 2.827.956 4.039l3.007-2.332Z" />
      <Path fill="#34A853" d="M9 3.58c1.322 0 2.508.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
    </Svg>
  );
}
