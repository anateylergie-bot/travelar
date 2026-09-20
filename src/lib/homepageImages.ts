// Homepage hero carousel content. Add real photo files to
// public/images/hero/ (see the README there for sourcing guidance), then
// list them here. The carousel gracefully shows just the gradient
// background with no broken-image icons if a listed file doesn't exist
// yet — this array is safe to edit incrementally as photos are added.
//
// Keep captions honest and specific (a real place/experience), not vague
// stock-photo filler — spec-wide principle of this project applying to
// marketing copy too.

export interface HeroImage {
  src: string;
  alt: string;
  caption: string;
}

export const HERO_IMAGES: HeroImage[] = [
  {
    src: "/images/hero/kakum-canopy-walk.jpg",
    alt: "Rope canopy walkway suspended above the rainforest at Kakum National Park",
    caption: "Kakum National Park — Central Region",
  },
  {
    src: "/images/hero/cape-coast-castle.jpg",
    alt: "Cape Coast Castle on the Atlantic coastline",
    caption: "Cape Coast Castle — Cape Coast",
  },
  {
    src: "/images/hero/kejetia-market.jpg",
    alt: "The bustling Kejetia Market in central Kumasi",
    caption: "Kejetia Market — Kumasi",
  },
  {
    src: "/images/hero/kente-weaving.jpg",
    alt: "A weaver working on traditional Kente cloth",
    caption: "Kente weaving — Ashanti Region",
  },
  {
    src: "/images/hero/accra-skyline.jpg",
    alt: "The Accra skyline at golden hour",
    caption: "Accra — Greater Accra Region",
  },
];
