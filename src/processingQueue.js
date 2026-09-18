export function createContactProcessingQueue({ onError = () => {} } = {}) {
  const queues = new Map();

  function enqueue(remoteJid, task) {
    const previous = queues.get(remoteJid) || Promise.resolve();
    const current = previous
      .catch((error) => onError(remoteJid, error, "previous"))
      .then(task)
      .catch((error) => onError(remoteJid, error, "current"))
      .finally(() => {
        if (queues.get(remoteJid) === current) queues.delete(remoteJid);
      });

    queues.set(remoteJid, current);
    return current;
  }

  enqueue.has = (remoteJid) => queues.has(remoteJid);
  return enqueue;
}
