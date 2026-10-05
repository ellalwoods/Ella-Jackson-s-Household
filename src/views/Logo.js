import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The 3a heart: Ella's and Jackson's circles as the lobes, meeting at the point.
 * Used as the "&" in the wordmark (with a dusty-blue point, as in logo 3e) and,
 * on a linen tile, as the app icon (public/icon.svg, with a butter point).
 */
export function HeartMark({ size = 24, point = '#8FB0CF' }) {
    return (_jsxs("svg", { className: "heart-mark", viewBox: "19 23 62 56", width: size * 62 / 56, height: size, "aria-hidden": "true", children: [_jsx("polygon", { points: "22,51 50,79 78,51", fill: point }), _jsx("circle", { cx: "37", cy: "41", r: "18", fill: "#E886B8" }), _jsx("circle", { cx: "63", cy: "41", r: "18", fill: "#2A9E80" })] }));
}
/** Logo 3e: "Ella ♥ Jackson" with the heart standing in for the ampersand. */
export function Logo({ onClick }) {
    return (_jsxs("button", { className: "logo", onClick: onClick, "aria-label": "Ella and Jackson, Household", children: [_jsxs("span", { className: "logo-names", children: [_jsx("span", { style: { color: '#A9477B' }, children: "Ella" }), _jsx(HeartMark, { size: 28 }), _jsx("span", { style: { color: '#1B6B56' }, children: "Jackson" })] }), _jsx("span", { className: "logo-sub", children: "Household" })] }));
}
