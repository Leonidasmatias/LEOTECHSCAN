export function edgeId(source: string, relation: string, target: string) {
  return `${source}->${relation}->${target}`;
}
