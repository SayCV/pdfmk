import {
  Node,
  Plugin,
  Transformer,
  VFileCompatible,
  visit,
} from "./deps.ts";

export interface RemarkAutoNumberOptions {
  /**
   * The Mermaid theme to use.
   *
   * @default '-1'
   */
  level?: number;

  /**
   * Whether to wrap svg with <div> element.
   *
   * @default "false"
   */
  enable?: boolean;
}

const remarkAutoNumber: Plugin<[RemarkAutoNumberOptions?]> = function AutoNumberTrans(
  options,
): Transformer {
  const DEFAULT_SETTINGS = {
    level: -1,
    enable: false,
  };

  const settings = Object.assign(
    DEFAULT_SETTINGS,
    options,
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // deno-lint-ignore require-await
  return async (ast: Node, _file: VFileCompatible) => {

    if (!settings.enable)
      return;

    let heading_nums = [0, 0, 0, 0, 0, 0];
    visit(ast, 'heading', (node: Node) => {
      if (node.children.length > 0) {
        heading_nums[node.depth + settings.level - 1]++;
        for (let i = node.depth + settings.level; i < heading_nums.length; i++) {
          heading_nums[i] = 0;
        }
        node.children.unshift({
          type: 'text',
          value: `${heading_nums.slice(0, node.depth + settings.level).join('.')} `,
        });
      }
    });
  };
};

export default remarkAutoNumber;
