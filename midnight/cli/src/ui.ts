/* Console output. The demo is meant to be watched, so it narrates itself. */

const DIV = '─'.repeat(74);

export const rule = (): void => console.log(`  ${DIV}`);
export const note = (msg: string): void => console.log(`  ${msg}`);
export const blank = (): void => console.log('');

export const heading = (title: string): void => {
  blank();
  rule();
  console.log(`  ${title}`);
  rule();
};

export const step = (msg: string): void => {
  blank();
  console.log(`  ▸ ${msg}`);
};

export const withStatus = async <T>(message: string, fn: () => Promise<T>): Promise<T> => {
  // A spinner redrawing over \r is unreadable once stdout is a pipe or a log
  // file, so animate only for a real terminal.
  const animated = process.stdout.isTTY === true;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval: NodeJS.Timeout | undefined;

  if (animated) {
    interval = setInterval(() => {
      process.stdout.write(`\r  ${frames[i++ % frames.length]} ${message}`);
    }, 80);
  } else {
    console.log(`  · ${message}`);
  }

  const finish = (mark: string) => {
    if (interval) clearInterval(interval);
    process.stdout.write(animated ? `\r  ${mark} ${message}\n` : `  ${mark} ${message}\n`);
  };

  try {
    const result = await fn();
    finish('✓');
    return result;
  } catch (e) {
    finish('✗');
    throw e;
  }
};

export const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

/** Long hex is unreadable in a terminal and nobody checks it by eye anyway. */
export const short = (b: Uint8Array | string, keep = 10): string => {
  const s = typeof b === 'string' ? b : hex(b);
  return s.length <= keep * 2 ? s : `${s.slice(0, keep)}…${s.slice(-4)}`;
};
