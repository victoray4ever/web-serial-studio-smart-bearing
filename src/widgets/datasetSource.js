export function sourceIdForDataset(dataset) {
  const value = dataset?.sourceId ?? dataset?.source ?? dataset?.sourceID;
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

export function frameMatchesDatasetSource(frame, dataset) {
  const expected = sourceIdForDataset(dataset);
  if (!expected) return true;

  const actual = frame?.sourceId ?? frame?.source ?? frame?.sourceID;
  return actual !== undefined && actual !== null && String(actual) === expected;
}

export function datasetFromFrame(frame, dataset, fallbackIndex = 0) {
  if (!frameMatchesDatasetSource(frame, dataset)) return null;
  const index = dataset?.index ?? fallbackIndex;
  const received = frame?.datasets?.[index];
  if (!received) return null;

  const expected = sourceIdForDataset(dataset);
  if (!expected) return received;
  const actual = received.sourceId ?? frame.sourceId;
  return actual !== undefined && actual !== null && String(actual) === expected ? received : null;
}
