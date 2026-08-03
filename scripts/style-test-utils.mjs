import assert from "node:assert/strict";

const channelMaximum = 255;
const srgbLinearBoundary = 4.045e-2;
const srgbLinearDivisor = 12.92;
const srgbOffset = 0.055;
const srgbScale = 1.055;
const srgbGamma = 2.4;
const redWeight = 2.126e-1;
const greenWeight = 7.152e-1;
const blueWeight = 7.22e-2;
const contrastOffset = 0.05;

export function getBlock(stylesheet, selector) {
  const start = stylesheet.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Expected a ${selector} token block.`);

  const bodyStart = start + selector.length + 2;
  let depth = 1;
  for (let index = bodyStart; index < stylesheet.length; index += 1) {
    if (stylesheet.charAt(index) === "{") depth += 1;
    if (stylesheet.charAt(index) === "}") depth -= 1;
    if (depth === 0) return stylesheet.slice(bodyStart, index);
  }

  throw new Error(`Expected ${selector} token block to close.`);
}

export function getDeclarations(stylesheet, selector) {
  return new Map(
    [...getBlock(stylesheet, selector).matchAll(/(?<name>--[\w-]+):\s*(?<value>[^;]+);/gu)].map(
      ({ groups }) => [groups.name, groups.value.trim()],
    ),
  );
}

export function resolveColor(declarations, token) {
  const value = declarations.get(`--${token}`);
  assert.ok(value, `Missing --${token} token.`);

  const reference = value.match(/^var\((--[\w-]+)\)$/u);
  if (!reference) return value.toLowerCase();

  const referenceValue = declarations.get(reference[1]);
  assert.ok(referenceValue, `Missing ${reference[1]} reference token.`);
  return referenceValue.toLowerCase();
}

function relativeLuminance(hex) {
  const [red, green, blue] = hex
    .slice(1)
    .match(/.{2}/gu)
    .map((channel) => Number.parseInt(channel, 16) / channelMaximum)
    .map((channel) =>
      channel <= srgbLinearBoundary
        ? channel / srgbLinearDivisor
        : ((channel + srgbOffset) / srgbScale) ** srgbGamma,
    );

  return red * redWeight + green * greenWeight + blue * blueWeight;
}

function contrastRatio(foreground, background) {
  const [lightest, darkest] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].toSorted((left, right) => right - left);

  return (lightest + contrastOffset) / (darkest + contrastOffset);
}

export function assertContrast(declarations, { foreground, background, minimum }) {
  const foregroundColor = resolveColor(declarations, foreground);
  const backgroundColor = resolveColor(declarations, background);
  const ratio = contrastRatio(foregroundColor, backgroundColor);

  assert.ok(
    ratio >= minimum,
    `Expected ${foreground} on ${background} to meet ${minimum}:1 contrast; received ${ratio.toFixed(2)}:1.`,
  );
}
