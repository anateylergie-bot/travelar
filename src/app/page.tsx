import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import HeroCarousel from "@/components/HeroCarousel";
import HomeSearchBar from "@/components/HomeSearchBar";
import { HERO_IMAGES } from "@/lib/homepageImages";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-display" });

export default function HomePage() {
  return (
    <div className={spaceGrotesk.variable}>
      <section className="home-hero">
        <HeroCarousel images={HERO_IMAGES} />
        <div className="home-hero-content">
          <p className="home-eyebrow">Ghana · verified and continuously maintained</p>
          <h1 className="home-headline">
            Local knowledge,
            <br />
            verified before you need it.
          </h1>
          <p className="home-subhead">
            Every place here has been checked by someone who actually lives nearby — not just listed and forgotten.
          </p>
          <HomeSearchBar />
        </div>
      </section>

      <section className="home-band home-band-dark">
        <div className="home-band-photo home-band-photo-travelers" aria-hidden="true" />
        <div className="home-band-copy">
          <h2>Travel with a second opinion you can trust</h2>
          <p>
            Search by name, by city, or by what&apos;s nearby. Every result shows exactly how it was verified —
            field-checked by a local agent, confirmed by the business owner, or not yet checked at all. No result
            pretends to be more certain than it is.
          </p>
          <Link href="/explore" className="home-cta">
            Explore places
          </Link>
        </div>
      </section>

      <section className="home-band home-band-light">
        <div className="home-band-copy">
          <h2>Know your city? Get paid to keep it accurate.</h2>
          <p>
            Local Data Agents complete short, specific tasks — confirm a phone number, check if a place is still
            open, photograph a storefront — and earn real money for approved work. Training is required before
            higher-value tasks unlock, and you can always turn down a task that doesn&apos;t feel safe.
          </p>
          <Link href="/agent" className="home-cta home-cta-dark">
            Become a Local Data Agent
          </Link>
        </div>
        <div className="home-band-photo home-band-photo-agents" aria-hidden="true" />
      </section>

      <section className="home-band home-band-dark">
        <div className="home-band-photo home-band-photo-business" aria-hidden="true" />
        <div className="home-band-copy">
          <h2>Make sure travelers find you — accurately</h2>
          <p>
            Claim your listing once we can confirm you&apos;re the owner, then keep your hours, contact details, and
            description up to date yourself. Every change is reviewed before it goes live, so your listing stays
            trustworthy.
          </p>
          <Link href="/business" className="home-cta">
            Claim your business
          </Link>
        </div>
      </section>

      <section className="home-trust-strip">
        <div className="home-trust-item">
          <span className="home-trust-dot home-trust-dot-green">●</span>
          <span>Field or owner verified</span>
        </div>
        <div className="home-trust-item">
          <span className="home-trust-dot home-trust-dot-blue">●</span>
          <span>Digitally verified</span>
        </div>
        <div className="home-trust-item">
          <span className="home-trust-dot home-trust-dot-amber">●</span>
          <span>Needs an update</span>
        </div>
        <div className="home-trust-item">
          <span className="home-trust-dot home-trust-dot-grey">●</span>
          <span>Not yet verified</span>
        </div>
      </section>

      <footer className="home-footer">
        <p>
          <Link href="/login">Log in</Link> · <Link href="/register">Create an account</Link>
        </p>
        <p className="home-footer-fine">
          Local people help keep local information accurate — not every listing is checked yet, and we show you
          which is which.
        </p>
      </footer>
    </div>
  );
}

