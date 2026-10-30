import { file } from "../../lib/assets";

export const dynamic = "force-static";
export function GET() {
  return file(".", "favicon.svg");
}
