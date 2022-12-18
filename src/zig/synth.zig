export fn fibonacci(i: u64) u64 {
    if (i <= 1) return i;
    return fibonacci(i - 1) + fibonacci(i - 2);
}
