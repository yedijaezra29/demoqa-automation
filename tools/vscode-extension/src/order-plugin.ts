import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ORDER_FILE = join('reports', 'suite-run.json');

interface OrderedPickle {
  pickle: { uri: string };
  location: { line: number };
}

function orderPickles<T extends OrderedPickle>(
  pickles: readonly T[],
  order: readonly string[],
): T[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  const position = (item: T): number =>
    rank.get(`${item.pickle.uri.replace(/\\/g, '/')}:${item.location.line}`) ??
    order.length;

  return pickles
    .map((item, index) => ({ item, index, rank: position(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}

export default {
  type: 'plugin',
  coordinator: ({
    transform,
    environment,
  }: {
    transform: (
      event: 'pickles:order',
      handler: (pickles: readonly OrderedPickle[]) => Promise<OrderedPickle[]>,
    ) => void;
    environment: { cwd: string };
  }): void => {
    const { order } = JSON.parse(
      readFileSync(join(environment.cwd, ORDER_FILE), 'utf8'),
    ) as { order: string[] };
    transform('pickles:order', async (pickles) => orderPickles(pickles, order));
  },
};
