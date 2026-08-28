import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { staticAssets } from "./staticAssets";

const http = httpRouter();

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

for (const asset of staticAssets) {
  http.route({
    path: asset.path,
    method: "GET",
    handler: httpAction(async () => new Response(decodeBase64(asset.bodyBase64), {
      headers: {
        "Cache-Control": asset.immutable ? "public, max-age=31536000, immutable" : "no-cache",
        "Content-Type": asset.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    })),
  });
}

export default http;
