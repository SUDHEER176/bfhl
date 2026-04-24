const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const CREDENTIALS = {
  user_id:             'shanmukasatya_vamsamsetti_17042006',
  email_id:            'shanmukasatya_vamsamsetti@srmap.edu.in',
  college_roll_number: 'AP23110010005',
};

function scrubInput(rawList) {
  const edgeShape = /^([A-Z])->([A-Z])$/;
  const registry  = new Set();
  const kept      = [];
  const junk      = [];
  const repeat    = [];

  for (const entry of rawList) {
    const clean = String(entry ?? '').trim();
    const match = clean.match(edgeShape);

    if (!match || match[1] === match[2]) {
      junk.push(clean);
      continue;
    }

    if (registry.has(clean)) {
      if (!repeat.includes(clean)) repeat.push(clean);
      continue;
    }

    registry.add(clean);
    kept.push({ from: match[1], to: match[2] });
  }

  return { kept, junk, repeat };
}

function buildKinship(edges) {
  const offspring = new Map();
  const guardian  = new Map();
  const everyone  = new Set();

  for (const { from, to } of edges) {
    everyone.add(from);
    everyone.add(to);

    if (guardian.has(to)) continue;

    guardian.set(to, from);
    if (!offspring.has(from)) offspring.set(from, new Set());
    offspring.get(from).add(to);
  }

  return { offspring, guardian, everyone };
}

function findClans(everyone, offspring) {
  const neighbours = new Map();
  for (const n of everyone) neighbours.set(n, new Set());

  for (const [parent, kids] of offspring) {
    for (const kid of kids) {
      neighbours.get(parent).add(kid);
      neighbours.get(kid).add(parent);
    }
  }

  const stamped = new Set();
  const clans   = [];

  for (const start of everyone) {
    if (stamped.has(start)) continue;

    const clan  = new Set();
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      if (stamped.has(n)) continue;
      stamped.add(n);
      clan.add(n);
      for (const nb of neighbours.get(n)) queue.push(nb);
    }
    clans.push(clan);
  }

  return clans;
}

function clanHasCycle(clan, offspring) {
  const inDegree = new Map();
  for (const n of clan) inDegree.set(n, 0);

  for (const n of clan) {
    for (const kid of (offspring.get(n) ?? [])) {
      if (clan.has(kid)) inDegree.set(kid, inDegree.get(kid) + 1);
    }
  }

  const frontier = [...clan].filter(n => inDegree.get(n) === 0);
  let peeled = 0;

  while (frontier.length) {
    const n = frontier.shift();
    peeled++;
    for (const kid of (offspring.get(n) ?? [])) {
      if (!clan.has(kid)) continue;
      inDegree.set(kid, inDegree.get(kid) - 1);
      if (inDegree.get(kid) === 0) frontier.push(kid);
    }
  }

  return peeled < clan.size;
}

function sculpt(node, offspring) {
  const shape = {};
  for (const kid of (offspring.get(node) ?? [])) {
    shape[kid] = sculpt(kid, offspring);
  }
  return shape;
}

function chainLength(node, offspring) {
  const kids = [...(offspring.get(node) ?? [])];
  if (!kids.length) return 1;
  return 1 + Math.max(...kids.map(k => chainLength(k, offspring)));
}

function assembleClan(clan, offspring, guardian) {
  if (clanHasCycle(clan, offspring)) {
    const anchor = [...clan].sort()[0];
    return [{ root: anchor, tree: {}, has_cycle: true }];
  }

  const anchors = [...clan].filter(n => !guardian.has(n)).sort();

  if (!anchors.length) {
    const anchor = [...clan].sort()[0];
    return [{ root: anchor, tree: {}, has_cycle: true }];
  }

  return anchors.map(root => ({
    root,
    tree:  { [root]: sculpt(root, offspring) },
    depth: chainLength(root, offspring),
  }));
}

function calcSummary(hierarchies) {
  const plainTrees   = hierarchies.filter(h => !h.has_cycle);
  const cyclicGroups = hierarchies.filter(h =>  h.has_cycle);

  const tallest = plainTrees.reduce((winner, h) => {
    if (!winner)                                           return h;
    if (h.depth > winner.depth)                           return h;
    if (h.depth === winner.depth && h.root < winner.root) return h;
    return winner;
  }, null);

  return {
    total_trees:       plainTrees.length,
    total_cycles:      cyclicGroups.length,
    largest_tree_root: tallest ? tallest.root : '',
  };
}

function pipeline(rawList) {
  const { kept, junk, repeat }           = scrubInput(rawList);
  const { offspring, guardian, everyone } = buildKinship(kept);

  if (!everyone.size) {
    return {
      ...CREDENTIALS,
      hierarchies:     [],
      invalid_entries: junk,
      duplicate_edges: repeat,
      summary: { total_trees: 0, total_cycles: 0, largest_tree_root: '' },
    };
  }

  const clans       = findClans(everyone, offspring);
  const hierarchies = clans.flatMap(clan => assembleClan(clan, offspring, guardian));
  const summary     = calcSummary(hierarchies);

  return {
    ...CREDENTIALS,
    hierarchies,
    invalid_entries: junk,
    duplicate_edges: repeat,
    summary,
  };
}

app.post('/bfhl', (req, res) => {
  const incoming = req.body?.data;
  if (!Array.isArray(incoming))
    return res.status(400).json({ error: '"data" field must be an array.' });
  return res.status(200).json(pipeline(incoming));
});

app.get('/', (_, res) =>
  res.json({ alive: true, usage: 'POST /bfhl with { "data": ["A->B", ...] }' })
);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[BFHL] Listening → http://localhost:${PORT}`));