import { describe, it, expect } from 'bun:test';
import { Relooper, reloop } from '../src/core/cpu/jit/Relooper';

describe('Relooper', () =>
{
  describe('single block', () =>
  {
    it('should render single block without loop/switch', () =>
    {
      const relooper = new Relooper();
      const block = relooper.addBlock('x = 1;');

      const code = relooper.render(block);
      expect(code).toBe('x = 1;');
    });
  });

  describe('linear sequence', () =>
  {
    it('should render two blocks with fallthrough', () =>
    {
      const relooper = new Relooper();
      const a = relooper.addBlock('x = 1;');
      const b = relooper.addBlock('y = 2;');
      relooper.addBranch(a, b);

      const code = relooper.render(a);
      expect(code).toContain('case 0:');
      expect(code).toContain('x = 1;');
      expect(code).toContain('case 1:');
      expect(code).toContain('y = 2;');
    });
  });

  describe('conditional branch', () =>
  {
    it('should render if-then-else pattern', () =>
    {
      const relooper = new Relooper();
      const entry = relooper.addBlock('// entry');
      const thenBlock = relooper.addBlock('result = true;');
      const elseBlock = relooper.addBlock('result = false;');

      relooper.addBranch(entry, thenBlock, 'x > 0');
      relooper.addBranch(entry, elseBlock);

      const code = relooper.render(entry);
      expect(code).toContain('if (x > 0)');
      expect(code).toContain('label = 1');
      expect(code).toContain('result = true;');
      expect(code).toContain('result = false;');
    });
  });

  describe('loop', () =>
  {
    it('should render simple loop with back edge', () =>
    {
      const relooper = new Relooper();
      const loopStart = relooper.addBlock('i++;');
      const loopEnd = relooper.addBlock('// check');

      relooper.addBranch(loopStart, loopEnd);
      relooper.addBranch(loopEnd, loopStart, 'i < 10'); // back edge

      const code = relooper.render(loopStart);
      expect(code).toContain('while (true)');
      expect(code).toContain('continue loop');

      const stats = relooper.getStats();
      expect(stats.hasLoops).toBe(true);
    });
  });

  describe('reloop helper', () =>
  {
    it('should work with builder pattern', () =>
    {
      const code = reloop(r =>
      {
        const a = r.addBlock('step1();');
        const b = r.addBlock('step2();');
        r.addBranch(a, b);
        return a;
      });

      expect(code).toContain('step1()');
      expect(code).toContain('step2()');
    });
  });

  describe('branch with code', () =>
  {
    it('should execute code before branch', () =>
    {
      const relooper = new Relooper();
      const a = relooper.addBlock('x = 0;');
      const b = relooper.addBlock('done();');

      relooper.addBranch(a, b, 'x > 5', 'beforeJump();');

      const code = relooper.render(a);
      expect(code).toContain('beforeJump();');
      expect(code).toContain('label = 1');
    });
  });
});

describe('Relooper integration', () =>
{
  it('should generate executable JavaScript', () =>
  {
    // Use var instead of let/const because switch case has TDZ issues
    const code = reloop(r =>
    {
      const init = r.addBlock('var sum = 0, i = 0;');
      const loop = r.addBlock('sum += i; i++;');
      const end = r.addBlock('return sum;');

      r.addBranch(init, loop);
      r.addBranch(loop, loop, 'i < 5');
      r.addBranch(loop, end);

      return init;
    });

    // Wrap in function and execute
    const fn = new Function(code);
    const result = fn();
    expect(result).toBe(0 + 1 + 2 + 3 + 4); // 10
  });

  it('should handle fibonacci-like computation', () =>
  {
    const code = reloop(r =>
    {
      const init = r.addBlock('var a = 0, b = 1, n = 10, temp;');
      const loop = r.addBlock('temp = a + b; a = b; b = temp; n--;');
      const end = r.addBlock('return a;');

      r.addBranch(init, loop);
      r.addBranch(loop, loop, 'n > 0');
      r.addBranch(loop, end);

      return init;
    });

    const fn = new Function(code);
    const result = fn();
    expect(result).toBe(55); // fib(10)
  });
});
