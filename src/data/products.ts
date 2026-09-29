/**
 * Automattic's ecosystem of WordPress products. Each entry becomes one forest
 * scene on the home page, one tick in the stop index and one possible
 * destination for "Explore a random biome". Add a product here (plus a
 * scene kind in src/scripts/forest/scenes.ts) and every part of the page
 * picks it up.
 */

/** The forest vignettes the renderer knows how to paint. */
export type SceneKind =
  | 'meadow'
  | 'beavers'
  | 'squirrels'
  | 'bear'
  | 'hummingbird'
  | 'web'
  | 'bees'
  | 'fireflies';

export interface Scene {
  kind: SceneKind;
  /** Hour of the forest's one day (6 = sunrise, 19 = sunset). The sky follows it. */
  hour: number;
  /** Seeds the ridges, trees and flowers so each scene is its own place. */
  seed: number;
}

export interface Product {
  slug: string;
  name: string;
  url: string;
  host: string;
  logo: string;
  /** Logo aspect ratio (width / height), used to reserve space. */
  logoRatio: number;
  /** Optical size correction so marks with more or less padding read alike. */
  logoScale: number;
  /** One plain line saying what the product is: a description, never a claim. */
  tagline: string;
  haiku: [string, string, string];
  /** What lives in this product's clearing, for anyone who cannot see it. */
  sceneLabel: string;
  scene: Scene;
}

export const products: Product[] = [
  {
    slug: 'wordpress-com',
    name: 'WordPress.com',
    url: 'https://wordpress.com/',
    host: 'wordpress.com',
    logo: '/logos/wordpress-com.svg',
    logoRatio: 170 / 36,
    logoScale: 1.12,
    tagline: 'A home for your website, built on WordPress',
    haiku: ['Stick by stick, they build', 'a home where the river bends,', 'open to the world'],
    sceneLabel: 'Beavers building a lodge on a still pond',
    scene: { kind: 'beavers', hour: 7.4, seed: 11 },
  },
  {
    slug: 'woocommerce',
    name: 'WooCommerce',
    url: 'https://woocommerce.com/',
    host: 'woocommerce.com',
    logo: '/logos/woocommerce.svg',
    logoRatio: 95 / 26,
    logoScale: 0.86,
    tagline: 'Open-source ecommerce for WordPress',
    haiku: ['Acorns, counted twice,', 'a little shop in the oak', 'busy through the fall'],
    sceneLabel: 'Squirrels storing acorns in an old oak',
    scene: { kind: 'squirrels', hour: 9.0, seed: 23 },
  },
  {
    slug: 'wordpress-vip',
    name: 'WordPress VIP',
    url: 'https://wpvip.com/',
    host: 'wpvip.com',
    logo: '/logos/wordpress-vip.svg',
    logoRatio: 71 / 32,
    logoScale: 1,
    tagline: 'WordPress for large organizations',
    haiku: ['The whole river leaps;', 'the great bear stands in the falls', 'and waits, unhurried'],
    sceneLabel: 'A bear catching salmon at the foot of a waterfall',
    scene: { kind: 'bear', hour: 10.8, seed: 37 },
  },
  {
    slug: 'jetpack',
    name: 'Jetpack',
    url: 'https://jetpack.com/',
    host: 'jetpack.com',
    logo: '/logos/jetpack.svg',
    logoRatio: 962 / 261,
    logoScale: 0.94,
    tagline: 'Security, performance and growth tools for WordPress sites',
    haiku: ['Wings too quick to see,', 'a hummingbird checks each bloom', 'and is gone again'],
    sceneLabel: 'A hummingbird darting between tall flowers',
    scene: { kind: 'hummingbird', hour: 12.6, seed: 41 },
  },
  {
    slug: 'akismet',
    name: 'Akismet',
    url: 'https://akismet.com/',
    host: 'akismet.com',
    logo: '/logos/akismet.svg',
    logoRatio: 203 / 44,
    logoScale: 0.98,
    tagline: "Spam protection for your site's comments and forms",
    haiku: ['The silk web holds fast,', 'gnats stay; the dew passes by,', 'sunlight on each strand'],
    sceneLabel: 'A spider web catching gnats while drops of dew slip through',
    scene: { kind: 'web', hour: 14.4, seed: 53 },
  },
  {
    slug: 'newspack',
    name: 'Newspack',
    url: 'https://newspack.com/',
    host: 'newspack.com',
    logo: '/logos/newspack.png',
    logoRatio: 948 / 192,
    logoScale: 0.96,
    tagline: 'A publishing platform for newsrooms, built on WordPress',
    haiku: ['From bloom to bloom, bees', 'carry word across the field', 'and the meadow wakes'],
    sceneLabel: 'Bees carrying pollen from flower to flower',
    scene: { kind: 'bees', hour: 16.2, seed: 67 },
  },
  {
    slug: 'gravatar',
    name: 'Gravatar',
    url: 'https://gravatar.com/',
    host: 'gravatar.com',
    logo: '/logos/gravatar.svg',
    logoRatio: 146 / 27,
    logoScale: 0.98,
    tagline: 'One profile and avatar that follow you across the web',
    haiku: ['In the dimming wood', 'each firefly keeps its own light,', 'known where it wanders'],
    sceneLabel: 'Fireflies glowing in the dimming wood',
    scene: { kind: 'fireflies', hour: 18.1, seed: 79 },
  },
];

/** The opening clearing: a deer grazing at sunrise. */
export const heroScene: Scene = { kind: 'meadow', hour: 6.25, seed: 3 };

/** The closing clearing: the same deer, at sunset. */
export const closeScene: Scene = { kind: 'meadow', hour: 19.25, seed: 3 };

/** Off the trail: a clearing the day never reaches, the deer grazing on after dark. */
export const lostScene: Scene = { kind: 'meadow', hour: 20, seed: 404 };

/** Where a visitor left from, reported to the product's analytics as utm_content. */
export type ReferralPath = 'wander' | 'stop' | 'wander-link' | 'wander-list' | 'colophon';

/** Tag an outbound link so the destination's logs credit ecosystem.maison. */
export function referral(url: string, path: ReferralPath): string {
  const u = new URL(url);
  u.searchParams.set('utm_source', 'ecosystem.maison');
  u.searchParams.set('utm_medium', 'referral');
  u.searchParams.set('utm_campaign', 'ecosystem');
  u.searchParams.set('utm_content', path);
  return u.toString();
}

/** Destinations the random jump can land on: every product with a scene. */
export const wanderTargets = products.map(({ name, url }) => ({ name, url }));

/** Random-jump destinations already tagged for a given path. */
export const trackedTargets = (path: ReferralPath) =>
  wanderTargets.map(({ name, url }) => ({ name, url: referral(url, path) }));
