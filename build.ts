import { format } from "./deps.ts";
import * as path from "https://deno.land/std@0.207.0/path/mod.ts";

const __filename = path.fromFileUrl(import.meta.url);
const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const now = new Date();

export async function getGitRevCount() {
  const gitRevCountProcess = Deno.run({
    cmd: ["git", "rev-list", "--count", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });
  const gitRevCountOutput = await gitRevCountProcess.output(); // "piped" must be set
  const gitRevCount = new TextDecoder().decode(gitRevCountOutput).trim();
  gitRevCountProcess.stderr.close();
  gitRevCountProcess.close();

  return gitRevCount;
}

export async function getGitRevParse() {
  const gitRevParseProcess = Deno.run({
    cmd: ["git", "rev-parse", "--short", "HEAD"],
    stdout: "piped",
    stderr: "piped",
  });
  const gitRevParseOutput = await gitRevParseProcess.output(); // "piped" must be set
  const gitRevParse = new TextDecoder().decode(gitRevParseOutput).trim();
  gitRevParseProcess.stderr.close();
  gitRevParseProcess.close();

  return gitRevParse;
}

export async function getBuiltDate() {
  return format(now, "yyyy-MM-dd HH:mm:ss");
}

async function main() {
  const version_ts = `${__dirname}/build.gen.ts`;
  console.log(`Generating ${version_ts}`);
  const buildDate = await getBuiltDate().then(
    (value) => { return value },
    (_) => { return "err" },
  );
  const gitRevCount = await getGitRevCount().then(
    (value) => { return value },
    (_) => { return "err" },
  );
  const gitRevParse = await getGitRevParse().then(
    (value) => { return value },
    (_) => { return "err" },
  );
  console.log(`buildDate = ${buildDate}`);
  console.log(`gitRevCount = ${gitRevCount}`);
  console.log(`gitRevParse = ${gitRevParse}`);
  const content = `
export const buildDate = "${buildDate}";
export const gitRevCount = "${gitRevCount}";
export const gitRevParse = "${gitRevParse}";
`;
  await Deno.writeTextFile(version_ts, content);
}

if (import.meta.main) {
  Deno.chdir(__dirname);
  main();
}
