/*
 * sRGB to luminance conversion according to:
 * https://en.wikipedia.org/wiki/SRGB
 *
 * The r, g, and b arguments must be between 0 and 1.
 * Returns a value between 0 and 1.
 */
export function luminance(r: number, g: number, b: number) {
  function gamma_inv(u: number) {
    if (u <= 0.04045)
      return u / 12.92;
    return ((u + 0.055) / 1.055) ** 2.4;
  }

  return 0.2126 * gamma_inv(r) +
	 0.7152 * gamma_inv(g) +
	 0.0722 * gamma_inv(b);
}
