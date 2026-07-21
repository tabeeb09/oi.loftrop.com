"use client";

import { useMemo } from "react";

type Story = {
  href: string;
  label: string;
  title: string;
  summary: string;
  heroImageUrl?: string;
  heroImagePosition?: string;
  heroImageSize?: string;
  heroTone?: "light" | "dark" | "auto";
};

type Props = {
  stories: Story[];
};

function StoryCard({
  story,
  className,
  readLinkLabel,
}: {
  story: Story;
  className: string;
  readLinkLabel?: string;
}) {
  const imageUrl = story.heroImageUrl ?? null;

  const style = useMemo(
    () =>
      imageUrl
        ? {
            backgroundImage:
              "linear-gradient(rgba(15, 18, 23, 0.24), rgba(15, 18, 23, 0.62)), url(" + imageUrl + ")",
            backgroundPosition: story.heroImagePosition,
            backgroundSize: story.heroImageSize,
          }
        : undefined,
    [imageUrl, story.heroImagePosition, story.heroImageSize],
  );

  const tone = imageUrl
    ? story.heroTone === "light"
      ? "light"
      : "dark"
    : "light";

  return (
    <article
      className={`${className}${imageUrl ? ` ${className}--image ${className}--${tone}` : ""}`}
      style={style}
      data-tone={tone}
    >
      <p className="eyebrow">{story.label}</p>
      <h2>
        <a href={story.href}>{story.title}</a>
      </h2>
      <p>{story.summary}</p>
      {readLinkLabel ? (
        <a className="read-link" href={story.href}>
          {readLinkLabel}
        </a>
      ) : null}
    </article>
  );
}

export default function StoryFeatureGrid({ stories }: Props) {
  const [leadStory, ...secondaryStories] = stories;

  if (!leadStory) {
    return null;
  }

  return (
    <section className="home-grid" aria-label="Featured portfolio work">
      <StoryCard
        story={leadStory}
        className="lead-card"
        readLinkLabel="Research"
      />

      <div className="story-stack">
        {secondaryStories.map((story) => (
          <StoryCard
            key={story.href}
            story={story}
            className="story-card"
          />
        ))}
      </div>
    </section>
  );
}
