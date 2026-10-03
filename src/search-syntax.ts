export interface SearchToken {
  kind: 'term' | 'operator' | 'paren' | 'space' | 'comment';
  text: string;
  start: number;
  end: number;
  complete: boolean;
}

/** Preserve query bytes, including quoted values, while identifying display spans. */
export function tokenizeSearch(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  for (let i = 0; i < query.length;) {
    const start = i;
    let kind: SearchToken['kind'] = 'term', complete = true;
    if (/\s/.test(query[i])) {
      kind = 'space'; while (i < query.length && /\s/.test(query[i])) i++;
    } else if (query.startsWith('/*', i)) {
      kind = 'comment'; const close = query.indexOf('*/', i + 2);
      complete = close >= 0; i = complete ? close + 2 : query.length;
    } else if ('()'.includes(query[i])) { kind = 'paren'; i++; }
    else if (query[i] === '-') { kind = 'operator'; i++; }
    else {
      while (i < query.length && !/[\s()]/.test(query[i])) {
        if ((query[i] === '"' || query[i] === "'") && (i === start || query[i - 1] === ':')) {
          const quote = query[i++];
          while (i < query.length && query[i] !== quote) { if (query[i] === '\\') i++; i++; }
          if (query[i] !== quote) { complete = false; i = query.length; break; }
        }
        i++;
      }
      if (/^(and|or|not)$/i.test(query.slice(start, i))) kind = 'operator';
    }
    tokens.push({ kind, text: query.slice(start, i), start, end: i, complete });
  }
  return tokens;
}

export type SearchNode = { op: 'term'; text: string; start: number } |
  { op: 'not'; child: SearchNode } | { op: 'and' | 'or'; children: SearchNode[] };

export function parseSearchStructure(query: string): { root: SearchNode; comments: string[] } {
  if (/[“”‘’]/.test(query)) throw Error('Unsupported editing syntax');
  const all = tokenizeSearch(query);
  if (all.some(token => !token.complete)) throw Error('Incomplete query');
  const comments = all.filter(token => token.kind === 'comment').map(token => token.text);
  const tokens = all.filter(token => token.kind !== 'space' && token.kind !== 'comment');
  let index = 0;
  function atom(depth: number): SearchNode {
    if (depth > 100) throw Error('Excessive nesting');
    const token = tokens[index++];
    if (!token || /^(and|or|\))$/i.test(token.text)) throw Error('Missing operand');
    if (token.text === '-' || token.text.toLowerCase() === 'not') return { op: 'not', child: atom(depth + 1) };
    if (token.text === '(') {
      const node = expression(1, depth + 1);
      if (tokens[index++]?.text !== ')') throw Error('Unclosed group');
      return node;
    }
    return { op: 'term', text: token.text, start: token.start };
  }
  function expression(minimum: number, depth: number): SearchNode {
    let left = atom(depth);
    while (index < tokens.length && tokens[index].text !== ')') {
      const operator = tokens[index].text.toLowerCase();
      // DIM: implicit AND < OR < explicit AND.
      const precedence = operator === 'and' ? 3 : operator === 'or' ? 2 : 1;
      if (precedence < minimum) break;
      if (precedence > 1) index++;
      const right = expression(precedence + 1, depth + 1);
      left = { op: operator === 'or' ? 'or' : 'and', children: [left, right] };
    }
    return left;
  }
  const root = expression(1, 0);
  if (index !== tokens.length) throw Error('Unexpected group');
  return { root, comments };
}

export function renderSearchStructure(node: SearchNode): string {
  if (node.op === 'term') return node.text;
  if (node.op === 'not') return `-(${renderSearchStructure(node.child)})`;
  const children: SearchNode[] = [];
  const flatten = (child: SearchNode) => {
    if (child.op === node.op) child.children.forEach(flatten); else children.push(child);
  };
  node.children.forEach(flatten);
  const terms = [...new Set(children.map(child => {
    const text = renderSearchStructure(child);
    return child.op === 'and' || child.op === 'or' ? `(${text})` : text;
  }))];
  return terms.join(node.op === 'and' ? ' ' : ' or ');
}

/** Remove one occurrence and its now-unneeded operator/group, not every alias. */
export function removeSearchTerm(query: string, start: number): string {
  const token = tokenizeSearch(query).find(token => token.start === start && token.kind === 'term');
  if (!token) return query;
  try {
    const { root, comments } = parseSearchStructure(query);
    const remove = (node: SearchNode): SearchNode | null => {
      if (node.op === 'term') return node.start === start ? null : node;
      if (node.op === 'not') {
        const child = remove(node.child); return child ? { op: 'not', child } : null;
      }
      const children = node.children.map(remove).filter((child): child is SearchNode => child !== null);
      return !children.length ? null : children.length === 1 ? children[0] : { ...node, children };
    };
    const remaining = remove(root);
    return remaining ? [...comments, renderSearchStructure(remaining)].join(' ') : '';
  } catch {
    // Keep incomplete surrounding text available for the user to finish editing.
    return query.slice(0, token.start) + query.slice(token.end);
  }
}
