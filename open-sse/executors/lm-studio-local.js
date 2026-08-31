import { DefaultExecutor } from "./default.js";
import { resolveLocalHost } from "../local/baseUrl.js";

export class LmStudioLocalExecutor extends DefaultExecutor {
  constructor() {
    super("lm-studio-local");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    const base = resolveLocalHost(credentials, "lm-studio");
    return `${base}/v1/chat/completions`;
  }
}

export default LmStudioLocalExecutor;
