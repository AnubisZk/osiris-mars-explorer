/** Kuantum sınıflandırıcıyı arka plan iş parçacığında (Web Worker) eğitir; oyun döngüsünü yavaşlatmaz. */
import {QuantumTrainer} from './quantum.js';
self.onmessage = e => {
  const tr = new QuantumTrainer(e.data.seed);
  while (!tr.done) {
    tr.step();
    self.postMessage({type: 'epoch', h: tr.history.at(-1), epoch: tr.epoch, best: {epoch: tr.best.epoch, valLoss: tr.best.valLoss}});
  }
  self.postMessage({type: 'done', state: tr.model.snapshot(), best: {epoch: tr.best.epoch, valLoss: tr.best.valLoss}, test: tr.test, testShots: tr.testShots, evals: tr.model.evals, ms: tr.ms});
};
