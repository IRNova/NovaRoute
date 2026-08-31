import { DefaultExecutor } from "./default.js";
import { resolveLocalHost } from "../local/baseUrl.js";

export class LlamacppLocalExecutor extends DefaultExecutor {
  constructor() {
    super("llamacpp-local");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    const base = resolveLocalHost(credentials, "llamacpp");
    return `${base}/v1/chat/completions`;
  }
}

export default LlamacppLocalExecutor;
