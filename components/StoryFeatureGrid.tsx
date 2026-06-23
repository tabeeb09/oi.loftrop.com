"use client";

import { useEffect, useMemo, useState } from "react";

type Story = {
  href: string;
  label: string;
  title: string;
  summary: string;
  heroImageUrl?: string;
  heroTone?: "light" | "dark" | "auto";
};

type Props = {
  stories: Story[];
};

function luminanceFromImageUrl(url: string) {
  return new Promise<number>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const width = 24;
        const height = 24;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas context unavailable."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        let total = 0;

        for (let index = 0; index < data.length; index += 4) {
          const red = data[index] / 255;
          const green = data[index + 1] / 255;
          const blue = data[index + 2] / 255;
          total += (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
        }

        resolve(total / (data.length / 4));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("Image load failed."));
    image.src = url;
  });
}

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
  const [tone, setTone] = useState<"light" | "dark">(
    story.heroTone === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    let cancelled = false;

    if (!imageUrl || (story.heroTone && story.heroTone !== "auto")) {
      setTone(story.heroTone === "dark" ? "dark" : "light");
      return undefined;
    }

    void luminanceFromImageUrl(imageUrl)
      .then((luminance) => {
        if (!cancelled) {
          setTone(luminance < 0.48 ? "dark" : "light");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTone("light");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, story.heroTone]);

  const style = useMemo(
    () =>
      imageUrl
        ? {
            backgroundImage:
              "linear-gradient(rgba(15, 18, 23, 0.24), rgba(15, 18, 23, 0.62)), url(" + imageUrl + ")",
          }
        : undefined,
    [imageUrl],
  );

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
        readLinkLabel="Open project"
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
