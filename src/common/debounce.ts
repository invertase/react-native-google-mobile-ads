export const debounce = <Arguments extends unknown[]>(
  func: (...args: Arguments) => unknown,
  waitFor: number,
): ((...args: Arguments) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Arguments) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};
