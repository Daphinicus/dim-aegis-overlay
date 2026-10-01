/** Classify an Aegis argument by the control that edits it. */
export function aegisFilterTarget(argument: string): string {
  const value = argument.toLowerCase();
  if (/^(p|perk):/.test(value) || value === 'god') return 'perk';
  if (/^(w|weapon):/.test(value)) return 'weapon';
  if (/^(s|source):/.test(value)) return 'source';
  const armor = value.replace(/^(a|armor):/, '');
  if (/^(2p|2piece):/.test(armor)) return 'armor2p';
  if (/^(4p|4piece):/.test(armor)) return 'armor4p';
  if (/^(a|armor):/.test(value)) return 'armor';
  if (/^(shopping|shop|priority)(:|$)/.test(value)) return 'shopping';
  if (['5/5', 'perfect', '5of5', 'godroll'].includes(value)) return 'perfect';
  if (['omni', 'master', 'allperks'].includes(value)) return 'omni';
  if (['upgrade', 'upgradeable', 'upgradable'].includes(value)) return 'upgrade';
  if (['bis', 'bestinclass'].includes(value)) return 'bis';
  return value.split(':')[0];
}

type Node = { op: 'term'; text: string } | { op: 'not'; child: Node } |
  { op: 'and' | 'or'; children: Node[] };

function target(text: string): string | undefined {
  if (!/^aegis:/i.test(text)) return;
  let argument = text.slice(6);
  if (/^["']/.test(argument)) argument = argument.slice(1, -1).replace(/\\(["'\\])/g, '$1');
  return aegisFilterTarget(argument);
}

/** Edit filter terms without interpreting native DIM filter values. */
export function updateAegisQuery(current: string, addition: string): string {
  current = current.trim(); addition = addition.trim();
  if (!current) return addition;
  const wanted = target(addition);
  if (!wanted) return current;
  try {
    // Leave smart quotes untouched rather than risk changing their
    // interpretation. DIM remains the authority for validating the final query.
    if (/[“”‘’]/.test(current)) throw Error('Unsupported editing syntax');
    const tokens: string[] = [];
    const comments: string[] = [];
    for (let i = 0; i < current.length;) {
      if (/\s/.test(current[i])) { i++; continue; }
      if (current.startsWith('/*', i)) {
        const end = current.indexOf('*/', i + 2);
        if (end < 0) throw Error('Unclosed comment');
        comments.push(current.slice(i, end + 2)); i = end + 2; continue;
      }
      if ('()-'.includes(current[i])) { tokens.push(current[i++]); continue; }
      const start = i;
      while (i < current.length && !/[\s()]/.test(current[i])) {
        if ((current[i] === '"' || current[i] === "'") && (i === start || current[i - 1] === ':')) {
          const quote = current[i++];
          while (i < current.length && current[i] !== quote) { if (current[i] === '\\') i++; i++; }
          if (current[i] !== quote) throw Error('Unclosed quote');
        }
        i++;
      }
      tokens.push(current.slice(start, i));
    }
    let index = 0;
    const lower = () => tokens[index]?.toLowerCase();
    function atom(depth: number): Node {
      if (depth > 100) throw Error('Excessive nesting');
      const token = tokens[index++];
      if (!token || /^(and|or|\))$/i.test(token)) throw Error('Missing operand');
      if (token === '-' || token.toLowerCase() === 'not') return { op: 'not', child: atom(depth + 1) };
      if (token === '(') {
        const node = expression(1, depth + 1);
        if (tokens[index++] !== ')') throw Error('Unclosed group');
        return node;
      }
      return { op: 'term', text: token };
    }
    function expression(minimum: number, depth: number): Node {
      let left = atom(depth);
      while (index < tokens.length && tokens[index] !== ')') {
        const operator = lower();
        // DIM gives implicit AND lower precedence than OR and explicit AND.
        const precedence = operator === 'and' ? 3 : operator === 'or' ? 2 : 1;
        if (precedence < minimum) break;
        if (precedence > 1) index++;
        const right = expression(precedence + 1, depth + 1);
        left = { op: operator === 'or' ? 'or' : 'and', children: [left, right] };
      }
      return left;
    }
    let root = expression(1, 0);
    if (index !== tokens.length) throw Error('Unexpected group');
    let replaced = false;
    function edit(node: Node): Node {
      if (node.op === 'term') {
        if (target(node.text) !== wanted) return node;
        replaced = true;
        return { op: 'term', text: addition };
      }
      // A replacement is the selected positive criterion, including when the
      // previous criterion was negated. Negated groups retain their structure.
      if (node.op === 'not') {
        if (node.child.op === 'term' && target(node.child.text) === wanted) return edit(node.child);
        return { op: 'not', child: edit(node.child) };
      }
      return { ...node, children: node.children.map(edit) };
    }
    root = edit(root);
    if (!replaced) root = { op: 'and', children: [root, { op: 'term', text: addition }] };
    function render(node: Node): string {
      if (node.op === 'term') return node.text;
      if (node.op === 'not') return `-(${render(node.child)})`;
      const children: Node[] = [];
      const flatten = (child: Node) => {
        if (child.op === node.op) child.children.forEach(flatten); else children.push(child);
      };
      node.children.forEach(flatten);
      const terms = [...new Set(children.map(child => {
        const text = render(child);
        return child.op === 'and' || child.op === 'or' ? `(${text})` : text;
      }))];
      return terms.join(node.op === 'and' ? ' ' : ' or ');
    }
    return [...comments, render(root)].join(' ');
  } catch {
    // Preserve incomplete manual edits; never drop input to make a query valid.
    return `(${current}) ${addition}`;
  }
}
