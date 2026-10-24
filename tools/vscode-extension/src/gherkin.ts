interface ParsedStep {
  text: string;
  line: number;
}

export interface ParsedScenario {
  name: string;
  line: number;
  tags: string[];
  steps: ParsedStep[];
}

interface ParsedFeature {
  name: string;
  line: number;
  tags: string[];
  scenarios: ParsedScenario[];
}

const STEP = /^(Given|When|Then|And|But|\*)\s/;
const SCENARIO =
  /^(Scenario|Scenario Outline|Scenario Template|Example):\s*(.*)$/;

interface Outline extends ParsedScenario {
  exampleTags: string[];
  header?: string[];
}

const fill = (text: string, header: string[], row: string[]): string =>
  header.reduce(
    (result, name, index) => result.split(`<${name}>`).join(row[index] ?? ''),
    text,
  );

const cells = (line: string): string[] =>
  line
    .slice(1, line.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());

export function parseFeature(text: string): ParsedFeature | undefined {
  let feature: ParsedFeature | undefined;
  let background: ParsedStep[] = [];
  let current: ParsedStep[] | undefined;
  let outline: Outline | undefined;
  let tags: string[] = [];
  let docString = false;

  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    const number = index + 1;

    if (line.startsWith('"""') || line.startsWith('```')) {
      docString = !docString;
      continue;
    }
    if (docString || line === '' || line.startsWith('#')) {
      continue;
    }
    if (line.startsWith('@')) {
      tags.push(...line.split(/\s+/).filter((tag) => tag.startsWith('@')));
      continue;
    }

    const featureMatch = /^Feature:\s*(.*)$/.exec(line);
    if (featureMatch) {
      feature = { name: featureMatch[1], line: number, tags, scenarios: [] };
      tags = [];
      current = undefined;
      continue;
    }
    if (/^Background:/.test(line)) {
      background = [];
      current = background;
      tags = [];
      continue;
    }
    const scenarioMatch = SCENARIO.exec(line);
    if (scenarioMatch && feature) {
      const scenario: ParsedScenario = {
        name: scenarioMatch[2],
        line: number,
        tags: [...feature.tags, ...tags],
        steps: [...background],
      };
      if (/^Scenario (Outline|Template)$/.test(scenarioMatch[1])) {
        outline = { ...scenario, exampleTags: [] };
        current = outline.steps;
      } else {
        outline = undefined;
        feature.scenarios.push(scenario);
        current = scenario.steps;
      }
      tags = [];
      continue;
    }
    if (/^(Examples|Scenarios):/.test(line)) {
      if (outline) {
        outline.exampleTags = tags;
        outline.header = undefined;
      }
      current = undefined;
      tags = [];
      continue;
    }
    if (/^Rule:/.test(line)) {
      current = undefined;
      outline = undefined;
      tags = [];
      continue;
    }
    if (line.startsWith('|') && outline && feature && !current) {
      if (!outline.header) {
        outline.header = cells(line);
        continue;
      }
      const row = cells(line);
      const header = outline.header;
      feature.scenarios.push({
        name: fill(outline.name, header, row),
        line: number,
        tags: [...outline.tags, ...outline.exampleTags],
        steps: outline.steps.map((step) => ({
          text: fill(step.text, header, row),
          line: step.line,
        })),
      });
      continue;
    }
    if (current && STEP.test(line)) {
      current.push({ text: line, line: number });
    }
  }

  return feature;
}
