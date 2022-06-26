import { path, Browser } from "./deps.ts";
import type { Config } from "./types.ts";
import { existsSync } from "https://deno.land/std/fs/mod.ts";

const printPDF = async (html: string, config: Config, browser: Browser) => {
  const f = path.parse(config.output);
  const tmpFileName: string = path.resolve(Deno.cwd(), path.join(f.dir, f.name + '.tmp.html'));
  await Deno.writeTextFile(tmpFileName, html);
  
  const page = await browser.newPage();

  // await page.setContent(html, {
  //   waitUntil: "networkidle2",
  // });
  await page.goto(tmpFileName, { waitUntil: 'networkidle0' });

  await page.pdf({
    printBackground: true,
    path: config.output,
    margin: {
      top: config.margin,
      right: config.margin,
      bottom: config.margin,
      left: config.margin,
    },
    format: config.format,
    scale: config.scale,
  });

  await page.close();

  if (existsSync(tmpFileName)) {
    Deno.removeSync(tmpFileName);
  }
};

export default printPDF;
