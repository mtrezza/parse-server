const Benchmark = require('benchmark');
const suite = new Benchmark.Suite();

describe('Benchmark', () => {
  it('stores objects in database', async () => {
    suite
      .add('stores objects in database', async () => {
        for (let i = 0; i < 1000; i++) {
          const obj = new Parse.Object('TestObject');
          obj.set('foo', 'bar');
          await obj.save();
        }
      })
      .on('cycle', event => {
        // Output benchmark result by converting benchmark result to string
        console.log(String(event.target));
      })
      .run();
  });
});
