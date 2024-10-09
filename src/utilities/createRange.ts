const createRandomId = () => Math.round(Math.random() * 1000000).toString();

export interface Item {
  id: string;
  name: string;
}

export function createItems(length: number): Item[] {
  return [...new Array(length)].map(() => {
    const id = createRandomId();
    return {
      id,
      name: `Item ${id}`,
    };
  });
}
