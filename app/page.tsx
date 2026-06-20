import AnimatedGrid from "./components/AnimatedGrid";
import AnimatedCell from "./components/AnimatedCell";
import { SITE_LINKS } from "./siteLinks";

export default function Home() {
  const cells = [1, 2, 3, 4].map((n) => ({
    n,
    href: SITE_LINKS.grid[n - 1] ?? "#",
    svgSrc: `/hyperlinks/${n}.svg`,
  }));

  return (
    <AnimatedGrid>
      {cells.map(({ n, href, svgSrc }) => (
        <AnimatedCell key={n} n={n} href={href} svgSrc={svgSrc} />
      ))}
    </AnimatedGrid>
  );
}
