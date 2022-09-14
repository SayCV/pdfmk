import { path, Browser } from "./deps.ts";
import type { Config } from "./types.ts";

const printPDF = async (html: string, config: Config, browser: Browser) => {
  const f = path.parse(config.input);
  const tmpFileName: string = path.resolve(Deno.cwd(), path.join(f.dir, f.name + '.tmp.html'));
  await Deno.writeTextFile(tmpFileName, html);
  
  const page = await browser.newPage();

  // await page.setContent(html, {
  //   timeout: 0, waitUntil: "networkidle2",
  // });
  // https://pptr.dev/next/api/puppeteer.page.goforward#remarks
  await page.goto(tmpFileName, { 'timeout': 60000, waitUntil: 'networkidle0' });

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
    displayHeaderFooter: true,
    headerTemplate: config.headerTemplate,
    footerTemplate: config.footerTemplate,
  });

  await page.close();

  
const saveHtml = Deno.env.get("SAVE_HTML") == "true"
? true
:  false;

  const stat = await Deno.lstat(tmpFileName);
  if (stat.isFile && !saveHtml) {
    Deno.removeSync(tmpFileName);
  }
};

export default printPDF;
