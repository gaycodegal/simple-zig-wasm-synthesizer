pub var SineWave = [32]u4{
    8,  9,  10, 12, 13, 14, 14, 15,
    15, 15, 14, 14, 13, 12, 10, 9,
    7,  6,  5,  3,  2,  1,  1,  0,
    0,  0,  1,  1,  2,  3,  5,  6,
};

pub var Silent = [32]u4{
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7,
};

pub var SquareWave = [32]u4{
    15, 15, 15, 15, 15, 15, 15, 15,
    0,  0,  0,  0,  0,  0,  0,  0,
    15, 15, 15, 15, 15, 15, 15, 15,
    0,  0,  0,  0,  0,  0,  0,  0,
};

// test "generate waveforms" {
//     const pi = 3.14159265358979323846264338327950288419716939937510;
//     const std = @import("std");

//     // sine
//     var SineWave_: [32]u4 = undefined;

//     for (SineWave_[0..SineWave_.len]) |*val, pos| {
//         const r = @round(@sin(@intToFloat(f32, pos % SineWave_.len) / @intToFloat(f32, SineWave_.len) * 2 * pi) * 7.5 + 7.5);
//         val.* = @floatToInt(u4, r);
//         std.debug.print("{d}, ", .{val.*});
//     }
// }
