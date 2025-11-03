import fetch from "node-fetch";
import sharp from "sharp";
import FormData from "form-data";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

async function backupTiles() {
  try {
    console.log("Starting tile backup...");

    const x1 = 1520,
      y1 = 865;
    const x2 = 1525,
      y2 = 867;

    const x_coords = [];
    for (let x = x1; x <= x2; x++) {
      x_coords.push(x);
    }

    const y_coords = [];
    for (let y = y1; y <= y2; y++) {
      y_coords.push(y);
    }

    const tiles = [];
    for (const y of y_coords) {
      for (const x of x_coords) {
        tiles.push(`${x}/${y}`);
      }
    }

    console.log(`[Downloading] ${tiles.length} chunks...`);

    const base_url = "https://backend.wplace.live/files/s0/tiles/";

    const image_buffers = [];
    for (const tile of tiles) {
      const response = await fetch(`${base_url}${tile}.png`);
      if (!response.ok) throw new Error(`Failed to fetch ${tile}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      image_buffers.push(buffer);
    }
    console.log(`[Completed downloading] ${tiles.length} chunks.`);

    const first_image = sharp(image_buffers[0]);
    const { width, height } = await first_image.metadata();

    const cols = x_coords.length;
    const rows = y_coords.length;

    const composite_images = image_buffers.map((buffer, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        input: buffer,
        top: row * height,
        left: col * width,
      };
    });

    const combined_image = await sharp({
      create: {
        width: width * cols,
        height: height * rows,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composite_images)
      .png()
      .toBuffer();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    // Save the image to the raw tiles directory
    const rawTilesDir = "./public/tiles/raw";
    await fs.mkdir(rawTilesDir, { recursive: true });

    const fileName = `tile_backup_${timestamp}.png`;
    const filePath = path.join(rawTilesDir, fileName);

    await sharp(combined_image).toFile(filePath);
    console.log(`Saved backup to ${filePath}`);

    // Send to Discord webhook
    // Use Buffer directly with form-data (node) instead of browser Blob to avoid
    // DelayedStream errors when form-data tries to convert sources to streams.
    const formData = new FormData();
    // Append buffer with filename and content type so form-data handles it as a file
    formData.append("file", combined_image, {
      filename: fileName,
      contentType: "image/png",
    });
    formData.append(
      "content",
      `Backup created at <t:${Math.floor(Date.now() / 1000)}:F>`
    );

    if (!process.env.DISCORD_WEBHOOK_URL) {
      throw new Error("DISCORD_WEBHOOK_URL environment variable is not set");
    }

    // form-data provides getHeaders() to supply proper multipart headers for node-fetch
    const headers =
      typeof formData.getHeaders === "function" ? formData.getHeaders() : {};

    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to send to webhook: ${response.status} ${response.statusText}`
      );
    }

    console.log("Backup completed successfully");
  } catch (error) {
    console.error("Error performing backup:", error);
  }
}

backupTiles()
  .then(() => {
    console.log("Backup run finished — exiting.");
    setTimeout(() => process.exit(0), 50);
  })
  .catch((err) => {
    console.error("Backup run failed:", err);
    setTimeout(() => process.exit(1), 50);
  });
