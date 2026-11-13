// Worker thread: glossarist-native per-concept interchange emissions
// (ttl / jsonld / tbx). Plain .mjs — ESM loader hooks like tsx do not
// propagate into worker threads, so this file must stay dependency-free
// of workspace TS; everything resolves from node_modules.
//
// Concept model instances are class objects and cannot cross the
// worker boundary, so the worker re-parses the exact source text the
// main thread read.
import { parentPort, workerData } from 'node:worker_threads';
import { parseConceptYaml, conceptToTurtle, emitOutputSet, conceptsToTbx } from 'glossarist';

const { registerId, uriBase } = workerData;

parentPort.on('message', async ({ termid, sourceText }) => {
  try {
    const concept = parseConceptYaml(sourceText, termid);
    const outputs = await emitOutputSet([concept], {
      registerId,
      uriBase,
      formats: ['jsonld'],
    });
    parentPort.postMessage({
      termid,
      ttl: conceptToTurtle(concept, { uriBase, registerId }),
      jsonld: outputs.jsonld,
      tbx: conceptsToTbx([concept], { registerId }) || null,
    });
  } catch (e) {
    parentPort.postMessage({ termid, error: String((e && e.message) || e) });
  }
});
