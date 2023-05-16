import {
  Browser,
  path,
  i18next,
  substitute,
  rehypeAutolinkHeadings,
  rehypeDocument,
  rehypeKatex,
  rehypePrism,
  //rehypeShiki,
  rehypeSlug,
  rehypeStringify,
  remarkGemoji,
  remarkGfm,
  remarkJaruby,
  remarkMath,
  remarkParse,
  remarkRehype,
  rehypeRaw,
  remarkToc,
  //shiki,
  unified,
} from "./deps.ts";
import { default as remarkAutoNumber } from "./remark-autonumber.ts";
import { default as remarkMermaid } from "./mermaid.ts";
import { isBaseTheme } from "./types.ts";
import type { Config } from "./types.ts";
import { defaultStyle } from "./styles.ts";

async function getDefaultFootnoteLabel() {
  // en-US
  const systemLocale = await Intl.DateTimeFormat().resolvedOptions().locale;
  const is_zh = systemLocale && systemLocale.startsWith("zh") ? true : false;
  return is_zh ? '注释:' : 'Footnotes';
}

async function preprocessStyleCssFile(config: Config) {
  let style_string = ''
  if (config.style) {
    const style_file = path.resolve(Deno.cwd(), config.style)
    style_string = await Deno.readTextFile(style_file);
    style_string = substitute(style_string, Deno.env.get);
  }
  return config.style ? style_string : defaultStyle;
}

const parse = async (md: string, config: Config, browser: Browser) => {
  // cdn resolution: there are two repos providing prism themes
  const themeFileURL = config.prismTheme === "default"
    ? `https://cdn.skypack.dev/prismjs/themes/prism.css`
    : isBaseTheme(config.prismTheme)
      ? `https://cdn.skypack.dev/prismjs/themes/${config.prismTheme}.css`
      : `https://cdn.skypack.dev/prism-themes/themes/prism-${config.prismTheme}.css`;

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkGemoji)
    .use(remarkMath)
    .use(remarkJaruby)
    .use(remarkToc, {
      heading: config.tocHeading,
      tight: true,
    })
    .use(remarkAutoNumber, {
      enable: config.numberSections,
      level: config.shiftHeadingLevelBy,
    })
    .use(remarkMermaid, {
      browser: browser,
      launchOptions: {
        executablePath: config.chromePath,
      },
      wrap: true,
      theme: config.mermaidTheme,
      classname: ["mermaid"],
      svgo: null as any,
    })
    .use(remarkRehype, {
      allowDangerousHtml: true,
      footnoteLabel: await getDefaultFootnoteLabel(),
      //footnoteBackLabel: '返回',
    })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypePrism)
    //.use(rehypeShiki, {
    //  highlighter: await shiki.getHighlighter({ theme: "nord" }),
    //})
    .use(rehypeDocument, {
      // since <link rel...> section is inserted before <style> section,
      // we can override default styles with given css in this way.
      link: [
        {
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/katex@0.16.7/dist/katex.min.css",
          type: "text/css",
        },
        {
          rel: "stylesheet",
          href: themeFileURL,
          type: "text/css",
        },
      ],
      style: await preprocessStyleCssFile(config),
    })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings)
    .use(rehypeStringify)
    .freeze();

  const html = (await processor.process(md)).toString();

  return html;
};

export default parse;
