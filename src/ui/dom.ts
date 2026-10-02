/** Small DOM helpers. Missing elements are a bug in index.html, so they throw early. */

export function byId<T extends HTMLElement>(
  id: string,
  type: abstract new (...args: never[]) => T,
  root: Document = document,
): T {
  const element = root.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing #${id} (${type.name})`);
  return element;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
