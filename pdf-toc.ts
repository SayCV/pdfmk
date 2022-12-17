import {
  path, PDFMargin,
} from "./deps.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import type { Config, PaperFormat } from "./types.ts";
//import { TocEntry } from "./types.ts";
//import Buffer from "https://deno.land/x/buffer/mod.ts";
import { Buffer } from "https://deno.land/std@0.162.0/node/buffer.ts";
//import { default as handlebars } from "https://esm.sh/handlebars@4.7.7";
import { Handlebars, HandlebarsConfig, HandlebarsJS } from 'https://deno.land/x/handlebars/mod.ts';
import { splitAll, splitPdf } from "https://deno.land/x/pdfrex@v0.0.1/mod.ts";
import { createRequire } from "https://deno.land/std@0.103.0/node/module.ts";

import { defaults } from "https://deno.land/x/lodash_es@v0.0.2/mod.ts";
//import defaults from "npm:lodash.defaults@4";
import parsePdf from "npm:pdfjs-parse@1";
import { PDFDocument } from 'npm:pdf-lib@1';

/// @deno-types="https://cdn.jsdelivr.net/npm/@types/jsdom@16.2.11/index.d.ts"
//import { JSDOM } from "https://jspm.dev/npm:jsdom@20"
import jsdom from 'https://dev.jspm.io/npm:jsdom@20.0.0';
const { JSDOM } = jsdom as any;

import UID from 'npm:uid-safe@2';
import inlineCss from 'npm:inline-css@3';
import handlebars from 'npm:handlebars@4';

const PAGE_BREAK_MARKER = '\n------page-break------'


type TemplateType = string | undefined

export type PDFOrientation = 'landscape' | 'portrait'
export type TocEntry = {
  id: string
  title: string
  level: number
  href: string
  page?: number
}
export interface PdfTocOptions {
  orientation?: PDFOrientation
  format?: PaperFormat
  content: string
  context?: Record<string, unknown>
  header?: string
  footer?: string
  displayHeaderFooter?: boolean
  tocTemplate?: string
  tocContext: {
    _toc: TocEntry[]
  }
  margin?: PDFMargin
}

export function pdfTocOptionsFactory(options: PdfTocOptions): PdfTocOptions {
  if (!options.content || !options.content.length) {
    throw new Error('content should not be empty')
  }

  // if we follow the puppeteer 9.0.0 types we have to introduce a breaking
  // change where all the page formats are in lower case format
  // to avoid us to introduce this breaking change me need to make the page format lowercase our selves.
  options.format = (options.format || 'A4').toLocaleLowerCase() as PaperFormat

  return defaults(options, {
    content: '',
    footer: '',
    header: '',
    orientation: 'portrait',
    tocContext: { _toc: [] },
    margin: defaults(options.margin, {
      top: '1.9cm',
      bottom: '1.9cm',
      left: '1.9cm',
      right: '1.9cm',
    }),
  })
}

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

export const extractPDFToc = async (pdfBuffer: Buffer, options: PdfTocOptions): Promise<void> => {
  const data = await parsePdf(pdfBuffer, { pagerender: pageRender })
  data.text.split(PAGE_BREAK_MARKER).forEach((content: string, pageIndex: number) => {
    options.tocContext._toc.map((entry) => {
      if (content.includes(entry.id)) {
        entry.page = pageIndex + 1
      }
      return entry
    })
  })

  const document = new JSDOM(options.content).window.document
  const tocElement: HTMLElement | null = document.querySelector('.print-toc')
  document.querySelectorAll('.removeAfterTocExtraction').forEach((el: { parentNode: { removeChild: (arg0: any) => any; }; }) => el.parentNode?.removeChild(el))
  if (tocElement) {
    tocElement.innerHTML = handlebars.compile(options.tocTemplate || '')({
      ...options.context,
      ...options.tocContext,
    })
    options.tocTemplate = tocElement.outerHTML
  }
  options.content = document.documentElement.outerHTML
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

export function compileHeaderOrFooterTemplate(template: TemplateType, options: PdfTocOptions): string {
  // Currently the header and footer on chromium does not inherit the document styles.
  // This issue causes them to render with font-size: 0 and causes them to render on the edge of the page
  // has a dirty fix we will force it to be rendered with some sensible defaults and it can be override by setting an inner style.
  const printTemplate = `<div style="margin: 0 ${options.margin?.right} 0 ${options.margin?.left}; font-size: 8px">${template}</div>`
  const context = {
    ...options.context,
    options,
    date: '<span class="date"></span>',
    title: '<span class="title"></span>',
    url: '<span class="url"></span>',
    pageNumber: '<span class="pageNumber"></span>',
    totalPages: '<span class="totalPages"></span>',
  }
  return handlebars.compile(printTemplate)(context)
}

export function prepareToc(options: PdfTocOptions): void {
  const tocIgnoreClass = 'toc-ignore'
  const headingSelectors = 'h1, h2, h3, h4, h5, h6'
  const document = new JSDOM(options.content).window.document
  const tocElement: HTMLElement | null = document.querySelector('.print-toc')

  if (tocElement) {
    tocElement.style.pageBreakAfter = 'always'
    // Extract TOC template and include the default html head tag
    const tocDocument = new JSDOM(options.content).window.document
    const bodyEl = tocDocument.querySelector('body') as HTMLElement

    // Exclude headings inside toc template from the toc itself
    tocElement.querySelectorAll(headingSelectors).forEach((h) => h.classList.add(tocIgnoreClass))

    bodyEl.innerHTML = tocElement.outerHTML
    options.tocTemplate = tocDocument.documentElement.outerHTML

    document.querySelectorAll(headingSelectors).forEach((h: { classList: { contains: (arg0: string) => any; }; textContent: string; id: any; tagName: string; innerHTML: string; }) => {
      if (h.classList.contains(tocIgnoreClass)) return
      const title = h.textContent || ''
      if (title && title.trim().length) {
        const id = h.id || UID.sync(16)
        const level = Number.parseInt(h.tagName.substr(1))
        h.id = id
        h.innerHTML = `${title}<span class="removeAfterTocExtraction">${id}</span>`
        options.tocContext._toc.push({ id, title, level, href: `#${id}` })
      }
    })
  }
  options.content = document.documentElement.outerHTML
}

export async function enhanceContent(options: PdfTocOptions): Promise<void> {
  options.content = await inlineCss(options.content, {
    applyLinkTags: true,
    applyStyleTags: true,
    applyTableAttributes: true,
    applyWidthAttributes: true,
    extraCss: '',
    preserveMediaQueries: true,
    removeHtmlSelectors: true,
    removeLinkTags: true,
    removeStyleTags: true,
    url: ' ',
  })

  if (options.context) {
    options.content = handlebars.compile(options.content)({
      ...options.context,
      ...options.tocContext,
    })
  }

  options.displayHeaderFooter = !!(options.header || options.footer)
  if (options.displayHeaderFooter) {
    options.header = compileHeaderOrFooterTemplate(options.header, options)
    options.footer = compileHeaderOrFooterTemplate(options.footer, options)
  }

  prepareToc(options)
}

async function run_test() {
  console.log(run_test.name);

  const options = pdfTocOptionsFactory({
    content: `
      <div class="print-toc"></div>
      <h1 id="1">Page 1<span class="removeAfterTocExtraction">Page 1</span></h1>
      <h1 id="2">Page 2<span class="removeAfterTocExtraction">Page 2</span></h1>
      <h1 id="3">Page 3<span class="removeAfterTocExtraction">Page 3</span></h1>
    `,
    tocContext: {
      _toc: [
        { id: 'Page 1', title: 'Page 1', href: '', level: 1 },
        { id: 'Page 2', title: 'Page 2', href: '', level: 1 },
        { id: 'Page 3', title: 'Page 3', href: '', level: 1 },
      ],
    },
  })

  const read_data = Deno.readFileSync(path.resolve(Deno.cwd(), '../pdf-generator-service/src/util/__test__/sample.pdf'));
  const pdfBuffer = Buffer.from(read_data);
  console.log(pdfBuffer);

  await extractPDFToc(pdfBuffer, options);
  console.log(options.content);
}

if (import.meta.main) {
  run_test();
}
