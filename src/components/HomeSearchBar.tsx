"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const QUICK_ACTIONS: Array<{ label: string; categorySlug?: string }> = [
  { label: "Nearby" },
  { label: "Restaurants", categorySlug: "restaurant" },
  { label: "Hotels", categorySlug: "hotel" },
  { label: "Tourist Attractions", categorySlug: "tourist-attraction" },
  { label: "Banks", categorySlug: "bank" },
];

export default function HomeSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/explore${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function onQuickAction(categorySlug?: string) {
    if (!categorySlug) {
      router.push("/explore");
      return;
    }
    router.push(`/explore?category=${categorySlug}`);
  }

  return (
    <div className="home-search">
      <form onSubmit={onSearch} className="home-search-form">
        <input
          type="text"
          placeholder="Search a place, or where you're headed"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="home-search-input"
        />
        <button type="submit" className="home-search-button">
          Search
        </button>
      </form>
      <div className="home-quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="home-quick-chip"
            onClick={() => onQuickAction(action.categorySlug)}
          >
            {action.label}
          </button>
        ))}
        <a href="/emergency" className="home-quick-chip home-quick-chip-emergency">
          Emergency
        </a>
      </div>
    </div>
  );
}
