const pi = 3.14159265358979323846264338327950288419716939937510;

export fn sfxBuffer(u8Array: [*]u8, u8ArrayLength: usize, sampleRate: u32) void {
    const hz = 256.0;
    const samples_per_wave = @intToFloat(f64, sampleRate) / hz; // 32 desired;
    for (u8Array[0..u8ArrayLength]) |_, i| {
        u8Array[i] = @floatToInt(u8, @sin(@intToFloat(f64, i) / samples_per_wave * 2 * pi) * 127.5 + 127.5);
    }
}

export fn u8ArrayToF32Array(u8Array: [*]u8, u8ArrayLength: usize, f32Array: [*]f32, f32ArrayLength: usize) void {
    const size = @min(u8ArrayLength, f32ArrayLength);
    for (u8Array[0..size]) |b, i| f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}
