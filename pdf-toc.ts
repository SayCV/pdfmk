import {
  path,
} from "./deps.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import type { Config, PaperFormat } from "./types.ts";
import { TocEntry } from "./types.ts";
//import Buffer from "https://deno.land/x/buffer/mod.ts";
import { Buffer } from "https://deno.land/std@0.162.0/node/buffer.ts";
//import { default as handlebars } from "https://esm.sh/handlebars@4.7.7";
import { Handlebars, HandlebarsConfig, HandlebarsJS } from 'https://deno.land/x/handlebars/mod.ts';
import { splitAll, splitPdf } from "https://deno.land/x/pdfrex@v0.0.1/mod.ts";
import { createRequire } from "https://deno.land/std@0.103.0/node/module.ts";

import parsePdf from "npm:pdfjs-parse@1";
import { PDFDocument } from 'npm:pdf-lib@1';
// @deno-types=npm:jsdom@19/index.d.ts"
import JSDOM from 'npm:jsdom@19';
import UID from 'npm:uid-safe@2';
import inlineCss from 'npm:inline-css@3';
import handlebars from 'npm:handlebars@4';

const PAGE_BREAK_MARKER = '\n------page-break------'

function pageRender(pageData: any) {
  // check documents https://mozilla.github.io/pdf.js/
  const renderOptions = {
    // replaces all occurrences of whitespace with standard spaces (0x20). The default value is `false`.
    normalizeWhitespace: false,
    // do not attempt to combine same line TextItem's. The default value is `false`.
    disableCombineTextItems: false,
  }

  return pageData.getTextContent(renderOptions).then((textContent: any) => {
    let lastY: any,
      text = ''
    for (const item of textContent.items) {
      if (!lastY || lastY == item.transform[5]) {
        text += item.str
      } else {
        text += '\n' + item.str
      }
      lastY = item.transform[5]
    }
    return text + PAGE_BREAK_MARKER
  })
}

export function prepareToc(options: Config,
  content: string,
  tocContext: { _toc: TocEntry[] },
  context?: Record<string, unknown>,
  tocTemplate?: string): void {
  const tocIgnoreClass = 'toc-ignore'
  const headingSelectors = 'h1, h2, h3, h4, h5, h6'
  const document = new JSDOM(content).window.document
  const tocElement: HTMLElement | null = document.querySelector('.print-toc');

  if (tocElement) {
    tocElement.style.pageBreakAfter = 'always'
    // Extract TOC template and include the default html head tag
    const tocDocument = new JSDOM(content).window.document
    const bodyEl = tocDocument.querySelector('body') as HTMLElement

    // Exclude headings inside toc template from the toc itself
    tocElement.querySelectorAll(headingSelectors).forEach((h: { classList: { add: (arg0: string) => any; }; }) => h?.classList.add(tocIgnoreClass))

    bodyEl.innerHTML = tocElement.outerHTML
    tocTemplate = tocDocument.documentElement?.outerHTML || ''

    document.querySelectorAll(headingSelectors).forEach((h: { classList: { contains: (arg0: string) => any; }; textContent: string; id: any; tagName: string; innerHTML: string; }) => {
      if (h.classList.contains(tocIgnoreClass)) return
      const title = h.textContent || ''
      if (title && title.trim().length) {
        const id = h.id || UID.sync(16)
        const level = Number.parseInt(h.tagName.substr(1))
        h.id = id
        h.innerHTML = `${title}<span class="removeAfterTocExtraction">${id}</span>`
        tocContext._toc.push({ id, title, level, href: `#${id}` })
      }
    })
  }
  content = document.documentElement?.outerHTML || ''
}

export const extractPDFToc = async (pdfBuffer: Buffer, options: Config,
  content: string,
  tocContext: { _toc: TocEntry[] },
  context?: Record<string, unknown>,
  tocTemplate?: string): Promise<void> => {
    const data = await parsePdf(pdfBuffer, { pagerender: pageRender })
    data.text.split(PAGE_BREAK_MARKER).forEach((content: string, pageIndex: number) => {
      tocContext._toc.map((entry) => {
        if (content.includes(entry.id)) {
          entry.page = pageIndex + 1
        }
        return entry
      })
    })

    const document = new JSDOM(content).window.document
    const tocElement: HTMLElement | null = document.querySelector('.print-toc')
    document.querySelectorAll('.removeAfterTocExtraction').forEach((el: { parentNode: { removeChild: (arg0: any) => any; }; }) => el.parentNode?.removeChild(el))
    if (tocElement) {
      tocElement.innerHTML = handlebars.compile(tocTemplate || '')({
        ...context,
        ...tocContext,
      })
      tocTemplate = tocElement.outerHTML
    }
    content = document.documentElement.outerHTML
  }

export async function mergePDFs(document: Buffer, toc: Buffer): Promise<Buffer> {
  const docuPDF = await PDFDocument.load(document)
  const tocPDF = await PDFDocument.load(toc)
  const indices = tocPDF.getPages().map((page: any, index: any) => {
    docuPDF.removePage(0)
    return index
  })

  const pages = await docuPDF.copyPages(tocPDF, indices)
  pages.forEach((page: any, index: any) => docuPDF.insertPage(index, page))
  const data = await docuPDF.save()
  return Buffer.from(data)
}

async function run_test() {
  console.log(run_test.name);

  const options: Config = {
    input: '',
    output: '',
    style: '',
    tocHeading: '',
    format: 'A4' as PaperFormat,
    scale: 1,
    hMargin: '',
    vMargin: '',
    prismTheme: 'default',
    mermaidTheme: 'default',
    svgo: false,
    numberSections: false,
    shiftHeadingLevelBy: -1,
    displayHeaderFooter: false,
    headerTemplate: '',
    footerTemplate: '',
    chromePath: '',
    savePng: false,
    saveHtml: false,
  };

  const read_data = Deno.readFileSync(path.resolve(Deno.cwd(), '../pdf-generator-service/src/util/__test__/sample.pdf'));
  const pdfBuffer = Buffer.from(read_data);
  console.log(pdfBuffer);

  const content = '';
  const tocContext = { _toc: [] };
  const context = { name: 'PDF Express' };
  const tocTemplate = '';
  await extractPDFToc(pdfBuffer, options, content, tocContext, context, tocTemplate);
  console.log(content);
}

if (import.meta.main) {
  run_test();
}
