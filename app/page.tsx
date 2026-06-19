import { readFile } from "node:fs/promises";
import path from "node:path";
import AnimatedGrid from "./components/AnimatedGrid";
import AnimatedCell from "./components/AnimatedCell";

function parseLinksFile(fileContents: string): string[] {
  return fileContents
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\.\s*/, "").trim());
}

export default async function Home() {
  const linksPath = path.join(
    process.cwd(),
    "public",
    "hyperlinks",
    "links.txt",
  );

  const linksTxt = await readFile(linksPath, "utf8");
  const links = parseLinksFile(linksTxt);

  const cells = [1, 2, 3, 4].map((n) => ({
    n,
    href: links[n - 1] ?? "#",
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
