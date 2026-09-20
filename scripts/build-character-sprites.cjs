const fs = require("node:fs");
const path = require("node:path");
const { PNG } = require("pngjs");

const ROOT = path.resolve(process.cwd());
const ASSET_DIR = path.join(ROOT, "assets/images/character/onboarding");
const FRAME_SIZE = 627;

const sprites = [
  ["desired-outcome", 1207],
  ["blind-spot", 2311],
  ["future-question", 3463],
  ["memory-context", 4591],
  ["capture-style", 5653],
  ["currency", 6761],
];

function hash(value) {
  let result = value | 0;
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  result = Math.imul(result ^ (result >>> 16), 0x45d9f3b);
  return (result ^ (result >>> 16)) >>> 0;
}

function random01(value) {
  return hash(value) / 0xffffffff;
}

function offset(width, x, y) {
  return (y * width + x) * 4;
}

function samplePremultiplied(image, x, y) {
  if (x < 0 || y < 0 || x > image.width - 1 || y > image.height - 1) {
    return [0, 0, 0, 0];
  }

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const weights = [
    [(1 - tx) * (1 - ty), x0, y0],
    [tx * (1 - ty), x1, y0],
    [(1 - tx) * ty, x0, y1],
    [tx * ty, x1, y1],
  ];

  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const [weight, px, py] of weights) {
    const source = offset(image.width, px, py);
    const sourceAlpha = image.data[source + 3] / 255;
    alpha += sourceAlpha * weight;
    red += image.data[source] * sourceAlpha * weight;
    green += image.data[source + 1] * sourceAlpha * weight;
    blue += image.data[source + 2] * sourceAlpha * weight;
  }

  if (alpha < 0.001) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function resize(source, width, height) {
  const output = new PNG({ width, height, colorType: 6 });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = ((x + 0.5) * source.width) / width - 0.5;
      const sourceY = ((y + 0.5) * source.height) / height - 0.5;
      const rgba = samplePremultiplied(source, sourceX, sourceY);
      output.data.set(rgba, offset(width, x, y));
    }
  }
  return output;
}

function warpFrame(source, frame, seed) {
  const output = new PNG({ width: source.width, height: source.height, colorType: 6 });
  const amplitude = [0, 1.45, 2.25, 1.7][frame];
  const zones = [
    [0.25, 0.24, 0.29],
    [0.72, 0.24, 0.3],
    [0.5, 0.5, 0.33],
    [0.27, 0.77, 0.31],
    [0.73, 0.76, 0.32],
  ];

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      let dx = 0;
      let dy = 0;
      for (let zone = 0; zone < zones.length; zone += 1) {
        const [cx, cy, radius] = zones[zone];
        const normalizedX = x / source.width - cx;
        const normalizedY = y / source.height - cy;
        const distance = Math.hypot(normalizedX, normalizedY);
        if (distance >= radius || distance === 0) continue;

        // Zero displacement at each region's center and edge keeps every prop anchored.
        const envelope = Math.sin((Math.PI * distance) / radius) ** 2;
        const phase = random01(seed + zone * 977 + frame * 131) * Math.PI * 2;
        dx +=
          amplitude *
          envelope *
          Math.sin(y * (0.046 + zone * 0.004) + phase) *
          (zone % 2 === 0 ? 1 : -1);
        dy +=
          amplitude *
          envelope *
          Math.sin(x * (0.041 + zone * 0.003) - phase) *
          (zone % 2 === 0 ? -0.8 : 0.8);
      }

      const rgba = samplePremultiplied(source, x - dx, y - dy);
      output.data.set(rgba, offset(source.width, x, y));
    }
  }
  return output;
}

function isGreen(data, index) {
  const alpha = data[index + 3];
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  return alpha > 22 && green > 82 && green > red + 34 && green > blue + 12;
}

function underlyingPixel(image, x, y) {
  let light = 0;
  let dark = 0;
  let lightRed = 0;
  let lightGreen = 0;
  let lightBlue = 0;
  let darkRed = 0;
  let darkGreen = 0;
  let darkBlue = 0;

  for (let radius = 2; radius <= 8; radius += 2) {
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
        const index = offset(image.width, px, py);
        if (image.data[index + 3] < 90 || isGreen(image.data, index)) continue;
        const brightness =
          image.data[index] * 0.2126 +
          image.data[index + 1] * 0.7152 +
          image.data[index + 2] * 0.0722;
        if (brightness > 172) {
          light += 1;
          lightRed += image.data[index];
          lightGreen += image.data[index + 1];
          lightBlue += image.data[index + 2];
        } else if (brightness < 92) {
          dark += 1;
          darkRed += image.data[index];
          darkGreen += image.data[index + 1];
          darkBlue += image.data[index + 2];
        }
      }
    }
    if (light + dark >= 5) break;
  }

  if (light >= Math.max(3, dark * 1.15)) {
    return [
      Math.round(lightRed / light),
      Math.round(lightGreen / light),
      Math.round(lightBlue / light),
      255,
    ];
  }
  if (dark >= 3) {
    return [
      Math.round(darkRed / dark),
      Math.round(darkGreen / dark),
      Math.round(darkBlue / dark),
      255,
    ];
  }
  return [0, 0, 0, 0];
}

function compositePixel(target, targetIndex, source) {
  const sourceAlpha = source[3] / 255;
  const targetAlpha = target[targetIndex + 3] / 255;
  const resultAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (resultAlpha <= 0) return;

  for (let channel = 0; channel < 3; channel += 1) {
    target[targetIndex + channel] = Math.round(
      (source[channel] * sourceAlpha +
        target[targetIndex + channel] * targetAlpha * (1 - sourceAlpha)) /
        resultAlpha,
    );
  }
  target[targetIndex + 3] = Math.round(resultAlpha * 255);
}

function varyGreenShading(warped, frame, seed) {
  const output = new PNG({
    width: warped.width,
    height: warped.height,
    colorType: 6,
  });
  warped.data.copy(output.data);

  const greenPixels = [];
  for (let y = 0; y < warped.height; y += 1) {
    for (let x = 0; x < warped.width; x += 1) {
      const index = offset(warped.width, x, y);
      if (!isGreen(warped.data, index)) continue;
      greenPixels.push([x, y, index]);
      output.data.set(underlyingPixel(warped, x, y), index);
    }
  }

  const keepRates = [0.92, 0.7, 0.82, 0.61];
  const verticalBias = [0, -2, 2, -1][frame];
  const horizontalBias = [0, 1, -1, 2][frame];
  const holeCount = [1, 4, 2, 5][frame];
  const holes = Array.from({ length: holeCount }, (_, hole) => ({
    x: random01(seed + frame * 4001 + hole * 101) * warped.width,
    y: random01(seed + frame * 5003 + hole * 211) * warped.height,
    rx: 14 + random01(seed + frame * 6007 + hole * 307) * 36,
    ry: 10 + random01(seed + frame * 7001 + hole * 401) * 30,
  }));

  for (const [x, y, index] of greenPixels) {
    const tileX = Math.floor(x / 14);
    const tileY = Math.floor(y / 12);
    const tileSeed = seed + frame * 7919 + tileX * 173 + tileY * 389;
    if (random01(tileSeed) > keepRates[frame]) continue;

    const insideHole = holes.some((hole) => {
      const dx = (x - hole.x) / hole.rx;
      const dy = (y - hole.y) / hole.ry;
      return dx * dx + dy * dy < 1;
    });
    if (insideHole) continue;

    const localX = Math.round((random01(tileSeed + 17) - 0.5) * 4);
    const localY = Math.round((random01(tileSeed + 29) - 0.5) * 4);
    const destinationX = x + horizontalBias + localX;
    const destinationY = y + verticalBias + localY;
    if (
      destinationX < 0 ||
      destinationY < 0 ||
      destinationX >= warped.width ||
      destinationY >= warped.height
    ) {
      continue;
    }

    const sourceBrightness =
      (warped.data[index] + warped.data[index + 1] + warped.data[index + 2]) /
      (3 * 255);
    const grain = (random01(seed + frame * 1049 + x * 41 + y * 73) - 0.5) * 0.18;
    const tone = Math.max(0.55, Math.min(1.12, 0.67 + sourceBrightness * 0.43 + grain));
    const alpha = Math.round(warped.data[index + 3] * (0.82 + random01(tileSeed + 43) * 0.18));
    const green = [
      Math.round(32 * tone),
      Math.round(200 * tone),
      Math.round(120 * tone),
      alpha,
    ];
    compositePixel(output.data, offset(warped.width, destinationX, destinationY), green);
  }

  return output;
}

function copyFrame(atlas, frame, frameIndex) {
  const column = frameIndex % 2;
  const row = Math.floor(frameIndex / 2);
  for (let y = 0; y < frame.height; y += 1) {
    const sourceStart = offset(frame.width, 0, y);
    const targetStart = offset(atlas.width, column * frame.width, row * frame.height + y);
    frame.data.copy(atlas.data, targetStart, sourceStart, sourceStart + frame.width * 4);
  }
}

function frameMetrics(frame) {
  let alphaWeight = 0;
  let alphaX = 0;
  let alphaY = 0;
  let greenCount = 0;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const index = offset(frame.width, x, y);
      const alpha = frame.data[index + 3] / 255;
      alphaWeight += alpha;
      alphaX += x * alpha;
      alphaY += y * alpha;
      if (isGreen(frame.data, index)) greenCount += 1;
    }
  }
  return {
    centroid: [alphaX / alphaWeight, alphaY / alphaWeight],
    greenCount,
  };
}

for (const [name, seed] of sprites) {
  const inputPath = path.join(ASSET_DIR, `${name}-base.png`);
  const outputPath = path.join(ASSET_DIR, `${name}-sprite.png`);
  const source = PNG.sync.read(fs.readFileSync(inputPath));
  const base = resize(source, FRAME_SIZE, FRAME_SIZE);
  const atlas = new PNG({ width: FRAME_SIZE * 2, height: FRAME_SIZE * 2, colorType: 6 });
  const metrics = [];

  for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
    const warped = warpFrame(base, frameIndex, seed);
    const finished = varyGreenShading(warped, frameIndex, seed);
    copyFrame(atlas, finished, frameIndex);
    metrics.push(frameMetrics(finished));
  }

  fs.writeFileSync(outputPath, PNG.sync.write(atlas, { colorType: 6 }));
  const [originX, originY] = metrics[0].centroid;
  const drift = Math.max(
    ...metrics.map(({ centroid: [x, y] }) => Math.hypot(x - originX, y - originY)),
  );
  console.log(
    `${name}: max alpha-centroid drift ${drift.toFixed(2)} px; green pixels ${metrics
      .map(({ greenCount }) => greenCount)
      .join(" / ")}`,
  );
}
